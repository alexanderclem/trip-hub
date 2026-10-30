-- Funnel measurement (docs/FUNNEL.md, docs/PLAN_THE_SWITCH.md section 5).
--
-- Anonymous counts of which steps people reach: no names, no emails, no trip content. Trips created
-- and people joining are recorded by triggers, so every app version is counted; the app adds a few
-- moments only it can see (an invite shared, the "collect payments" prompt) through log_events().
-- Early-access emails are kept apart, in their own table.

create table private.product_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null,
  trip_id uuid,
  user_id uuid,
  props jsonb not null default '{}' check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 2000)
);
create index product_events_kind_at_idx on private.product_events (kind, at);
create index product_events_user_at_idx on private.product_events (user_id, at);
alter table private.product_events enable row level security;

-- ─── Recorded by the server ─────────────────────────────────────────────────

create function private.log_trip_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.product_events (kind, trip_id, user_id) values ('trip_created', new.id, auth.uid());
  return new;
end $$;
create trigger log_trip_created after insert on public.trips
  for each row execute function private.log_trip_created();

create function private.log_member_joined() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.product_events (kind, trip_id, user_id) values ('member_joined', new.trip_id, auth.uid());
  return new;
end $$;
create trigger log_member_joined after insert on public.members
  for each row execute function private.log_member_joined();

-- ─── Sent by the app ────────────────────────────────────────────────────────

-- Events from the app: [{ "kind": text, "trip_id": uuid|null, "props": object }], at most 50 a call.
-- Unknown kinds and trips the caller isn't on are refused; past a daily cap the rest are dropped.
create function public.log_events(p_events jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_today integer;
  v_kept integer := 0;
  e jsonb;
  v_trip uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 50 then
    raise exception 'Send up to 50 events at a time' using errcode = '22023';
  end if;
  select count(*) into v_today from private.product_events
  where user_id = v_uid and at > now() - interval '1 day' and kind not in ('trip_created', 'member_joined');
  for e in select * from jsonb_array_elements(p_events) loop
    if v_today + v_kept >= 300 then exit; end if;
    if e ->> 'kind' not in ('trip_source', 'invite_shared', 'money_moment_shown', 'money_moment_clicked',
                            'money_moment_dismissed', 'early_access_requested') then
      raise exception 'Unknown event' using errcode = '22023';
    end if;
    v_trip := nullif(e ->> 'trip_id', '')::uuid;
    if v_trip is not null and not private.has_trip_access(v_trip) then
      raise exception 'No access to this trip' using errcode = '42501';
    end if;
    insert into private.product_events (kind, trip_id, user_id, props)
    values (e ->> 'kind', v_trip, v_uid, coalesce(e -> 'props', '{}'));
    v_kept := v_kept + 1;
  end loop;
  return v_kept;
end $$;

-- ─── Early access to payments ───────────────────────────────────────────────

create table private.early_access_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  trip_id uuid references public.trips (id) on delete set null,
  travelers integer,
  created_at timestamptz not null default now(),
  unique (user_id, email)
);
alter table private.early_access_requests enable row level security;

create function public.request_payments_early_access(p_email text, p_trip_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(p_email));
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'Enter an email address like name@example.com' using errcode = '22023';
  end if;
  if p_trip_id is not null and not private.has_trip_access(p_trip_id) then
    raise exception 'No access to this trip' using errcode = '42501';
  end if;
  insert into private.early_access_requests (user_id, email, trip_id, travelers)
  values (v_uid, v_email, p_trip_id,
          (select count(*) from public.members where trip_id = p_trip_id and deleted_at is null))
  on conflict (user_id, email) do update set trip_id = excluded.trip_id, travelers = excluded.travelers, created_at = now();
end $$;

revoke execute on function public.log_events(jsonb), public.request_payments_early_access(text, uuid) from public, anon;
grant execute on function public.log_events(jsonb), public.request_payments_early_access(text, uuid) to authenticated;

-- ─── Reading the funnel (SQL editor; see docs/FUNNEL.md) ────────────────────

-- A trip is engaged once it has at least 3 people and either votes from 2 people or plans on 2 days.
create view private.engaged_trips as
select t.id as trip_id, t.created_at
from public.trips t
where t.deleted_at is null
  and (select count(*) from public.members m where m.trip_id = t.id and m.deleted_at is null) >= 3
  and ((select count(distinct v.member_id) from public.poll_votes v where v.trip_id = t.id and v.score is not null) >= 2
    or (select count(distinct i.start_local::date) from public.itinerary_items i where i.trip_id = t.id and i.deleted_at is null) >= 2);

create view private.funnel_daily as
select day,
  count(*) filter (where kind = 'trip_created') as trips_created,
  count(distinct trip_id) filter (where kind = 'member_joined') as trips_with_joins,
  count(distinct trip_id) filter (where kind = 'invite_shared') as trips_invites_shared,
  count(distinct trip_id) filter (where kind = 'money_moment_shown') as trips_money_moment_shown,
  count(distinct trip_id) filter (where kind = 'money_moment_clicked') as trips_money_moment_clicked,
  count(*) filter (where kind = 'early_access_requested') as early_access_requests
from (select date_trunc('day', at)::date as day, kind, trip_id from private.product_events) e
group by day
order by day desc;
