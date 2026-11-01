-- Phase 2c: referral credits (Pro). Each past traveler gets a code; /go/<slug>?ref=CODE is recorded on
-- the booking. When that booking is first paid, the referrer earns a credit the organizer set (for
-- example $50), which comes off their next booking with that organizer. A discount, never cash.

alter table public.organizers add column referral_credit_minor bigint not null default 0 check (referral_credit_minor between 0 and 100000);
alter table public.organizer_contacts add column referral_code text;
alter table public.bookings
  add column referred_by uuid references public.organizer_contacts (id),
  add column credit_minor bigint not null default 0 check (credit_minor >= 0);

create function private.new_referral_code() returns text
language sql volatile set search_path = '' as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
$$;

create function private.contact_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.referral_code is null then
    new.referral_code := private.new_referral_code();
    while exists (select 1 from public.organizer_contacts where organizer_id = new.organizer_id and referral_code = new.referral_code) loop
      new.referral_code := private.new_referral_code();
    end loop;
  end if;
  return new;
end $$;
create trigger contact_code before insert on public.organizer_contacts for each row execute function private.contact_code();
update public.organizer_contacts set referral_code = private.new_referral_code() where referral_code is null;
alter table public.organizer_contacts alter column referral_code set not null;
create unique index organizer_contacts_code on public.organizer_contacts (organizer_id, referral_code);

