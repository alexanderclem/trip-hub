-- Phase 2a (docs/PLAN_THE_SWITCH.md): running a trip again (Pro), installment plans, refund tiers and
-- the policy history disputes need, per-trip money reports (Pro), and per-role invite links.

-- ─── Running a trip again (Pro) ─────────────────────────────────────────────
-- Copies the plan, not the people or the money: places, plan items and day notes shifted by the
-- difference between start dates (local wall-clock times kept; instants are derived per zone, so the
-- US DST change is handled), the shared packing list, open tasks unassigned, settings, and the offer
-- as a new draft. New ids are derived from the new trip and the old id, so references stay intact.

create function public.clone_trip(p_source uuid, p_name text, p_start_date date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  src public.trips;
  v_org uuid := private.my_organizer_for(p_source);
  v_trip uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_token text := private.new_share_token();
  v_days integer;
  v_name text := (select display_name from public.organizers where id = private.my_organizer_for(p_source));
  nid text;
begin
  if v_org is null then
    raise exception 'Only this trip''s organizer can run it again' using errcode = '42501';
  end if;
  perform private.require_pro(v_org);
  if p_name is null or length(trim(p_name)) not between 1 and 120 then
    raise exception 'Give the new trip a name' using errcode = '22023';
  end if;
  select * into src from public.trips where id = p_source;
  v_days := coalesce(p_start_date - src.start_date, 0);
  nid := v_trip::text;

  perform set_config('trip_hub.access_change', 'on', true);
  insert into public.trips (id, name, timezone, start_date, end_date, base_currency, local_currency, route_factor_low, route_factor_high,
    bbox, offline_pack, share_token, settings, created_by, updated_by, access_mode, join_role, organizer_id)
  values (v_trip, trim(p_name), src.timezone, coalesce(p_start_date, src.start_date), src.end_date + v_days, src.base_currency, src.local_currency,
    src.route_factor_low, src.route_factor_high, src.bbox, src.offline_pack, v_token, src.settings, v_member, v_member, 'hosted', 'pending', v_org);
  perform set_config('trip_hub.access_change', 'off', true);
  insert into public.members (id, trip_id, display_name, created_by, updated_by)
  values (v_member, v_trip, coalesce((select m.display_name from public.members m join public.trip_devices d on d.member_id = m.id
    where d.trip_id = p_source and d.user_id = auth.uid()), v_name, 'Organizer'), v_member, v_member);
  insert into public.trip_devices (trip_id, user_id, member_id, role) values (v_trip, auth.uid(), v_member, 'owner');

  insert into public.places (id, trip_id, name, category, tags, lat, lng, address, area, status, notes, phone, website, opening_hours, external_ids, source, created_by, updated_by)
  select md5(nid || p.id)::uuid, v_trip, p.name, p.category, p.tags, p.lat, p.lng, p.address, p.area,
    case when p.status in ('booked', 'visited') then 'planned' else p.status end, p.notes, p.phone, p.website, p.opening_hours, p.external_ids, p.source, v_member, v_member
  from public.places p where p.trip_id = p_source and p.deleted_at is null;

  insert into public.links (id, trip_id, place_id, url, label, kind, created_by, updated_by)
  select md5(nid || l.id)::uuid, v_trip, md5(nid || l.place_id)::uuid, l.url, l.label, l.kind, v_member, v_member
  from public.links l join public.places p on p.id = l.place_id and p.deleted_at is null
  where l.trip_id = p_source and l.deleted_at is null and l.item_id is null and l.expense_id is null;

  insert into public.leg_overrides (id, trip_id, place_a_id, place_b_id, mode, min_s, max_s, note, created_by, updated_by)
  select md5(nid || o.id)::uuid, v_trip, least(md5(nid || o.place_a_id)::uuid, md5(nid || o.place_b_id)::uuid),
    greatest(md5(nid || o.place_a_id)::uuid, md5(nid || o.place_b_id)::uuid), o.mode, o.min_s, o.max_s, o.note, v_member, v_member
  from public.leg_overrides o
  where o.trip_id = p_source and o.deleted_at is null
    and exists (select 1 from public.places p where p.id = o.place_a_id and p.deleted_at is null)
    and exists (select 1 from public.places p where p.id = o.place_b_id and p.deleted_at is null);

  -- Bookings must be made again, so confirmed plans start as tentative and lose their codes.
  insert into public.itinerary_items (id, trip_id, title, kind, place_id, to_place_id, all_day, start_local, start_tz, end_local, end_tz,
    status, details, notes, est_cost_minor, est_cost_currency, created_by, updated_by)
  select md5(nid || i.id)::uuid, v_trip, i.title, i.kind,
    case when i.place_id is not null and exists (select 1 from public.places p where p.id = i.place_id and p.deleted_at is null) then md5(nid || i.place_id)::uuid end,
    case when i.to_place_id is not null and exists (select 1 from public.places p where p.id = i.to_place_id and p.deleted_at is null) then md5(nid || i.to_place_id)::uuid end,
    i.all_day, i.start_local + make_interval(days => v_days), i.start_tz, i.end_local + make_interval(days => v_days), i.end_tz,
    case when i.status = 'confirmed' then 'tentative' else i.status end, i.details, i.notes, i.est_cost_minor, i.est_cost_currency, v_member, v_member
  from public.itinerary_items i where i.trip_id = p_source and i.deleted_at is null and i.status <> 'cancelled';

  insert into public.day_notes (id, trip_id, date, title, notes, created_by, updated_by)
  select md5(nid || n.id)::uuid, v_trip, n.date + v_days, n.title, n.notes, v_member, v_member
  from public.day_notes n where n.trip_id = p_source and n.deleted_at is null;

  insert into public.packing_items (id, trip_id, title, kind, category, quantity, created_by, updated_by)
  select md5(nid || k.id)::uuid, v_trip, k.title, k.kind, k.category, k.quantity, v_member, v_member
  from public.packing_items k where k.trip_id = p_source and k.deleted_at is null and k.kind <> 'personal';

  insert into public.trip_tasks (id, trip_id, title, due_date, notes, created_by, updated_by)
  select md5(nid || t.id)::uuid, v_trip, t.title, t.due_date + v_days, t.notes, v_member, v_member
  from public.trip_tasks t where t.trip_id = p_source and t.deleted_at is null and not t.completed;

  insert into public.trip_offers (trip_id, organizer_id, status, slug, title, summary, currency, price_minor, deposit_minor, balance_due_date,
    capacity, cancellation_policy, fee_mode, allow_bank, schedule, refund_tiers, created_by, updated_by)
  select v_trip, v_org, 'draft', private.offer_slug(trim(p_name), null), trim(p_name), f.summary, f.currency, f.price_minor, f.deposit_minor,
    f.balance_due_date + v_days, f.capacity, f.cancellation_policy, f.fee_mode, f.allow_bank,
    coalesce((select jsonb_agg(jsonb_build_object('due_date', ((s ->> 'due_date')::date + v_days)::text, 'amount_minor', (s ->> 'amount_minor')::bigint))
      from jsonb_array_elements(f.schedule) s), '[]'), f.refund_tiers, v_member, v_member
  from public.trip_offers f where f.trip_id = p_source;

  insert into private.product_events (kind, trip_id, user_id, props) values ('trip_cloned', v_trip, auth.uid(), jsonb_build_object('from', p_source));
  return jsonb_build_object('trip_id', v_trip, 'member_id', v_member, 'share_token', v_token);
end $$;

-- ─── Installment plans and refund tiers (on the 1%) ─────────────────────────
-- schedule: the payments after the deposit, [{ due_date, amount_minor }], up to 4, adding up to the
-- price less the deposit. Empty means the old single balance (balance_due_date).
-- refund_tiers: [{ days_before, percent }], how much of what was paid comes back when a traveler
-- cancels at least that many days before the trip. Shown with the policy; the organizer decides.

alter table public.trip_offers
  add column schedule jsonb not null default '[]' check (jsonb_typeof(schedule) = 'array' and jsonb_array_length(schedule) <= 4),
  add column refund_tiers jsonb not null default '[]' check (jsonb_typeof(refund_tiers) = 'array' and jsonb_array_length(refund_tiers) <= 6);
alter table public.bookings add column schedule jsonb not null default '[]';
alter table public.booking_payments drop constraint booking_payments_kind_check;
alter table public.booking_payments add constraint booking_payments_kind_check check (kind in ('deposit', 'balance', 'full', 'installment'));

-- A booking keeps the schedule it was made under.
create function private.booking_schedule() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.schedule := coalesce((select schedule from public.trip_offers where id = new.offer_id), '[]');
  return new;
end $$;
create trigger booking_schedule before insert on public.bookings for each row execute function private.booking_schedule();

create function public.save_offer_plan(p_trip_id uuid, p_schedule jsonb, p_refund_tiers jsonb) returns public.trip_offers
language plpgsql security definer set search_path = '' as $$
declare
  f public.trip_offers;
  v_sum bigint;
  v_prev date;
  r jsonb;
begin
  if private.my_organizer_for(p_trip_id) is null then
    raise exception 'Only this trip''s organizer can change its payments' using errcode = '42501';
  end if;
  select * into f from public.trip_offers where trip_id = p_trip_id;
  if f.id is null then raise exception 'Set up the trip''s price first' using errcode = 'P0002'; end if;
  if jsonb_typeof(coalesce(p_schedule, '[]')) <> 'array' or jsonb_array_length(coalesce(p_schedule, '[]')) > 4 then
    raise exception 'Up to 4 payments after the deposit' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_schedule, '[]')) > 0 then
    for r in select * from jsonb_array_elements(p_schedule) loop
      if (r ->> 'amount_minor')::bigint is null or (r ->> 'amount_minor')::bigint <= 0 or (r ->> 'due_date')::date is null then
        raise exception 'Each payment needs a date and an amount' using errcode = '22023';
      end if;
      if v_prev is not null and (r ->> 'due_date')::date <= v_prev then
        raise exception 'Put the payments in date order' using errcode = '22023';
      end if;
      v_prev := (r ->> 'due_date')::date;
    end loop;
    select sum((r2 ->> 'amount_minor')::bigint) into v_sum from jsonb_array_elements(p_schedule) r2;
    if v_sum <> f.price_minor - f.deposit_minor then
      raise exception 'The payments add up to %, but % is left after the deposit', v_sum, f.price_minor - f.deposit_minor using errcode = '22023';
    end if;
  end if;
  if jsonb_typeof(coalesce(p_refund_tiers, '[]')) <> 'array' or exists (
    select 1 from jsonb_array_elements(coalesce(p_refund_tiers, '[]')) t
    where (t ->> 'days_before')::int < 0 or (t ->> 'percent')::int not between 0 and 100) then
    raise exception 'Refund steps need days (0 or more) and a percentage from 0 to 100' using errcode = '22023';
  end if;
  update public.trip_offers set schedule = coalesce(p_schedule, '[]'), refund_tiers = coalesce(p_refund_tiers, '[]'),
    balance_due_date = coalesce((select (s ->> 'due_date')::date from jsonb_array_elements(coalesce(p_schedule, '[]')) s order by 1 desc limit 1), balance_due_date)
  where id = f.id returning * into f;
  return f;
