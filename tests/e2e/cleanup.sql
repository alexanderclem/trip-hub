-- Removes trips created by the end-to-end tests and smoke test, plus anonymous test users
-- that no longer belong to any trip. Run in the Supabase SQL editor after test runs.
with test_trips as (
  select id from public.trips where name like 'E2E TEST %' or name like 'SMOKE TEST %'
), dpreferences as (
  delete from public.member_preferences where trip_id in (select id from test_trips) returning 1
), dt as (
  delete from public.trip_tasks where trip_id in (select id from test_trips) returning 1
), dpush as (
  delete from public.push_subscriptions where trip_id in (select id from test_trips) returning 1
), dpq as (
  delete from private.push_queue where trip_id in (select id from test_trips) returning 1
), dpr as (
  delete from private.push_reminders where trip_id in (select id from test_trips) returning 1
), dsafety as (
  delete from public.member_safety where trip_id in (select id from test_trips) returning 1
), dpc as (
  delete from public.packing_checks where trip_id in (select id from test_trips) returning 1
), dpi as (
  delete from public.packing_items where trip_id in (select id from test_trips) returning 1
), d0 as (
  delete from public.route_legs where trip_id in (select id from test_trips) returning 1
), d0b as (
  delete from public.leg_overrides where trip_id in (select id from test_trips) returning 1
), di as (
  delete from public.itinerary_items where trip_id in (select id from test_trips) returning 1
), dd as (
  delete from public.day_notes where trip_id in (select id from test_trips) returning 1
), da as (
  delete from public.attachments where trip_id in (select id from test_trips) returning 1
), de as (
  delete from public.expenses where trip_id in (select id from test_trips) returning 1
), ds as (
  delete from public.settlements where trip_id in (select id from test_trips) returning 1
), dfx as (
  delete from public.fx_snapshots where trip_id in (select id from test_trips) returning 1
), dv as (
  delete from public.poll_votes where trip_id in (select id from test_trips) returning 1
), dr as (
  delete from public.place_ratings where trip_id in (select id from test_trips) returning 1
), dpo as (
  delete from public.poll_options where trip_id in (select id from test_trips) returning 1
), dp as (
  delete from public.polls where trip_id in (select id from test_trips) returning 1
), d1 as (
  delete from public.trip_devices where trip_id in (select id from test_trips) returning 1
), d2 as (
  delete from public.links where trip_id in (select id from test_trips) returning 1
), d3 as (
  delete from public.places where trip_id in (select id from test_trips) returning 1
), d4 as (
  delete from public.members where trip_id in (select id from test_trips) returning 1
)
select (select count(*) from test_trips) as trips, (select count(*) from d3) as places;

delete from public.trips where name like 'E2E TEST %' or name like 'SMOKE TEST %';

delete from auth.users u
where u.is_anonymous
  and not exists (select 1 from public.trip_devices d where d.user_id = u.id);
