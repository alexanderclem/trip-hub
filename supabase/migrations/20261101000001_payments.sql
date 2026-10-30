-- Collecting payments (docs/PLAN_THE_SWITCH.md, section 4; runbook docs/PAYMENTS.md).
--
-- Facilitator model: each organizer connects their own Stripe account, every charge is a direct
-- charge on it, and Stowaway takes a flat 1% application fee. Stowaway never holds money. Stripe is
-- the system of record; these tables mirror it, and the ledger can be rebuilt from Stripe.
--
-- Writes to everything here happen only in the pay_* functions, which only the service role (the
-- Edge Functions) may call. The app reads offers, bookings and payments through RLS; travelers see
-- their own booking, organizers see their trips' bookings.

alter table public.organizers
  -- Stowaway checks each new organizer before their first trip page goes live.
  add column reviewed_at timestamptz,
  -- Most an organizer may collect before a second check (cents).
  add column collect_limit_minor bigint not null default 2500000;

-- ─── Stripe accounts and payouts (mirrors) ──────────────────────────────────

create table public.stripe_accounts (
  organizer_id uuid primary key references public.organizers (id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  requirements jsonb not null default '{}',
  disabled_reason text,
  payout_schedule jsonb not null default '{}',
  country text,
  default_currency text,
  disconnected_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.stripe_accounts enable row level security;
create policy stripe_accounts_select on public.stripe_accounts for select to authenticated
  using (exists (select 1 from public.organizers o where o.id = organizer_id and o.owner_user_id = (select auth.uid())));

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  stripe_payout_id text not null unique,
  amount_minor bigint not null,
  currency text not null,
  arrival_date date,
  status text not null,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payouts_organizer_idx on public.payouts (organizer_id, arrival_date desc);
alter table public.payouts enable row level security;
create policy payouts_select on public.payouts for select to authenticated
  using (exists (select 1 from public.organizers o where o.id = organizer_id and o.owner_user_id = (select auth.uid())));

-- ─── Offers, bookings, payments (synced to phones) ──────────────────────────

create table public.trip_offers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references public.trips (id) on delete cascade,
  organizer_id uuid not null references public.organizers (id),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  title text not null check (length(trim(title)) between 1 and 120),
  summary text not null default '' check (length(summary) <= 2000),
  currency text not null default 'usd' check (currency = 'usd'),
  price_minor bigint not null check (price_minor between 100 and 10000000),
  deposit_minor bigint not null default 0 check (deposit_minor >= 0),
  balance_due_date date,
  capacity integer not null check (capacity between 1 and 1000),
  cancellation_policy text not null check (length(trim(cancellation_policy)) between 1 and 4000),
  policy_version integer not null default 1,
  fee_mode text not null default 'absorb' check (fee_mode in ('absorb', 'pass')),
  allow_bank boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  check (deposit_minor < price_minor),
  check (deposit_minor = 0 or balance_due_date is not null)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  offer_id uuid not null references public.trip_offers (id),
  organizer_id uuid not null references public.organizers (id),
  member_id uuid references public.members (id),
  traveler_name text not null check (length(trim(traveler_name)) between 1 and 40),
  traveler_email text not null check (traveler_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status text not null default 'pending' check (status in ('pending', 'active', 'paid', 'cancelled', 'refunded', 'expired')),
  price_minor bigint not null,
  deposit_minor bigint not null,
  paid_minor bigint not null default 0,
  refunded_minor bigint not null default 0,
  balance_due_date date,
  fee_mode text not null,
  policy_version integer not null,
  policy_accepted_at timestamptz not null,
  started_by_user uuid,
  manage_token_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);
create index bookings_offer_idx on public.bookings (offer_id, status);

-- The booking's private link, for emails. Server-only (like trips.share_token, it is a bearer link).
create table private.booking_tokens (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  token text not null
);
alter table private.booking_tokens enable row level security;

create table public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  booking_id uuid not null references public.bookings (id),
  kind text not null check (kind in ('deposit', 'balance', 'full')),
  base_minor bigint not null check (base_minor > 0),
  charged_minor bigint not null check (charged_minor >= base_minor),
  application_fee_minor bigint not null check (application_fee_minor >= 0),
  stripe_fee_minor bigint,
  refunded_minor bigint not null default 0,
  application_fee_refunded_minor bigint not null default 0,
  status text not null default 'open' check (status in ('open', 'processing', 'succeeded', 'failed', 'expired', 'refunded', 'partially_refunded', 'disputed')),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  stripe_charge_id text unique,
  stripe_application_fee_id text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);
create index booking_payments_booking_idx on public.booking_payments (booking_id);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id),
  payment_id uuid references public.booking_payments (id),
  stripe_dispute_id text not null unique,
  amount_minor bigint not null,
  reason text,
  status text not null,
  evidence_due_by timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.disputes enable row level security;
