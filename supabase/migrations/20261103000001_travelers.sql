-- Phase 2b: what an organizer needs to fill and run the next trip.
--   Questions at booking (on the 1%): dietary, accessibility, emergency contact, up to 5 of their own.
--   Traveler list (Pro): everyone who has booked with an organizer, with consent to hear about new trips.
--   Waitlist (Pro): when a trip is full, people queue; a freed place is held for the next one for 48 h.
--   Rooms (Pro): room choices that change the price, and a rooming board (a synced, staff-only table).
-- Additive: no group-trip table changes.

-- Policies below ask has_pro as the signed-in user; it only reveals whether an organizer has Pro.
grant execute on function private.has_pro(uuid) to authenticated;

insert into private.app_settings (key, value) values ('site_url', '"https://joinstowaway.app"') on conflict (key) do nothing;

create function private.site_url() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select value #>> '{}' from private.app_settings where key = 'site_url'), 'https://joinstowaway.app')
$$;
revoke all on function private.site_url() from public;

alter table public.trip_offers
  add column questions jsonb not null default '{}' check (jsonb_typeof(questions) = 'object'),
  add column room_options jsonb not null default '[]' check (jsonb_typeof(room_options) = 'array' and jsonb_array_length(room_options) <= 8);
alter table public.bookings
  add column answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object' and length(answers::text) <= 8000),
  add column marketing_consent boolean not null default false,
  add column room_option text;

-- ─── Questions at booking ───────────────────────────────────────────────────
-- questions: { dietary, accessibility, emergency_contact: boolean, custom: [{ id, label, required }] }.
-- Answers only ever hold the offer's own questions, trimmed; a required one must be answered.