end $$;

-- What is due on a booking now: the overdue and next installments still unpaid, and everything left.
create function private.booking_due(b public.bookings) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_left bigint := greatest(0, b.price_minor - b.paid_minor);
  v_paid_after bigint := greatest(0, b.paid_minor - b.deposit_minor);
  v_cum bigint := 0;
  v_next bigint := v_left;
  v_date date := b.balance_due_date;
  r jsonb;
  v_today date := (now() at time zone coalesce((select timezone from public.trips where id = b.trip_id), 'UTC'))::date;
begin
  if b.paid_minor = 0 then
    return jsonb_build_object('next_minor', least(v_left, case when b.deposit_minor > 0 then b.deposit_minor else b.price_minor end), 'next_date', null, 'left_minor', v_left);
  end if;
  if jsonb_array_length(b.schedule) > 0 then
    for r in select * from jsonb_array_elements(b.schedule) order by (value ->> 'due_date') loop
      v_cum := v_cum + (r ->> 'amount_minor')::bigint;
      -- Everything due up to today, or else the next payment.
      if v_cum > v_paid_after and ((r ->> 'due_date')::date > v_today) then
        v_next := v_cum - v_paid_after;
        v_date := (r ->> 'due_date')::date;
        exit;
      end if;
      v_next := v_cum - v_paid_after;
      v_date := (r ->> 'due_date')::date;
    end loop;
  end if;
  return jsonb_build_object('next_minor', least(greatest(v_next, 0), v_left), 'next_date', v_date, 'left_minor', v_left);