create policy disputes_select on public.disputes for select to authenticated
  using (exists (select 1 from public.organizers o where o.id = organizer_id and o.owner_user_id = (select auth.uid())));

do $$
declare t text;
begin
  foreach t in array array['trip_offers', 'bookings', 'booking_payments'] loop
    execute format('create trigger sync_guard before insert or update on public.%I for each row execute function private.sync_guard()', t);
    execute format('create index %I on public.%I (trip_id, updated_at)', t || '_sync_idx', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Is this phone the traveler on this booking?
create function private.my_booking(p_booking uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking
      and (b.started_by_user = (select auth.uid()) or (b.member_id is not null and private.claims_member(b.trip_id, b.member_id)))
  )
$$;
revoke all on function private.my_booking(uuid) from public;
grant execute on function private.my_booking(uuid) to authenticated;

-- Everyone on the trip sees the offer (price, policy); bookings and payments are the traveler's own
-- or the organizers'. Nobody writes them directly: only the pay_* functions do.
create policy trip_offers_select on public.trip_offers for select to authenticated
  using ((select private.has_trip_access(trip_id)));
create policy bookings_select on public.bookings for select to authenticated
  using ((select private.can(trip_id, 'staff')) or private.my_booking(id));
create policy booking_payments_select on public.booking_payments for select to authenticated
  using ((select private.can(trip_id, 'staff')) or private.my_booking(booking_id));

alter publication supabase_realtime add table public.trip_offers, public.bookings, public.booking_payments;

-- ─── Ledger (append-only; every transaction sums to zero) ───────────────────
-- Signed amounts in cents: positive is a debit, negative a credit.
--   payment succeeded: + operator_stripe_balance (net), + stripe_fees, + stowaway_fees,
--                      - traveler_receivable (trip price part), - booking_fee_income (pass mode)
--   refund:            - operator_stripe_balance (refund less our returned fee), - stowaway_fees
--                      (returned), + refunds
--   payout paid:       + operator_bank, - operator_stripe_balance

create table private.ledger_entries (
  id bigint generated always as identity primary key,
  txn_id uuid not null,
  organizer_id uuid not null,
  trip_id uuid,
  booking_id uuid,
  account text not null check (account in ('operator_stripe_balance', 'operator_bank', 'stripe_fees', 'stowaway_fees',
    'traveler_receivable', 'booking_fee_income', 'refunds')),
  amount_minor bigint not null,
  currency text not null default 'usd',
  source text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index ledger_entries_txn_idx on private.ledger_entries (txn_id);
create unique index ledger_entries_source_idx on private.ledger_entries (source, account);
alter table private.ledger_entries enable row level security;

create function private.ledger_balanced() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select coalesce(sum(amount_minor), 0) from private.ledger_entries where txn_id = new.txn_id) <> 0 then
    raise exception 'Ledger transaction % does not balance', new.txn_id using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger ledger_balanced after insert on private.ledger_entries
  deferrable initially deferred for each row execute function private.ledger_balanced();

-- Posts one balanced transaction. `source` makes posting idempotent: a source posts once.
create function private.post(p_source text, p_organizer uuid, p_trip uuid, p_booking uuid, p_lines jsonb) returns void
language plpgsql set search_path = '' as $$
declare v_txn uuid := gen_random_uuid(); l jsonb;
begin
  if exists (select 1 from private.ledger_entries where source = p_source) then return; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    if (l ->> 'amount')::bigint <> 0 then
      insert into private.ledger_entries (txn_id, organizer_id, trip_id, booking_id, account, amount_minor, source)
      values (v_txn, p_organizer, p_trip, p_booking, l ->> 'account', (l ->> 'amount')::bigint, p_source);
    end if;
  end loop;
end $$;

-- ─── Webhook inbox and email outbox ─────────────────────────────────────────

create table private.stripe_events (
  id text primary key,
  account text,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create index stripe_events_pending_idx on private.stripe_events (received_at) where processed_at is null;
alter table private.stripe_events enable row level security;

create table private.email_outbox (
  id bigint generated always as identity primary key,
  dedupe_key text not null unique,
  to_email text not null,
  reply_to text,
  template text not null,
  data jsonb not null default '{}',
  send_after timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create index email_outbox_pending_idx on private.email_outbox (send_after) where sent_at is null;
alter table private.email_outbox enable row level security;

create function private.enqueue_email(p_key text, p_to text, p_reply_to text, p_template text, p_data jsonb, p_after timestamptz default now()) returns void
language sql set search_path = '' as $$
  insert into private.email_outbox (dedupe_key, to_email, reply_to, template, data, send_after)
  values (p_key, p_to, p_reply_to, p_template, p_data, p_after) on conflict (dedupe_key) do nothing
$$;

-- ─── Organizer RPCs (the app) ───────────────────────────────────────────────

create function private.offer_slug(p_name text, p_except uuid) returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_base text := left(coalesce(nullif(trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g')), ''), 'trip'), 60);
  v_slug text := v_base;
begin
  while exists (select 1 from public.trip_offers where slug = v_slug and id is distinct from p_except) loop
    v_slug := v_base || '-' || substr(md5(random()::text), 1, 5);
  end loop;
  return v_slug;
end $$;

-- The caller's organizer profile, when they organize this trip.
create function private.my_organizer_for(p_trip uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select o.id from public.organizers o join public.trips t on t.organizer_id = o.id
  where t.id = p_trip and o.owner_user_id = (select auth.uid()) and private.can(p_trip, 'staff')
$$;

-- Creates or updates the trip's offer. Changing the cancellation policy starts a new version, which
-- new travelers accept; earlier bookings keep the version they accepted.
create function public.save_offer(
  p_trip_id uuid, p_title text, p_summary text, p_price_minor bigint, p_deposit_minor bigint,
  p_balance_due_date date, p_capacity integer, p_cancellation_policy text, p_fee_mode text, p_allow_bank boolean
) returns public.trip_offers
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.my_organizer_for(p_trip_id);
  v_row public.trip_offers;
begin
  if v_org is null then
    raise exception 'Only this trip''s organizer can set up payments' using errcode = '42501';
  end if;
  if p_deposit_minor > 0 and p_balance_due_date is null then
    raise exception 'Choose when the balance is due' using errcode = '22023';
  end if;
  if p_deposit_minor >= p_price_minor then
    raise exception 'The deposit must be less than the trip price' using errcode = '22023';
  end if;
  select * into v_row from public.trip_offers where trip_id = p_trip_id;
  if v_row.id is null then
    insert into public.trip_offers (trip_id, organizer_id, slug, title, summary, price_minor, deposit_minor, balance_due_date,
      capacity, cancellation_policy, fee_mode, allow_bank)
    values (p_trip_id, v_org, private.offer_slug(p_title, null), trim(p_title), coalesce(p_summary, ''), p_price_minor,
      p_deposit_minor, p_balance_due_date, p_capacity, trim(p_cancellation_policy), p_fee_mode, coalesce(p_allow_bank, false))
    returning * into v_row;
  else
    update public.trip_offers set
      title = trim(p_title), summary = coalesce(p_summary, ''), price_minor = p_price_minor, deposit_minor = p_deposit_minor,
      balance_due_date = p_balance_due_date, capacity = p_capacity, fee_mode = p_fee_mode, allow_bank = coalesce(p_allow_bank, false),
      policy_version = case when cancellation_policy = trim(p_cancellation_policy) then policy_version else policy_version + 1 end,
      cancellation_policy = trim(p_cancellation_policy)
    where id = v_row.id returning * into v_row;
  end if;
  return v_row;
end $$;

-- Publish, pause or close the trip page. Publishing needs a Stripe account that can take payments.
create function public.set_offer_status(p_trip_id uuid, p_status text) returns public.trip_offers
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.my_organizer_for(p_trip_id);
  v_row public.trip_offers;
begin
  if v_org is null then
    raise exception 'Only this trip''s organizer can change its page' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'published', 'closed') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  if p_status = 'published' and not exists (select 1 from public.stripe_accounts where organizer_id = v_org and charges_enabled and disconnected_at is null) then
    raise exception 'Finish connecting Stripe before publishing' using errcode = '42501';
  end if;
  update public.trip_offers set status = p_status,
    published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end
  where trip_id = p_trip_id returning * into v_row;
  if v_row.id is null then
    raise exception 'Set up the trip''s price first' using errcode = 'P0002';
  end if;
  return v_row;
end $$;

revoke execute on function public.save_offer(uuid, text, text, bigint, bigint, date, integer, text, text, boolean),
  public.set_offer_status(uuid, text) from public, anon;
grant execute on function public.save_offer(uuid, text, text, bigint, bigint, date, integer, text, text, boolean),
  public.set_offer_status(uuid, text) to authenticated;

-- ─── Public pages (no sign-in) ──────────────────────────────────────────────

create function private.spots_taken(p_offer uuid) returns integer
language sql stable set search_path = '' as $$
  select count(*)::integer from public.bookings
  where offer_id = p_offer and (status in ('active', 'paid') or (status = 'pending' and created_at > now() - interval '35 minutes'))
$$;

-- What the trip page shows: published offers of checked organizers only, and nothing private.
create function public.get_public_offer(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', f.slug, 'title', f.title, 'summary', f.summary, 'currency', f.currency,
    'price_minor', f.price_minor, 'deposit_minor', f.deposit_minor, 'balance_due_date', f.balance_due_date,
    'fee_mode', f.fee_mode, 'allow_bank', f.allow_bank,
    'cancellation_policy', f.cancellation_policy, 'policy_version', f.policy_version,
    'spots_left', greatest(0, f.capacity - private.spots_taken(f.id)),
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

-- A booking seen through its private link: what is paid and what is still due.
create function public.get_booking(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', b.id, 'status', b.status, 'trip_id', b.trip_id, 'traveler_name', b.traveler_name,
    'price_minor', b.price_minor, 'deposit_minor', b.deposit_minor, 'paid_minor', b.paid_minor,
    'refunded_minor', b.refunded_minor, 'balance_due_date', b.balance_due_date, 'fee_mode', b.fee_mode,
    'offer', jsonb_build_object('slug', f.slug, 'title', f.title, 'allow_bank', f.allow_bank, 'status', f.status),
    'organizer', jsonb_build_object('name', o.display_name, 'email', o.support_email),
    'processing', exists (select 1 from public.booking_payments p where p.booking_id = b.id and p.status = 'processing')
  )
  from public.bookings b join public.trip_offers f on f.id = b.offer_id join public.organizers o on o.id = b.organizer_id
  where b.manage_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

revoke execute on function public.get_public_offer(text), public.get_booking(text) from public;
grant execute on function public.get_public_offer(text), public.get_booking(text) to anon, authenticated;

-- ─── Server-only state changes (Edge Functions, service role) ───────────────

-- Holds a place for a traveler and returns what checkout needs, with the booking's private token.
-- Locks the offer so two travelers can't take the last spot.
create function public.pay_reserve_booking(p_slug text, p_user uuid, p_name text, p_email text, p_policy_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  f public.trip_offers;
  o public.organizers;
  a public.stripe_accounts;
  v_token text := private.new_share_token() || private.new_share_token();
  v_booking public.bookings;
  v_collected bigint;
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
  select coalesce(sum(p.charged_minor - p.refunded_minor), 0) into v_collected
  from public.booking_payments p join public.bookings b on b.id = p.booking_id
  where b.organizer_id = o.id and p.status in ('succeeded', 'partially_refunded', 'processing');
  if v_collected + f.price_minor > o.collect_limit_minor then
    raise exception 'This organizer has reached their booking limit for now. Contact them directly.' using errcode = 'P0002';
  end if;
  -- The same person trying again within the hold reuses their place.
  select * into v_booking from public.bookings
  where offer_id = f.id and started_by_user = p_user and status = 'pending' and created_at > now() - interval '35 minutes'
  order by created_at desc limit 1;
  if v_booking.id is null then
    if private.spots_taken(f.id) >= f.capacity then raise exception 'This trip is full' using errcode = 'P0002'; end if;
    insert into public.bookings (trip_id, offer_id, organizer_id, traveler_name, traveler_email, price_minor, deposit_minor,
      balance_due_date, fee_mode, policy_version, policy_accepted_at, started_by_user, manage_token_hash)
    values (f.trip_id, f.id, o.id, trim(p_name), lower(trim(p_email)), f.price_minor, f.deposit_minor, f.balance_due_date,
      f.fee_mode, f.policy_version, now(), p_user, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
    returning * into v_booking;
    insert into private.booking_tokens (booking_id, token) values (v_booking.id, v_token);
  else
    update public.bookings set traveler_name = trim(p_name), traveler_email = lower(trim(p_email)), policy_accepted_at = now(),
      manage_token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex')
    where id = v_booking.id returning * into v_booking;
    insert into private.booking_tokens (booking_id, token) values (v_booking.id, v_token)
    on conflict (booking_id) do update set token = excluded.token;
  end if;
  return jsonb_build_object('booking_id', v_booking.id, 'manage_token', v_token, 'trip_id', f.trip_id, 'title', f.title,
    'slug', f.slug, 'stripe_account_id', a.stripe_account_id, 'price_minor', f.price_minor, 'deposit_minor', f.deposit_minor,
    'fee_mode', f.fee_mode, 'allow_bank', f.allow_bank, 'traveler_email', v_booking.traveler_email);
end $$;

-- What a booking still owes, from its private token (for the balance checkout).
create function public.pay_booking_due(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('booking_id', b.id, 'trip_id', b.trip_id, 'status', b.status, 'title', f.title, 'slug', f.slug,
    'due_minor', greatest(0, b.price_minor - b.paid_minor), 'paid_minor', b.paid_minor, 'fee_mode', b.fee_mode,
    'allow_bank', f.allow_bank, 'stripe_account_id', a.stripe_account_id, 'traveler_email', b.traveler_email,
    'open', exists (select 1 from public.booking_payments p where p.booking_id = b.id and p.status in ('open', 'processing') and (p.expires_at is null or p.expires_at > now())))
  from public.bookings b join public.trip_offers f on f.id = b.offer_id
  join public.stripe_accounts a on a.organizer_id = b.organizer_id and a.charges_enabled and a.disconnected_at is null
  where b.manage_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') and b.status in ('active', 'pending')
$$;

create function public.pay_open_payment(p_booking uuid, p_kind text, p_base bigint, p_charged bigint, p_app_fee bigint,
  p_session_id text, p_expires_at timestamptz) returns void
language sql security definer set search_path = '' as $$
  insert into public.booking_payments (trip_id, booking_id, kind, base_minor, charged_minor, application_fee_minor, stripe_checkout_session_id, expires_at)
  select trip_id, id, p_kind, p_base, p_charged, p_app_fee, p_session_id, p_expires_at from public.bookings where id = p_booking
  on conflict (stripe_checkout_session_id) do nothing
$$;

-- A payment went through. Idempotent: a second call changes nothing. Activates the booking, puts the
-- traveler on the trip (their phone joins as a traveler), posts the ledger and queues the emails.
create function public.pay_payment_succeeded(p_session_id text, p_payment_intent text, p_charge text, p_stripe_fee bigint,
  p_application_fee_id text, p_paid_at timestamptz, p_site text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.booking_payments;
  b public.bookings;
  t public.trips;
  o public.organizers;
  v_member uuid;
  v_role text;
  v_token text;
begin
  select * into p from public.booking_payments where stripe_checkout_session_id = p_session_id for update;
  if p.id is null then raise exception 'Unknown checkout session %', p_session_id using errcode = 'P0002'; end if;
  if p.status in ('succeeded', 'refunded', 'partially_refunded', 'disputed') then
    return jsonb_build_object('booking_id', p.booking_id, 'trip_id', p.trip_id, 'already', true);
  end if;
  update public.booking_payments set status = 'succeeded', stripe_payment_intent_id = p_payment_intent, stripe_charge_id = p_charge,
    stripe_fee_minor = p_stripe_fee, stripe_application_fee_id = p_application_fee_id, paid_at = p_paid_at
  where id = p.id;
  select * into b from public.bookings where id = p.booking_id for update;
  select * into t from public.trips where id = b.trip_id;
  select * into o from public.organizers where id = b.organizer_id;
  update public.bookings set paid_minor = paid_minor + p.base_minor,
    status = case when paid_minor + p.base_minor >= price_minor then 'paid' else 'active' end
  where id = b.id returning * into b;

  -- The traveler joins the trip, as a traveler in a hosted trip.
  if b.member_id is null then
    v_member := gen_random_uuid();
    insert into public.members (id, trip_id, display_name, created_by, updated_by) values (v_member, b.trip_id, b.traveler_name, v_member, v_member);
    update public.bookings set member_id = v_member where id = b.id;
    if b.started_by_user is not null and exists (select 1 from auth.users where id = b.started_by_user) then
      v_role := case when t.access_mode = 'hosted' then 'traveler' else 'member' end;
      insert into public.trip_devices (trip_id, user_id, member_id, role) values (b.trip_id, b.started_by_user, v_member, v_role)
      on conflict (trip_id, user_id) do update set member_id = coalesce(public.trip_devices.member_id, excluded.member_id),
        role = case when public.trip_devices.role = 'pending' then excluded.role else public.trip_devices.role end;
    end if;
  end if;

  perform private.post('payment:' || p.id, b.organizer_id, b.trip_id, b.id, jsonb_build_array(
    jsonb_build_object('account', 'operator_stripe_balance', 'amount', p.charged_minor - coalesce(p_stripe_fee, 0) - p.application_fee_minor),
    jsonb_build_object('account', 'stripe_fees', 'amount', coalesce(p_stripe_fee, 0)),
    jsonb_build_object('account', 'stowaway_fees', 'amount', p.application_fee_minor),
    jsonb_build_object('account', 'traveler_receivable', 'amount', -p.base_minor),
    jsonb_build_object('account', 'booking_fee_income', 'amount', -(p.charged_minor - p.base_minor))));

  perform private.enqueue_email('paid:' || p.id || ':traveler', b.traveler_email, o.support_email, 'payment_received', jsonb_build_object(
    'traveler_name', b.traveler_name, 'trip_name', t.name, 'organizer', o.display_name, 'amount_minor', p.charged_minor,
    'kind', p.kind, 'paid_minor', b.paid_minor, 'price_minor', b.price_minor, 'balance_due_date', b.balance_due_date,
    'trip_url', p_site || '/t/' || b.trip_id || '/overview',
    'manage_url', p_site || '/b/' || (select token from private.booking_tokens where booking_id = b.id)));
  perform private.enqueue_email('paid:' || p.id || ':organizer', o.support_email, null, 'organizer_payment', jsonb_build_object(
    'traveler_name', b.traveler_name, 'trip_name', t.name, 'amount_minor', p.charged_minor, 'kind', p.kind,
    'paid_minor', b.paid_minor, 'price_minor', b.price_minor));
  return jsonb_build_object('booking_id', b.id, 'trip_id', b.trip_id, 'already', false);
end $$;

-- A checkout that is waiting on the bank (processing), failed, or expired. Expired pending bookings
-- give their place back.
create function public.pay_payment_closed(p_session_id text, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.booking_payments;
begin
  if p_status not in ('processing', 'failed', 'expired') then raise exception 'Unknown status' using errcode = '22023'; end if;
  select * into p from public.booking_payments where stripe_checkout_session_id = p_session_id for update;
  if p.id is null or p.status not in ('open', 'processing') then return; end if;
  update public.booking_payments set status = p_status where id = p.id;
  if p_status in ('failed', 'expired') then
    update public.bookings set status = 'expired' where id = p.booking_id and status = 'pending'
      and not exists (select 1 from public.booking_payments x where x.booking_id = p.booking_id and x.status in ('open', 'processing') and x.id <> p.id);
  end if;
end $$;

-- A charge was refunded (in full or in part, by the organizer in Stripe). Records it, posts the
-- ledger, and returns how much of our 1% to give back now (the caller refunds it at Stripe).
create function public.pay_payment_refunded(p_charge text, p_refunded_total bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.booking_payments;
  v_delta bigint;
  v_fee_target bigint;
  v_fee_delta bigint;
begin
  select * into p from public.booking_payments where stripe_charge_id = p_charge for update;
  if p.id is null then raise exception 'Unknown charge %', p_charge using errcode = 'P0002'; end if;
  v_delta := least(p_refunded_total, p.charged_minor) - p.refunded_minor;
  v_fee_target := round(p.application_fee_minor::numeric * least(p_refunded_total, p.charged_minor) / p.charged_minor);
  if v_delta > 0 then
    v_fee_delta := v_fee_target - round(p.application_fee_minor::numeric * p.refunded_minor / p.charged_minor);
    update public.booking_payments set refunded_minor = refunded_minor + v_delta,
      status = case when refunded_minor + v_delta >= charged_minor then 'refunded' else 'partially_refunded' end
    where id = p.id;
    update public.bookings set refunded_minor = refunded_minor + v_delta,
      status = case when refunded_minor + v_delta >= paid_minor then 'refunded' else status end
    where id = p.booking_id;
    perform private.post('refund:' || p.id || ':' || (p.refunded_minor + v_delta), (select organizer_id from public.bookings where id = p.booking_id),
      p.trip_id, p.booking_id, jsonb_build_array(
        jsonb_build_object('account', 'operator_stripe_balance', 'amount', -(v_delta - v_fee_delta)),
        jsonb_build_object('account', 'stowaway_fees', 'amount', -v_fee_delta),
        jsonb_build_object('account', 'refunds', 'amount', v_delta)));
  end if;
  return jsonb_build_object('application_fee_id', p.stripe_application_fee_id,
    'fee_refund_due', greatest(0, v_fee_target - p.application_fee_refunded_minor), 'fee_refund_total', v_fee_target);
end $$;

create function public.pay_application_fee_refunded(p_charge text, p_fee_refunded_total bigint) returns void
language sql security definer set search_path = '' as $$
  update public.booking_payments set application_fee_refunded_minor = greatest(application_fee_refunded_minor, p_fee_refunded_total)
  where stripe_charge_id = p_charge
$$;

create function public.pay_upsert_account(p_organizer uuid, p_account_id text, p_charges boolean, p_payouts boolean, p_details boolean,
  p_requirements jsonb, p_disabled_reason text, p_schedule jsonb, p_country text, p_currency text) returns void
language sql security definer set search_path = '' as $$
  insert into public.stripe_accounts (organizer_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted,
    requirements, disabled_reason, payout_schedule, country, default_currency)
  values (coalesce(p_organizer, (select organizer_id from public.stripe_accounts where stripe_account_id = p_account_id)),
    p_account_id, p_charges, p_payouts, p_details, coalesce(p_requirements, '{}'), p_disabled_reason, coalesce(p_schedule, '{}'), p_country, p_currency)
  on conflict (stripe_account_id) do update set charges_enabled = excluded.charges_enabled, payouts_enabled = excluded.payouts_enabled,
    details_submitted = excluded.details_submitted, requirements = excluded.requirements, disabled_reason = excluded.disabled_reason,
    payout_schedule = excluded.payout_schedule, country = excluded.country, default_currency = excluded.default_currency,
    disconnected_at = null, updated_at = now()
$$;

create function public.pay_account_disconnected(p_account_id text) returns void
language sql security definer set search_path = '' as $$
  update public.stripe_accounts set disconnected_at = now(), charges_enabled = false, payouts_enabled = false, updated_at = now()
  where stripe_account_id = p_account_id
$$;

-- Payouts from the organizer's Stripe balance to their bank. A paid payout posts to the ledger; a
-- failed one emails the organizer.
create function public.pay_upsert_payout(p_account_id text, p_payout_id text, p_amount bigint, p_currency text, p_arrival date,
  p_status text, p_failure_code text, p_failure_message text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := (select organizer_id from public.stripe_accounts where stripe_account_id = p_account_id);
begin
  if v_org is null then return; end if;
  insert into public.payouts (organizer_id, stripe_payout_id, amount_minor, currency, arrival_date, status, failure_code, failure_message)
  values (v_org, p_payout_id, p_amount, p_currency, p_arrival, p_status, p_failure_code, p_failure_message)
  on conflict (stripe_payout_id) do update set amount_minor = excluded.amount_minor, arrival_date = excluded.arrival_date,
    status = excluded.status, failure_code = excluded.failure_code, failure_message = excluded.failure_message, updated_at = now();
  if p_status = 'paid' then
    perform private.post('payout:' || p_payout_id, v_org, null, null, jsonb_build_array(
      jsonb_build_object('account', 'operator_bank', 'amount', p_amount),
      jsonb_build_object('account', 'operator_stripe_balance', 'amount', -p_amount)));
  elsif p_status = 'failed' then
    perform private.enqueue_email('payout-failed:' || p_payout_id, o.support_email, null, 'payout_failed',
      jsonb_build_object('amount_minor', p_amount, 'arrival_date', p_arrival, 'reason', coalesce(p_failure_message, p_failure_code)))
    from public.organizers o where o.id = v_org;
  end if;
end $$;

create function public.pay_record_dispute(p_charge text, p_dispute_id text, p_amount bigint, p_reason text, p_status text, p_due_by timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.booking_payments; v_org uuid;
begin
  select * into p from public.booking_payments where stripe_charge_id = p_charge;
  if p.id is null then return; end if;
  v_org := (select organizer_id from public.bookings where id = p.booking_id);
  insert into public.disputes (organizer_id, payment_id, stripe_dispute_id, amount_minor, reason, status, evidence_due_by)
  values (v_org, p.id, p_dispute_id, p_amount, p_reason, p_status, p_due_by)
  on conflict (stripe_dispute_id) do update set status = excluded.status, evidence_due_by = excluded.evidence_due_by, updated_at = now();
  if p_status in ('needs_response', 'warning_needs_response') then
    update public.booking_payments set status = 'disputed' where id = p.id;
    perform private.enqueue_email('dispute:' || p_dispute_id, o.support_email, null, 'dispute_opened',
      jsonb_build_object('traveler_name', b.traveler_name, 'amount_minor', p_amount, 'due_by', p_due_by, 'reason', p_reason))
    from public.organizers o, public.bookings b where o.id = v_org and b.id = p.booking_id;
  end if;
end $$;

-- Webhook inbox: returns true for an event seen for the first time.
create function public.pay_inbox_add(p_event_id text, p_account text, p_type text, p_payload jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.stripe_events (id, account, type, payload) values (p_event_id, p_account, p_type, p_payload);
  return true;
exception when unique_violation then
  return false;
end $$;

create function public.pay_inbox_next(p_limit integer default 20) returns setof private.stripe_events
language sql security definer set search_path = '' as $$
  update private.stripe_events set attempts = attempts + 1
  where id in (select id from private.stripe_events where processed_at is null and attempts < 10 order by received_at limit p_limit for update skip locked)
  returning *
$$;

create function public.pay_inbox_done(p_event_id text, p_error text default null) returns void
language sql security definer set search_path = '' as $$
  update private.stripe_events set processed_at = case when p_error is null then now() end, last_error = p_error where id = p_event_id
$$;

-- Email outbox, for the email-dispatch function. Claimed rows are retried after 10 minutes.
create function public.pay_email_claim(p_limit integer default 20) returns setof private.email_outbox
language sql security definer set search_path = '' as $$
  update private.email_outbox set claimed_at = now(), attempts = attempts + 1
  where id in (select id from private.email_outbox where sent_at is null and send_after <= now() and attempts < 5
    and (claimed_at is null or claimed_at < now() - interval '10 minutes') order by send_after limit p_limit for update skip locked)
  returning *
$$;

create function public.pay_email_done(p_id bigint, p_error text default null) returns void
language sql security definer set search_path = '' as $$
  update private.email_outbox set sent_at = case when p_error is null then now() end, last_error = p_error,
    claimed_at = case when p_error is null then claimed_at end where id = p_id
$$;

-- Balance reminders: 7 days and 1 day before the due date, and 3 days after, in the trip's zone.
create function public.pay_enqueue_reminders(p_site text) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0; v_days integer;
begin
  for r in
    select b.*, t.name as trip_name, t.timezone, o.display_name, o.support_email
    from public.bookings b join public.trips t on t.id = b.trip_id join public.organizers o on o.id = b.organizer_id
    where b.status = 'active' and b.balance_due_date is not null and b.paid_minor < b.price_minor and b.deleted_at is null
  loop
    v_days := r.balance_due_date - (now() at time zone r.timezone)::date;
    if v_days in (7, 1, -3) then
      perform private.enqueue_email('reminder:' || r.id || ':' || v_days, r.traveler_email, r.support_email, 'balance_reminder',
        jsonb_build_object('traveler_name', r.traveler_name, 'trip_name', r.trip_name, 'organizer', r.display_name,
          'due_minor', r.price_minor - r.paid_minor, 'balance_due_date', r.balance_due_date, 'days', v_days,
          'manage_url', p_site || '/b/' || (select token from private.booking_tokens where booking_id = r.id)));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- An organizer's Stripe account by id, and their trips' open money, for the Edge Functions.
create function public.pay_organizer_for_user(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', o.id, 'display_name', o.display_name, 'support_email', o.support_email,
    'stripe_account_id', a.stripe_account_id)
  from public.organizers o left join public.stripe_accounts a on a.organizer_id = o.id
  where o.owner_user_id = p_user
$$;

revoke execute on function
  public.pay_reserve_booking(text, uuid, text, text, integer), public.pay_booking_due(text),
  public.pay_open_payment(uuid, text, bigint, bigint, bigint, text, timestamptz),
  public.pay_payment_succeeded(text, text, text, bigint, text, timestamptz, text), public.pay_payment_closed(text, text),
  public.pay_payment_refunded(text, bigint), public.pay_application_fee_refunded(text, bigint),
  public.pay_upsert_account(uuid, text, boolean, boolean, boolean, jsonb, text, jsonb, text, text), public.pay_account_disconnected(text),
  public.pay_upsert_payout(text, text, bigint, text, date, text, text, text),
  public.pay_record_dispute(text, text, bigint, text, text, timestamptz),
  public.pay_inbox_add(text, text, text, jsonb), public.pay_inbox_next(integer), public.pay_inbox_done(text, text),
  public.pay_email_claim(integer), public.pay_email_done(bigint, text), public.pay_enqueue_reminders(text),
  public.pay_organizer_for_user(uuid)
from public, anon, authenticated;
grant execute on function
  public.pay_reserve_booking(text, uuid, text, text, integer), public.pay_booking_due(text),
  public.pay_open_payment(uuid, text, bigint, bigint, bigint, text, timestamptz),
  public.pay_payment_succeeded(text, text, text, bigint, text, timestamptz, text), public.pay_payment_closed(text, text),
  public.pay_payment_refunded(text, bigint), public.pay_application_fee_refunded(text, bigint),
  public.pay_upsert_account(uuid, text, boolean, boolean, boolean, jsonb, text, jsonb, text, text), public.pay_account_disconnected(text),
  public.pay_upsert_payout(text, text, bigint, text, date, text, text, text),
  public.pay_record_dispute(text, text, bigint, text, text, timestamptz),
  public.pay_inbox_add(text, text, text, jsonb), public.pay_inbox_next(integer), public.pay_inbox_done(text, text),
  public.pay_email_claim(integer), public.pay_email_done(bigint, text), public.pay_enqueue_reminders(text),
  public.pay_organizer_for_user(uuid)
to service_role;

notify pgrst, 'reload schema';