create function private.clean_answers(p_questions jsonb, p_answers jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v jsonb := '{}';
  k text;
  q jsonb;
  val text;
begin
  p_answers := coalesce(p_answers, '{}');
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Answers must be a list of answers' using errcode = '22023'; end if;
  foreach k in array array['dietary', 'accessibility', 'emergency_contact'] loop
    if coalesce((p_questions ->> k)::boolean, false) then
      val := left(trim(coalesce(p_answers ->> k, '')), 500);
      if val <> '' then v := v || jsonb_build_object(k, val); end if;
    end if;
  end loop;
  for q in select value from jsonb_array_elements(coalesce(p_questions -> 'custom', '[]')) loop
    val := left(trim(coalesce(p_answers ->> (q ->> 'id'), '')), 500);
    if val = '' and coalesce((q ->> 'required')::boolean, false) then
      raise exception 'Answer “%” before booking', q ->> 'label' using errcode = '22023';
    end if;
    if val <> '' then v := v || jsonb_build_object(q ->> 'id', val); end if;
  end loop;
  return v;
end $$;
revoke all on function private.clean_answers(jsonb, jsonb) from public;

create function public.save_offer_questions(p_trip_id uuid, p_questions jsonb) returns public.trip_offers
language plpgsql security definer set search_path = '' as $$
declare
  f public.trip_offers;
  v_custom jsonb := '[]';
  q jsonb;
  v_ids text[] := '{}';
begin
  if private.my_organizer_for(p_trip_id) is null then
    raise exception 'Only this trip''s organizer can change its booking questions' using errcode = '42501';
  end if;
  select * into f from public.trip_offers where trip_id = p_trip_id;
  if f.id is null then raise exception 'Set up the trip''s price first' using errcode = 'P0002'; end if;
  if jsonb_typeof(coalesce(p_questions, '{}')) <> 'object' or jsonb_typeof(coalesce(p_questions -> 'custom', '[]')) <> 'array'
     or jsonb_array_length(coalesce(p_questions -> 'custom', '[]')) > 5 then
    raise exception 'Up to 5 questions of your own' using errcode = '22023';
  end if;
  for q in select value from jsonb_array_elements(coalesce(p_questions -> 'custom', '[]')) loop
    if coalesce(q ->> 'id', '') !~ '^[a-z0-9_-]{1,20}$' or q ->> 'id' in ('dietary', 'accessibility', 'emergency_contact')
       or q ->> 'id' = any (v_ids) or length(trim(coalesce(q ->> 'label', ''))) not between 1 and 120 then
      raise exception 'Each question needs some words, up to 120 characters' using errcode = '22023';
    end if;
    v_ids := v_ids || (q ->> 'id');
    v_custom := v_custom || jsonb_build_array(jsonb_build_object('id', q ->> 'id', 'label', trim(q ->> 'label'),
      'required', coalesce((q ->> 'required')::boolean, false)));
  end loop;
  update public.trip_offers set questions = jsonb_build_object(
    'dietary', coalesce((p_questions ->> 'dietary')::boolean, false),
    'accessibility', coalesce((p_questions ->> 'accessibility')::boolean, false),
    'emergency_contact', coalesce((p_questions ->> 'emergency_contact')::boolean, false),
    'custom', v_custom)
  where id = f.id returning * into f;
  return f;
end $$;

-- A traveler updates their answers from their booking link (no account needed).
create function public.update_booking_answers(p_token text, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings
  where manage_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') and status in ('pending', 'active', 'paid');
  if b.id is null then raise exception 'We couldn''t find this booking' using errcode = 'P0002'; end if;
  update public.bookings set answers = private.clean_answers((select questions from public.trip_offers where id = b.offer_id), p_answers)
  where id = b.id returning * into b;
  return b.answers;
end $$;

-- ─── Room choices (Pro) ─────────────────────────────────────────────────────
-- room_options: [{ id, label, price_delta_minor, count }]. A booking picks one; its price is the
-- trip price plus the difference, and each choice has its own count of places.

create function public.save_room_options(p_trip_id uuid, p_options jsonb) returns public.trip_offers
language plpgsql security definer set search_path = '' as $$
declare
  f public.trip_offers;
  v_org uuid := private.my_organizer_for(p_trip_id);
  v_out jsonb := '[]';
  r jsonb;
  v_ids text[] := '{}';
begin
  if v_org is null then raise exception 'Only this trip''s organizer can change its rooms' using errcode = '42501'; end if;
  perform private.require_pro(v_org);
  select * into f from public.trip_offers where trip_id = p_trip_id;
  if f.id is null then raise exception 'Set up the trip''s price first' using errcode = 'P0002'; end if;
  if jsonb_typeof(coalesce(p_options, '[]')) <> 'array' or jsonb_array_length(coalesce(p_options, '[]')) > 8 then
    raise exception 'Up to 8 room choices' using errcode = '22023';
  end if;
  for r in select value from jsonb_array_elements(coalesce(p_options, '[]')) loop
    if coalesce(r ->> 'id', '') !~ '^[a-z0-9_-]{1,20}$' or r ->> 'id' = any (v_ids)
       or length(trim(coalesce(r ->> 'label', ''))) not between 1 and 60
       or coalesce((r ->> 'price_delta_minor')::bigint, -1) not between 0 and 10000000
       or coalesce((r ->> 'count')::integer, 0) not between 1 and 500 then
      raise exception 'Each room choice needs a name, an extra price of $0 or more, and how many there are' using errcode = '22023';
    end if;
    v_ids := v_ids || (r ->> 'id');
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', r ->> 'id', 'label', trim(r ->> 'label'),
      'price_delta_minor', (r ->> 'price_delta_minor')::bigint, 'count', (r ->> 'count')::integer));
  end loop;
  update public.trip_offers set room_options = v_out where id = f.id returning * into f;
  return f;
end $$;

create function private.room_taken(p_offer uuid, p_option text) returns integer
language sql stable set search_path = '' as $$
  select count(*)::integer from public.bookings
  where offer_id = p_offer and room_option = p_option
    and (status in ('active', 'paid') or (status = 'pending' and created_at > now() - interval '35 minutes'))
$$;

-- A booking keeps the schedule it was made under; a room's extra price joins its last payment.
create or replace function private.booking_schedule() returns trigger
language plpgsql set search_path = '' as $$
declare
  f public.trip_offers;
  v_extra bigint;
  v_n integer;
begin
  select * into f from public.trip_offers where id = new.offer_id;
  new.schedule := coalesce(f.schedule, '[]');
  v_extra := new.price_minor - coalesce(f.price_minor, new.price_minor);
  v_n := jsonb_array_length(new.schedule);
  if v_extra > 0 and v_n > 0 then
    new.schedule := jsonb_set(new.schedule, array[(v_n - 1)::text, 'amount_minor'],
      to_jsonb((new.schedule -> (v_n - 1) ->> 'amount_minor')::bigint + v_extra));
  end if;
  return new;
end $$;