create table public.referral_credits (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  contact_id uuid not null references public.organizer_contacts (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  source_booking_id uuid not null unique references public.bookings (id),
  used_booking_id uuid references public.bookings (id),
  created_at timestamptz not null default now()
);
alter table public.referral_credits enable row level security;
create policy referral_credits_select on public.referral_credits for select to authenticated
  using (exists (select 1 from public.organizers o where o.id = organizer_id and o.owner_user_id = (select auth.uid())));

create function public.save_referral_settings(p_credit_minor bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.my_organizer_id();
begin
  perform private.require_pro(v_org);
  if p_credit_minor is null or p_credit_minor not between 0 and 100000 then
    raise exception 'A credit between $0 (off) and $1,000' using errcode = '22023';
  end if;
  update public.organizers set referral_credit_minor = p_credit_minor, updated_at = now() where id = v_org;
end $$;

-- A referred booking, once first paid, earns its referrer a credit; an abandoned hold gives back
-- the credits it was going to use.
create function private.referral_on_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_amount bigint;
begin
  if new.status = 'expired' or (new.status = 'cancelled' and new.paid_minor = 0) then
    update public.referral_credits set used_booking_id = null where used_booking_id = new.id;
  end if;
  if old.status = 'pending' and new.status in ('active', 'paid') and new.referred_by is not null
     and private.has_pro(new.organizer_id) then
    select referral_credit_minor into v_amount from public.organizers where id = new.organizer_id;
    if v_amount > 0 then
      insert into public.referral_credits (organizer_id, contact_id, amount_minor, source_booking_id)
      values (new.organizer_id, new.referred_by, v_amount, new.id) on conflict (source_booking_id) do nothing;
    end if;
  end if;
  return null;
end $$;
create trigger referral_on_status after update of status on public.bookings
  for each row execute function private.referral_on_status();

-- A booking's plan follows its own price: a room's extra joins the last payment, and a credit comes
-- off the last payments first.
create or replace function private.booking_schedule() returns trigger
language plpgsql set search_path = '' as $$
declare
  f public.trip_offers;
  v_diff bigint;
  v_n integer;
  i integer;
  v_amount bigint;
  v_out jsonb := '[]';
begin
  select * into f from public.trip_offers where id = new.offer_id;
  new.schedule := coalesce(f.schedule, '[]');
  v_diff := new.price_minor - coalesce(f.price_minor, new.price_minor);
  v_n := jsonb_array_length(new.schedule);
  if v_n = 0 or v_diff = 0 then return new; end if;
  if v_diff > 0 then
    new.schedule := jsonb_set(new.schedule, array[(v_n - 1)::text, 'amount_minor'],
      to_jsonb((new.schedule -> (v_n - 1) ->> 'amount_minor')::bigint + v_diff));
    return new;
  end if;
  v_diff := -v_diff;
  for i in reverse (v_n - 1)..0 loop
    v_amount := (new.schedule -> i ->> 'amount_minor')::bigint;
    if v_diff >= v_amount then
      v_diff := v_diff - v_amount;
    else
      v_out := jsonb_build_array(jsonb_set(new.schedule -> i, '{amount_minor}', to_jsonb(v_amount - v_diff))) || v_out;
      v_diff := 0;
    end if;
  end loop;
  new.schedule := v_out;
  return new;
end $$;

create or replace function public.pay_reserve_booking(p_slug text, p_user uuid, p_name text, p_email text, p_policy_version integer,
  p_extra jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  f public.trip_offers;
  o public.organizers;
  a public.stripe_accounts;
  v_token text := private.new_share_token() || private.new_share_token();
  v_booking public.bookings;
  v_collected bigint;
  v_extra jsonb := coalesce(p_extra, '{}');
  v_answers jsonb;
  v_room jsonb;
  v_price bigint;
  v_hold public.waitlist_entries;
  v_ref uuid;
  v_credit bigint := 0;
  v_cap bigint;
  v_credits uuid[] := '{}';
  cr record;
begin
  select * into f from public.trip_offers where slug = p_slug and status = 'published' and deleted_at is null for update;
  if f.id is null then raise exception 'This trip isn''t taking bookings' using errcode = 'P0002'; end if;
  select * into o from public.organizers where id = f.organizer_id;
  if o.reviewed_at is null then raise exception 'This trip isn''t taking bookings yet' using errcode = 'P0002'; end if;
  select * into a from public.stripe_accounts where organizer_id = o.id and charges_enabled and disconnected_at is null;
  if a.organizer_id is null then raise exception 'This organizer can''t take payments right now' using errcode = 'P0002'; end if;
  if p_policy_version is distinct from f.policy_version then
    raise exception 'The cancellation policy changed. Read it again before booking.' using errcode = '40001';
  end if;
  v_answers := private.clean_answers(f.questions, v_extra -> 'answers');
  -- A room choice, when the trip offers them (and only then).
  v_price := f.price_minor;
  if jsonb_array_length(f.room_options) > 0 then
    select value into v_room from jsonb_array_elements(f.room_options) where value ->> 'id' = v_extra ->> 'room_option';
    if v_room is null then raise exception 'Choose a room' using errcode = '22023'; end if;
    v_price := v_price + (v_room ->> 'price_delta_minor')::bigint;
  end if;
  -- A held waitlist place: the token is the proof.
  if coalesce(v_extra ->> 'hold', '') <> '' then
    select * into v_hold from public.waitlist_entries
    where hold_token_hash = encode(sha256(convert_to(v_extra ->> 'hold', 'UTF8')), 'hex') and offer_id = f.id
      and status = 'offered' and hold_until > now() for update;
    if v_hold.id is null then raise exception 'This held place has expired. Join the waitlist again.' using errcode = 'P0002'; end if;
  end if;
  -- Who sent them (a referral link), if it's someone else on this organizer's traveler list.
  if coalesce(v_extra ->> 'ref', '') <> '' then
    select id into v_ref from public.organizer_contacts
    where organizer_id = o.id and referral_code = upper(left(v_extra ->> 'ref', 12)) and email <> lower(trim(p_email));
  end if;
  select coalesce(sum(p.charged_minor - p.refunded_minor), 0) into v_collected
  from public.booking_payments p join public.bookings b on b.id = p.booking_id
  where b.organizer_id = o.id and p.status in ('succeeded', 'partially_refunded', 'processing');
  if v_collected + v_price > o.collect_limit_minor then
    raise exception 'This organizer has reached their booking limit for now. Contact them directly.' using errcode = 'P0002';
  end if;
  -- The same person trying again within the hold reuses their place.
  select * into v_booking from public.bookings
  where offer_id = f.id and started_by_user = p_user and status = 'pending' and created_at > now() - interval '35 minutes'
  order by created_at desc limit 1;
  if v_booking.id is null then
    -- A held place is already counted as taken, so it doesn't count against its own holder.
    if private.spots_taken(f.id) - (case when v_hold.id is not null and v_hold.booking_id is null then 1 else 0 end) >= f.capacity then
      raise exception 'This trip is full' using errcode = 'P0002';
    end if;
    if v_room is not null and private.room_taken(f.id, v_room ->> 'id') >= (v_room ->> 'count')::integer then
      raise exception 'No % rooms are left. Choose another.', lower(v_room ->> 'label') using errcode = 'P0002';
    end if;
    -- Credits this traveler earned by referring others come off the price, whole credits only, never
    -- below the deposit (or $1 when there is none), so the first payment is unchanged.
    v_cap := greatest(0, v_price - greatest(least(f.deposit_minor, v_price), 100));
    for cr in select c.id, c.amount_minor from public.referral_credits c join public.organizer_contacts k on k.id = c.contact_id
              where c.organizer_id = o.id and k.email = lower(trim(p_email)) and c.used_booking_id is null
              order by c.created_at for update of c loop
      if v_credit + cr.amount_minor <= v_cap then
        v_credit := v_credit + cr.amount_minor;
        v_credits := v_credits || cr.id;
      end if;
    end loop;
    v_price := v_price - v_credit;
    insert into public.bookings (trip_id, offer_id, organizer_id, traveler_name, traveler_email, price_minor, deposit_minor,
      balance_due_date, fee_mode, policy_version, policy_accepted_at, started_by_user, manage_token_hash,
      answers, marketing_consent, room_option, referred_by, credit_minor)
    values (f.trip_id, f.id, o.id, trim(p_name), lower(trim(p_email)), v_price, least(f.deposit_minor, v_price), f.balance_due_date,
      f.fee_mode, f.policy_version, now(), p_user, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
      v_answers, coalesce((v_extra ->> 'consent')::boolean, false), v_room ->> 'id', v_ref, v_credit)
    returning * into v_booking;
    update public.referral_credits set used_booking_id = v_booking.id where id = any (v_credits);
    insert into private.booking_tokens (booking_id, token) values (v_booking.id, v_token);
  else
    update public.bookings set traveler_name = trim(p_name), traveler_email = lower(trim(p_email)), policy_accepted_at = now(),
      manage_token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), answers = v_answers,
      marketing_consent = coalesce((v_extra ->> 'consent')::boolean, false)
    where id = v_booking.id returning * into v_booking;
    insert into private.booking_tokens (booking_id, token) values (v_booking.id, v_token)
    on conflict (booking_id) do update set token = excluded.token;
  end if;
  if v_hold.id is not null then
    update public.waitlist_entries set booking_id = v_booking.id, updated_at = now() where id = v_hold.id;
  end if;
  return jsonb_build_object('booking_id', v_booking.id, 'manage_token', v_token, 'trip_id', f.trip_id, 'title', f.title,
    'slug', f.slug, 'stripe_account_id', a.stripe_account_id, 'price_minor', v_booking.price_minor, 'deposit_minor', v_booking.deposit_minor,
    'fee_mode', f.fee_mode, 'allow_bank', f.allow_bank, 'traveler_email', v_booking.traveler_email);
end $$;
revoke execute on function public.pay_reserve_booking(text, uuid, text, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.pay_reserve_booking(text, uuid, text, text, integer, jsonb) to service_role;

-- The booking page offers the traveler their own referral link when the organizer gives credits.
create or replace function public.get_booking(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', b.id, 'status', b.status, 'trip_id', b.trip_id, 'traveler_name', b.traveler_name,
    'price_minor', b.price_minor, 'deposit_minor', b.deposit_minor, 'paid_minor', b.paid_minor,
    'refunded_minor', b.refunded_minor, 'balance_due_date', b.balance_due_date, 'fee_mode', b.fee_mode,
    'schedule', b.schedule, 'next_minor', (private.booking_due(b) ->> 'next_minor')::bigint, 'next_date', private.booking_due(b) ->> 'next_date',
    'answers', b.answers, 'room_option', b.room_option, 'credit_minor', b.credit_minor,
    'referral', (select jsonb_build_object('code', k.referral_code, 'credit_minor', o.referral_credit_minor)
                 from public.organizer_contacts k
                 where k.organizer_id = b.organizer_id and k.email = b.traveler_email
                   and o.referral_credit_minor > 0 and private.has_pro(b.organizer_id) and b.status in ('active', 'paid')),
    'offer', jsonb_build_object('slug', f.slug, 'title', f.title, 'allow_bank', f.allow_bank, 'status', f.status,
      'refund_tiers', f.refund_tiers, 'questions', f.questions, 'room_options', f.room_options),
    'organizer', jsonb_build_object('name', o.display_name, 'email', o.support_email),
    'processing', exists (select 1 from public.booking_payments p where p.booking_id = b.id and p.status = 'processing')
  )
  from public.bookings b join public.trip_offers f on f.id = b.offer_id join public.organizers o on o.id = b.organizer_id
  where b.manage_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

-- The app's organizer profile includes the referral credit.
create or replace function public.my_organizer() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', o.id, 'display_name', o.display_name, 'support_email', o.support_email, 'slug', o.slug,
    'reviewed', o.reviewed_at is not null, 'pro', private.has_pro(o.id), 'postal_address', o.postal_address, 'referral_credit_minor', o.referral_credit_minor,
    'beta', coalesce((select value = 'true'::jsonb from private.app_settings where key = 'pro_free_beta'), false),
    'campaign_sending', coalesce((select value = 'true'::jsonb from private.app_settings where key = 'campaign_sending'), false))
  from public.organizers o where o.owner_user_id = (select auth.uid())
$$;

revoke execute on function public.save_referral_settings(bigint) from public;
grant execute on function public.save_referral_settings(bigint) to authenticated;

notify pgrst, 'reload schema';
