-- Organizer profiles (docs/PLAN_THE_SWITCH.md, Phase 1B). A person who runs trips claims them with an
-- account and a small business profile: the name travelers will see on trip pages and receipts, and
-- an address they can write to. Payments (1C) attach a Stripe account to this profile.

create table public.organizers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  support_email text not null check (support_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(support_email) <= 254),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.organizers enable row level security;
-- Owners read their own profile; it is written only through save_organizer(). No delete policy.
create policy organizers_select on public.organizers for select to authenticated
  using (owner_user_id = (select auth.uid()));

-- Which organizer runs a trip. Set only by claim_trip(), never by a plain update.
alter table public.trips add column organizer_id uuid references public.organizers (id);

create or replace function private.sync_guard_trip() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    -- Only rotate_share_token() may change the token; it sets this transaction-local flag.
    if current_setting('trip_hub.rotating_token', true) is distinct from 'on' then
      new.share_token := old.share_token;
    end if;
    if current_setting('trip_hub.access_change', true) is distinct from 'on' then
      new.access_mode := old.access_mode;
      new.access_epoch := old.access_epoch;
      new.join_role := old.join_role;
      new.organizer_id := old.organizer_id;
    end if;
    if old.deleted_at is not null then
      new.deleted_at := old.deleted_at;
    end if;
  else
    new.created_at := new.updated_at;
  end if;
  return new;
end $$;

-- A URL-safe name, made unique with a short suffix when taken.
create function private.organizer_slug(p_name text, p_except uuid) returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_base text := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  v_slug text;
begin
  v_base := left(coalesce(nullif(v_base, ''), 'organizer'), 50);
  v_slug := v_base;
  while exists (select 1 from public.organizers where slug = v_slug and id is distinct from p_except) loop
    v_slug := v_base || '-' || substr(md5(random()::text), 1, 4);
  end loop;
  return v_slug;
end $$;

-- Creates or updates the caller's organizer profile. Accounts only, never guests.
create function public.save_organizer(p_display_name text, p_support_email text) returns public.organizers
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.organizers;
  v_email text := lower(trim(p_support_email));
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) then
    raise exception 'Sign in with an account to organize trips' using errcode = '42501';
  end if;
  if p_display_name is null or length(trim(p_display_name)) not between 1 and 80 then
    raise exception 'Enter the name travelers should see' using errcode = '22023';
  end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'Enter an email address like name@example.com' using errcode = '22023';
  end if;
  select * into v_row from public.organizers where owner_user_id = v_uid;
  if v_row.id is null then
    insert into public.organizers (owner_user_id, display_name, support_email, slug)
    values (v_uid, trim(p_display_name), v_email, private.organizer_slug(p_display_name, null))
    returning * into v_row;
  else
    update public.organizers
    set display_name = trim(p_display_name), support_email = v_email, updated_at = now(),
        slug = case when display_name = trim(p_display_name) then slug else private.organizer_slug(p_display_name, id) end
    where id = v_row.id returning * into v_row;
  end if;
  return v_row;
end $$;

-- claim_trip also records the claimer's organizer profile on the trip, when they have one.
create or replace function public.claim_trip(p_trip_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_creator uuid;
begin
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) then
    raise exception 'Sign in with an account to organize this trip' using errcode = '42501';
  end if;
  select created_by into v_creator from public.trips where id = p_trip_id and deleted_at is null;
  if v_creator is null or not private.claims_member(p_trip_id, v_creator) then
    raise exception 'Only the person who created this trip can claim it' using errcode = '42501';
  end if;
  if private.has_staff(p_trip_id) and not private.can(p_trip_id, 'staff') then
    raise exception 'This trip already has an organizer' using errcode = '42501';
  end if;
  update public.trip_devices set role = 'owner' where trip_id = p_trip_id and user_id = auth.uid();
  perform set_config('trip_hub.access_change', 'on', true);
  update public.trips set organizer_id = (select id from public.organizers where owner_user_id = auth.uid())
  where id = p_trip_id;
  perform set_config('trip_hub.access_change', 'off', true);
  insert into private.product_events (kind, trip_id, user_id) values ('organizer_claimed', p_trip_id, auth.uid());
end $$;

revoke execute on function public.save_organizer(text, text) from public, anon;
grant execute on function public.save_organizer(text, text) to authenticated;

-- The funnel gains the claim.
create or replace view private.funnel_daily as
select day,
  count(*) filter (where kind = 'trip_created') as trips_created,
  count(distinct trip_id) filter (where kind = 'member_joined') as trips_with_joins,
  count(distinct trip_id) filter (where kind = 'invite_shared') as trips_invites_shared,
  count(distinct trip_id) filter (where kind = 'money_moment_shown') as trips_money_moment_shown,
  count(distinct trip_id) filter (where kind = 'money_moment_clicked') as trips_money_moment_clicked,
  count(*) filter (where kind = 'early_access_requested') as early_access_requests,
  count(distinct trip_id) filter (where kind = 'organizer_claimed') as trips_claimed
from (select date_trunc('day', at)::date as day, kind, trip_id from private.product_events) e
group by day
order by day desc;

notify pgrst, 'reload schema';