-- ─── Waitlist (Pro) ─────────────────────────────────────────────────────────

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.trip_offers (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status text not null default 'waiting' check (status in ('waiting', 'offered', 'booked', 'expired', 'left')),
  hold_token_hash text unique,
  offered_at timestamptz,
  hold_until timestamptz,
  booking_id uuid references public.bookings (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index waitlist_once on public.waitlist_entries (offer_id, email) where status in ('waiting', 'offered');
create index waitlist_queue on public.waitlist_entries (offer_id, status, created_at);
alter table public.waitlist_entries enable row level security;
create policy waitlist_select on public.waitlist_entries for select to authenticated
  using ((select private.can(trip_id, 'staff')));

-- Places taken: live bookings, checkouts in progress, and held waitlist places not yet turned into one.
create or replace function private.spots_taken(p_offer uuid) returns integer
language sql stable set search_path = '' as $$
  select (select count(*)::integer from public.bookings
          where offer_id = p_offer and (status in ('active', 'paid') or (status = 'pending' and created_at > now() - interval '35 minutes')))
       + (select count(*)::integer from public.waitlist_entries w
          where w.offer_id = p_offer and w.status = 'offered' and w.hold_until > now()
            and not exists (select 1 from public.bookings b where b.id = w.booking_id
                            and (b.status in ('active', 'paid') or (b.status = 'pending' and b.created_at > now() - interval '35 minutes'))))
$$;

create function public.join_waitlist(p_slug text, p_name text, p_email text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  f public.trip_offers;
  v_email text := lower(trim(p_email));
begin
  select * into f from public.trip_offers where slug = p_slug and status = 'published' and deleted_at is null;
  if f.id is null or not private.has_pro(f.organizer_id) then raise exception 'This trip has no waitlist' using errcode = 'P0002'; end if;
  if private.spots_taken(f.id) < f.capacity then raise exception 'There are places left. Book one now.' using errcode = 'P0002'; end if;
  if (select count(*) from public.waitlist_entries where offer_id = f.id and status = 'waiting') >= 500 then
    raise exception 'The waitlist is full' using errcode = 'P0002';
  end if;
  insert into public.waitlist_entries (offer_id, trip_id, name, email) values (f.id, f.trip_id, trim(p_name), v_email)
  on conflict (offer_id, email) where status in ('waiting', 'offered') do nothing;
  -- Your place in the queue (1 = next).
  return (select count(*)::integer from public.waitlist_entries w
          where w.offer_id = f.id and w.status = 'waiting'
            and w.created_at <= coalesce((select created_at from public.waitlist_entries where offer_id = f.id and email = v_email and status = 'waiting'), now()));
end $$;

-- Holds a place for one person for 48 hours and emails them a link that only they have.
create function private.offer_hold(p_entry uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  w public.waitlist_entries;
  f public.trip_offers;
  v_token text := private.new_share_token() || private.new_share_token();
begin
  update public.waitlist_entries set status = 'offered', offered_at = now(), hold_until = now() + interval '48 hours',
    hold_token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), updated_at = now()
  where id = p_entry and status = 'waiting' returning * into w;
  if w.id is null then return; end if;
  select * into f from public.trip_offers where id = w.offer_id;
  perform private.enqueue_email('waitlist:' || w.id || ':' || extract(epoch from w.offered_at)::bigint, w.email,
    (select support_email from public.organizers where id = f.organizer_id), 'waitlist_offer',
    jsonb_build_object('traveler_name', w.name, 'trip_name', f.title,
      'organizer', (select display_name from public.organizers where id = f.organizer_id),
      'hold_until', w.hold_until, 'timezone', (select timezone from public.trips where id = f.trip_id),
      'url', private.site_url() || '/go/' || f.slug || '#hold=' || v_token));
end $$;
revoke all on function private.offer_hold(uuid) from public;

-- Every minute: lapsed holds pass on, and free places go to the next people waiting.
create function private.waitlist_tick() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  f public.trip_offers;
  w record;
  v_free integer;
  v_offered integer := 0;
begin
  update public.waitlist_entries set status = 'expired', updated_at = now()
  where status = 'offered' and hold_until <= now()
    and not exists (select 1 from public.bookings b where b.id = booking_id and b.status in ('active', 'paid'));
  for f in select o.* from public.trip_offers o
           where o.status = 'published' and o.deleted_at is null
             and exists (select 1 from public.waitlist_entries e where e.offer_id = o.id and e.status = 'waiting') loop
    if not private.has_pro(f.organizer_id) then continue; end if;
    v_free := f.capacity - private.spots_taken(f.id);
    for w in select id from public.waitlist_entries where offer_id = f.id and status = 'waiting'
             order by created_at limit greatest(v_free, 0) loop
      perform private.offer_hold(w.id);
      v_offered := v_offered + 1;
    end loop;
  end loop;
  return v_offered;
end $$;
revoke all on function private.waitlist_tick() from public;

-- The organizer offers a free place now, or takes someone off the list.
create function public.offer_waitlist_place(p_entry uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  w public.waitlist_entries;
  f public.trip_offers;
begin
  select * into w from public.waitlist_entries where id = p_entry;
  if w.id is null or private.my_organizer_for(w.trip_id) is null then raise exception 'Only this trip''s organizer can do that' using errcode = '42501'; end if;
  select * into f from public.trip_offers where id = w.offer_id for update;
  perform private.require_pro(f.organizer_id);
  if private.spots_taken(f.id) >= f.capacity then
    raise exception 'The trip is full. Add a place (raise the number of travelers) first.' using errcode = 'P0002';
  end if;
  perform private.offer_hold(w.id);
end $$;

create function public.remove_waitlist_entry(p_entry uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.my_organizer_for((select trip_id from public.waitlist_entries where id = p_entry)) is null then
    raise exception 'Only this trip''s organizer can do that' using errcode = '42501';
  end if;
  update public.waitlist_entries set status = 'left', updated_at = now() where id = p_entry and status in ('waiting', 'offered');
end $$;

create or replace function private.payments_tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.waitlist_tick();
  if exists (select 1 from private.stripe_events where processed_at is null and attempts < 10
             and received_at < now() - interval '30 seconds') then
    perform private.call_function('stripe-process');
  end if;
  if exists (select 1 from private.email_outbox where sent_at is null and send_after <= now() and attempts < 5
             and (claimed_at is null or claimed_at < now() - interval '10 minutes')) then
    perform private.call_function('email-dispatch');
  end if;
end $$;

-- ─── Booking, with answers, a room, consent and a waitlist hold ────────────

drop function public.pay_reserve_booking(text, uuid, text, text, integer);
create function public.pay_reserve_booking(p_slug text, p_user uuid, p_name text, p_email text, p_policy_version integer,
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
    insert into public.bookings (trip_id, offer_id, organizer_id, traveler_name, traveler_email, price_minor, deposit_minor,
      balance_due_date, fee_mode, policy_version, policy_accepted_at, started_by_user, manage_token_hash,
      answers, marketing_consent, room_option)
    values (f.trip_id, f.id, o.id, trim(p_name), lower(trim(p_email)), v_price, least(f.deposit_minor, v_price), f.balance_due_date,
      f.fee_mode, f.policy_version, now(), p_user, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
      v_answers, coalesce((v_extra ->> 'consent')::boolean, false), v_room ->> 'id')
    returning * into v_booking;
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

-- ─── Traveler list (Pro) ────────────────────────────────────────────────────

create table public.organizer_contacts (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  email text not null,
  name text not null,
  trips integer not null default 0,
  total_paid_minor bigint not null default 0,
  last_trip_on date,
  tags text[] not null default '{}',
  notes text not null default '' check (length(notes) <= 2000),
  marketing_consent boolean not null default false,
  consent_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organizer_id, email)
);
alter table public.organizer_contacts enable row level security;
create policy organizer_contacts_select on public.organizer_contacts for select to authenticated
  using (exists (select 1 from public.organizers o where o.id = organizer_id and o.owner_user_id = (select auth.uid()))
         and private.has_pro(organizer_id));

-- Totals are recomputed from the organizer's bookings, so running it twice changes nothing.
create function private.refresh_contact(p_organizer uuid, p_email text) returns void
language sql security definer set search_path = '' as $$
  update public.organizer_contacts c set
    trips = s.trips, total_paid_minor = s.paid, last_trip_on = s.last_trip, updated_at = now()
  from (
    select count(distinct b.trip_id) filter (where b.status in ('active', 'paid'))::integer as trips,
      coalesce(sum(b.paid_minor - b.refunded_minor), 0)::bigint as paid,
      max(t.start_date) filter (where b.status in ('active', 'paid')) as last_trip
    from public.bookings b join public.trips t on t.id = b.trip_id
    where b.organizer_id = p_organizer and b.traveler_email = p_email and b.status in ('active', 'paid', 'refunded', 'cancelled')
  ) s
  where c.organizer_id = p_organizer and c.email = p_email
$$;
revoke all on function private.refresh_contact(uuid, text) from public;

create function private.contact_from_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  -- Consent comes only from the box on the booking form, when that booking is first paid.
  v_consent boolean := new.marketing_consent and old.status = 'pending' and new.status in ('active', 'paid');
begin
  if new.status not in ('active', 'paid', 'refunded', 'cancelled') then return null; end if;
  insert into public.organizer_contacts (organizer_id, email, name, marketing_consent, consent_at)
  values (new.organizer_id, new.traveler_email, new.traveler_name, v_consent, case when v_consent then now() end)
  on conflict (organizer_id, email) do update set
    name = excluded.name,
    marketing_consent = organizer_contacts.marketing_consent or excluded.marketing_consent,
    consent_at = case when excluded.marketing_consent then now() else organizer_contacts.consent_at end,
    unsubscribed_at = case when excluded.marketing_consent then null else organizer_contacts.unsubscribed_at end;
  perform private.refresh_contact(new.organizer_id, new.traveler_email);
  -- A held waitlist place that became a booking.
  if new.status in ('active', 'paid') then
    update public.waitlist_entries set status = 'booked', updated_at = now() where booking_id = new.id and status <> 'booked';
  end if;
  return null;
end $$;
create trigger contact_from_booking after update of status, paid_minor, refunded_minor on public.bookings
  for each row execute function private.contact_from_booking();

-- Everyone who has already booked.
insert into public.organizer_contacts (organizer_id, email, name)
select distinct on (organizer_id, traveler_email) organizer_id, traveler_email, traveler_name
from public.bookings where status in ('active', 'paid', 'refunded', 'cancelled')
order by organizer_id, traveler_email, created_at desc
on conflict do nothing;
do $$
declare r record;
begin
  for r in select organizer_id, email from public.organizer_contacts loop
    perform private.refresh_contact(r.organizer_id, r.email);
  end loop;
end $$;

create function public.save_contact(p_id uuid, p_tags text[], p_notes text) returns public.organizer_contacts
language plpgsql security definer set search_path = '' as $$
declare
  c public.organizer_contacts;
  v_tags text[];
begin
  select * into c from public.organizer_contacts where id = p_id;
  if c.id is null or not exists (select 1 from public.organizers where id = c.organizer_id and owner_user_id = (select auth.uid())) then
    raise exception 'Not your traveler list' using errcode = '42501';
  end if;
  perform private.require_pro(c.organizer_id);
  select coalesce(array_agg(distinct left(lower(trim(t)), 30)) filter (where trim(t) <> ''), '{}') into v_tags from unnest(coalesce(p_tags, '{}')) t;
  if cardinality(v_tags) > 10 then raise exception 'Up to 10 tags' using errcode = '22023'; end if;
  update public.organizer_contacts set tags = v_tags, notes = left(coalesce(p_notes, ''), 2000), updated_at = now()
  where id = p_id returning * into c;
  return c;
end $$;

-- ─── Rooming board (Pro): who sleeps where ──────────────────────────────────
-- One row per booking (id = stableId(trip, 'room', booking)). "Unassigned" is room_name null, never a
-- delete: people are moved back and forth, and deletes are sticky.

create table public.room_assignments (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  room_name text check (room_name is null or length(trim(room_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);
create trigger sync_guard before insert or update on public.room_assignments for each row execute function private.sync_guard();
create index room_assignments_sync_idx on public.room_assignments (trip_id, updated_at);
alter table public.room_assignments enable row level security;
create policy room_assignments_select on public.room_assignments for select to authenticated
  using ((select private.can(trip_id, 'staff')));
create policy room_assignments_insert on public.room_assignments for insert to authenticated
  with check ((select private.can(trip_id, 'staff')) and private.has_pro((select organizer_id from public.trips where id = trip_id))
              and exists (select 1 from public.bookings b where b.id = booking_id and b.trip_id = room_assignments.trip_id));
create policy room_assignments_update on public.room_assignments for update to authenticated
  using ((select private.can(trip_id, 'staff')))
  with check ((select private.can(trip_id, 'staff')) and private.has_pro((select organizer_id from public.trips where id = trip_id)));
alter publication supabase_realtime add table public.room_assignments;

-- ─── What the public pages show ─────────────────────────────────────────────

create or replace function public.get_public_offer(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', f.slug, 'title', f.title, 'summary', f.summary, 'currency', f.currency,
    'price_minor', f.price_minor, 'deposit_minor', f.deposit_minor, 'balance_due_date', f.balance_due_date,
    'fee_mode', f.fee_mode, 'allow_bank', f.allow_bank,
    'cancellation_policy', f.cancellation_policy, 'policy_version', f.policy_version,
    'schedule', f.schedule, 'refund_tiers', f.refund_tiers, 'questions', f.questions,
    'rooms', coalesce((select jsonb_agg(r.value || jsonb_build_object('left', greatest(0, (r.value ->> 'count')::integer - private.room_taken(f.id, r.value ->> 'id'))) order by r.ordinality)
                       from jsonb_array_elements(f.room_options) with ordinality r), '[]'),
    'spots_left', greatest(0, f.capacity - private.spots_taken(f.id)),
    'waitlist', private.has_pro(f.organizer_id),
    'trip', jsonb_build_object('name', t.name, 'start_date', t.start_date, 'end_date', t.end_date, 'timezone', t.timezone),
    'organizer', jsonb_build_object('name', o.display_name, 'email', o.support_email),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('date', d.day, 'items', d.items) order by d.day)
      from (
        select i.start_local::date as day, jsonb_agg(i.title order by i.start_local) as items
        from public.itinerary_items i
        where i.trip_id = t.id and i.deleted_at is null and i.status <> 'cancelled' and i.kind <> 'free'
        group by 1 order by 1 limit 30
      ) d), '[]')
  )
  from public.trip_offers f
  join public.trips t on t.id = f.trip_id and t.deleted_at is null
  join public.organizers o on o.id = f.organizer_id and o.reviewed_at is not null
  where f.slug = p_slug and f.status = 'published' and f.deleted_at is null
$$;

-- Who holds a waitlist place, from the link in their email (the trip page greets them).
create function public.get_hold(p_slug text, p_hold text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', w.name, 'email', w.email, 'hold_until', w.hold_until)
  from public.waitlist_entries w join public.trip_offers f on f.id = w.offer_id
  where f.slug = p_slug and w.hold_token_hash = encode(sha256(convert_to(p_hold, 'UTF8')), 'hex')
    and w.status = 'offered' and w.hold_until > now()
$$;

create or replace function public.get_booking(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', b.id, 'status', b.status, 'trip_id', b.trip_id, 'traveler_name', b.traveler_name,
    'price_minor', b.price_minor, 'deposit_minor', b.deposit_minor, 'paid_minor', b.paid_minor,
    'refunded_minor', b.refunded_minor, 'balance_due_date', b.balance_due_date, 'fee_mode', b.fee_mode,
    'schedule', b.schedule, 'next_minor', (private.booking_due(b) ->> 'next_minor')::bigint, 'next_date', private.booking_due(b) ->> 'next_date',
    'answers', b.answers, 'room_option', b.room_option,
    'offer', jsonb_build_object('slug', f.slug, 'title', f.title, 'allow_bank', f.allow_bank, 'status', f.status,
      'refund_tiers', f.refund_tiers, 'questions', f.questions, 'room_options', f.room_options),
    'organizer', jsonb_build_object('name', o.display_name, 'email', o.support_email),
    'processing', exists (select 1 from public.booking_payments p where p.booking_id = b.id and p.status = 'processing')
  )
  from public.bookings b join public.trip_offers f on f.id = b.offer_id join public.organizers o on o.id = b.organizer_id
  where b.manage_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

revoke execute on function public.save_offer_questions(uuid, jsonb), public.update_booking_answers(text, jsonb),
  public.save_room_options(uuid, jsonb), public.join_waitlist(text, text, text), public.offer_waitlist_place(uuid),
  public.remove_waitlist_entry(uuid), public.save_contact(uuid, text[], text), public.get_hold(text, text) from public;
grant execute on function public.update_booking_answers(text, jsonb), public.join_waitlist(text, text, text),
  public.get_hold(text, text) to anon, authenticated;
grant execute on function public.save_offer_questions(uuid, jsonb), public.save_room_options(uuid, jsonb),
  public.offer_waitlist_place(uuid), public.remove_waitlist_entry(uuid), public.save_contact(uuid, text[], text) to authenticated;

notify pgrst, 'reload schema';