end $$;

create or replace function public.pay_booking_due(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('booking_id', b.id, 'trip_id', b.trip_id, 'status', b.status, 'title', f.title, 'slug', f.slug,
    'due_minor', greatest(0, b.price_minor - b.paid_minor), 'paid_minor', b.paid_minor, 'fee_mode', b.fee_mode,
    'next_minor', (private.booking_due(b) ->> 'next_minor')::bigint, 'next_date', private.booking_due(b) ->> 'next_date',
    'installments', jsonb_array_length(b.schedule) > 0,
    'allow_bank', f.allow_bank, 'stripe_account_id', a.stripe_account_id, 'traveler_email', b.traveler_email,
    'open', exists (select 1 from public.booking_payments p where p.booking_id = b.id and p.status in ('open', 'processing') and (p.expires_at is null or p.expires_at > now())))
  from public.bookings b join public.trip_offers f on f.id = b.offer_id
  join public.stripe_accounts a on a.organizer_id = b.organizer_id and a.charges_enabled and a.disconnected_at is null
  where b.manage_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') and b.status in ('active', 'pending')
$$;

-- The booking page also shows the next payment and the refund steps.
create or replace function public.get_booking(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', b.id, 'status', b.status, 'trip_id', b.trip_id, 'traveler_name', b.traveler_name,
    'price_minor', b.price_minor, 'deposit_minor', b.deposit_minor, 'paid_minor', b.paid_minor,
    'refunded_minor', b.refunded_minor, 'balance_due_date', b.balance_due_date, 'fee_mode', b.fee_mode,
    'schedule', b.schedule, 'next_minor', (private.booking_due(b) ->> 'next_minor')::bigint, 'next_date', private.booking_due(b) ->> 'next_date',
    'offer', jsonb_build_object('slug', f.slug, 'title', f.title, 'allow_bank', f.allow_bank, 'status', f.status, 'refund_tiers', f.refund_tiers),
    'organizer', jsonb_build_object('name', o.display_name, 'email', o.support_email),
    'processing', exists (select 1 from public.booking_payments p where p.booking_id = b.id and p.status = 'processing')
  )
  from public.bookings b join public.trip_offers f on f.id = b.offer_id join public.organizers o on o.id = b.organizer_id
  where b.manage_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

-- Reminders follow the next installment, not only the final balance.
create or replace function public.pay_enqueue_reminders(p_site text) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0; v_days integer; v_due jsonb; v_date date;
begin
  for r in
    select b as booking, b.id, b.traveler_email, b.traveler_name, b.trip_id, t.name as trip_name, t.timezone, o.display_name, o.support_email
    from public.bookings b join public.trips t on t.id = b.trip_id join public.organizers o on o.id = b.organizer_id
    where b.status = 'active' and b.paid_minor < b.price_minor and b.deleted_at is null
  loop
    v_due := private.booking_due(r.booking);
    v_date := (v_due ->> 'next_date')::date;
    continue when v_date is null;
    v_days := v_date - (now() at time zone r.timezone)::date;
    if v_days in (7, 1, -3) then
      perform private.enqueue_email('reminder:' || r.id || ':' || v_date || ':' || v_days, r.traveler_email, r.support_email, 'balance_reminder',
        jsonb_build_object('traveler_name', r.traveler_name, 'trip_name', r.trip_name, 'organizer', r.display_name,
          'due_minor', (v_due ->> 'next_minor')::bigint, 'balance_due_date', v_date, 'days', v_days,
          'manage_url', p_site || '/b#t=' || (select token from private.booking_tokens where booking_id = r.id)));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ─── Refunds from the app (on the 1%) ───────────────────────────────────────
-- For the refund-create Edge Function: checks the caller organizes the trip and lists the charges
-- that can still be refunded, newest first.
create function public.pay_refund_plan(p_user uuid, p_booking uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('booking_id', b.id, 'trip_id', b.trip_id, 'paid_minor', b.paid_minor, 'refunded_minor', b.refunded_minor,
    'stripe_account_id', a.stripe_account_id,
    'charges', coalesce((select jsonb_agg(jsonb_build_object('charge', p.stripe_charge_id, 'refundable', p.charged_minor - p.refunded_minor) order by p.paid_at desc)
      from public.booking_payments p where p.booking_id = b.id and p.stripe_charge_id is not null and p.status in ('succeeded', 'partially_refunded') and p.charged_minor > p.refunded_minor), '[]'))
  from public.bookings b
  join public.stripe_accounts a on a.organizer_id = b.organizer_id
  join public.trip_devices d on d.trip_id = b.trip_id and d.user_id = p_user and d.role in ('owner', 'admin')
  where b.id = p_booking
$$;

-- The organizer cancels a booking: the place frees up. Refunds are separate (and mirrored by webhook).
create function public.pay_cancel_booking(p_user uuid, p_booking uuid) returns void
language sql security definer set search_path = '' as $$
  update public.bookings b set status = 'cancelled'
  where b.id = p_booking and b.status in ('pending', 'active', 'paid')
    and exists (select 1 from public.trip_devices d where d.trip_id = b.trip_id and d.user_id = p_user and d.role in ('owner', 'admin'))
$$;

revoke execute on function public.pay_refund_plan(uuid, uuid), public.pay_cancel_booking(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pay_refund_plan(uuid, uuid), public.pay_cancel_booking(uuid, uuid) to service_role;

-- ─── The policy each traveler accepted (for disputes) ───────────────────────
create table private.offer_policies (
  offer_id uuid not null references public.trip_offers (id) on delete cascade,
  version integer not null,
  text text not null,
  refund_tiers jsonb not null default '[]',
  created_at timestamptz not null default now(),
  primary key (offer_id, version)
);
alter table private.offer_policies enable row level security;

create function private.keep_policy() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.offer_policies (offer_id, version, text, refund_tiers)
  values (new.id, new.policy_version, new.cancellation_policy, new.refund_tiers)
  on conflict (offer_id, version) do update set refund_tiers = excluded.refund_tiers;
  return null;
end $$;
create trigger keep_policy after insert or update of cancellation_policy, policy_version, refund_tiers on public.trip_offers
  for each row execute function private.keep_policy();
insert into private.offer_policies (offer_id, version, text, refund_tiers)
select id, policy_version, cancellation_policy, refund_tiers from public.trip_offers on conflict do nothing;

create function public.get_offer_policy(p_offer_id uuid, p_version integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version', p.version, 'text', p.text, 'refund_tiers', p.refund_tiers, 'since', p.created_at)
  from private.offer_policies p join public.trip_offers f on f.id = p.offer_id
  where p.offer_id = p_offer_id and p.version = p_version and private.can(f.trip_id, 'staff')
$$;
revoke execute on function public.get_offer_policy(uuid, integer) from public, anon;
grant execute on function public.get_offer_policy(uuid, integer) to authenticated;

-- ─── Money per trip (Pro) ───────────────────────────────────────────────────
create function public.organizer_report(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid := (select id from public.organizers where owner_user_id = auth.uid());
begin
  perform private.require_pro(v_org);
  return jsonb_build_object(
    'trips', coalesce((
      select jsonb_agg(r order by r ->> 'title') from (
        select jsonb_build_object('trip_id', e.trip_id, 'title', coalesce(f.title, t.name),
          'collected', -sum(e.amount_minor) filter (where e.account in ('traveler_receivable', 'booking_fee_income')),
          'stripe_fees', coalesce(sum(e.amount_minor) filter (where e.account = 'stripe_fees'), 0),
          'stowaway_fees', coalesce(sum(e.amount_minor) filter (where e.account = 'stowaway_fees'), 0),
          'refunds', coalesce(sum(e.amount_minor) filter (where e.account = 'refunds'), 0),
          'net', coalesce(sum(e.amount_minor) filter (where e.account = 'operator_stripe_balance'), 0)) as r
        from private.ledger_entries e join public.trips t on t.id = e.trip_id left join public.trip_offers f on f.trip_id = e.trip_id
        where e.organizer_id = v_org and e.trip_id is not null and e.occurred_at::date between p_from and p_to
        group by e.trip_id, f.title, t.name) x), '[]'),
    'payouts', coalesce((select sum(amount_minor) from private.ledger_entries
      where organizer_id = v_org and account = 'operator_bank' and occurred_at::date between p_from and p_to), 0));
end $$;
revoke execute on function public.organizer_report(date, date) from public, anon;
grant execute on function public.organizer_report(date, date) to authenticated;

-- ─── Invite links per role ──────────────────────────────────────────────────
create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  token_hash text not null unique,
  role text not null check (role in ('traveler', 'viewer')),
  label text check (label is null or length(label) <= 60),
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses between 1 and 1000),
  uses integer not null default 0,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index trip_invites_trip_idx on public.trip_invites (trip_id);
alter table public.trip_invites enable row level security;
create policy trip_invites_select on public.trip_invites for select to authenticated
  using ((select private.can(trip_id, 'staff')));

create function public.create_invite(p_trip_id uuid, p_role text, p_label text, p_expires_in_days integer, p_max_uses integer) returns text
language plpgsql security definer set search_path = '' as $$
declare v_token text := private.new_share_token() || private.new_share_token();
begin
  if not private.can(p_trip_id, 'staff') then
    raise exception 'Only the organizer can make invite links' using errcode = '42501';
  end if;
  insert into public.trip_invites (trip_id, token_hash, role, label, expires_at, max_uses, created_by)
  values (p_trip_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_role, nullif(trim(p_label), ''),
    case when p_expires_in_days > 0 then now() + make_interval(days => p_expires_in_days) end, p_max_uses, auth.uid());
  return v_token;
end $$;

create function public.revoke_invite(p_invite_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.trip_invites set revoked_at = now()
  where id = p_invite_id and private.can(trip_id, 'staff')
$$;

revoke execute on function public.create_invite(uuid, text, text, integer, integer), public.revoke_invite(uuid),
  public.clone_trip(uuid, text, date), public.save_offer_plan(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.create_invite(uuid, text, text, integer, integer), public.revoke_invite(uuid),
  public.clone_trip(uuid, text, date), public.save_offer_plan(uuid, jsonb, jsonb) to authenticated;

-- join_trip also accepts an invite link: the person joins with the invite's role.
create or replace function public.join_trip(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_trip uuid;
  v_role text;
  v_invite public.trip_invites;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select id, join_role into v_trip, v_role from public.trips
  where share_token = p_token and deleted_at is null;
  if v_trip is null then
    select * into v_invite from public.trip_invites where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') for update;
    if v_invite.id is null or v_invite.revoked_at is not null or (v_invite.expires_at is not null and v_invite.expires_at < now())
       or (v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses
           and not exists (select 1 from public.trip_devices where trip_id = v_invite.trip_id and user_id = v_uid))
       or not exists (select 1 from public.trips where id = v_invite.trip_id and deleted_at is null) then
      raise exception 'This trip link is invalid or has been replaced' using errcode = 'P0002';
    end if;
    v_trip := v_invite.trip_id;
    v_role := v_invite.role;
  end if;
  if exists (select 1 from private.trip_revocations where trip_id = v_trip and user_id = v_uid) then
    raise exception 'You were removed from this trip' using errcode = 'TH403';
  end if;
  -- An invite is used up only by people joining for the first time.
  if v_invite.id is not null and not exists (select 1 from public.trip_devices where trip_id = v_trip and user_id = v_uid) then
    update public.trip_invites set uses = uses + 1 where id = v_invite.id;
  end if;
  insert into public.trip_devices (trip_id, user_id, role) values (v_trip, v_uid, v_role)
  on conflict (trip_id, user_id) do update set last_seen_at = now();
  return v_trip;
end $$;

notify pgrst, 'reload schema';
