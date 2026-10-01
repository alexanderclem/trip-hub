-- Removes trips created by the end-to-end tests and smoke test, plus anonymous test users
-- that no longer belong to any trip. Run in the Supabase SQL editor after test runs.
with test_trips as (
  select id from public.trips where name like 'E2E TEST %' or name like 'SMOKE TEST %'
), d0 as (
  delete from public.route_legs where trip_id in (select id from test_trips) returning 1
), d0b as (
  delete from public.leg_overrides where trip_id in (select id from test_trips) returning 1
), di as (
  delete from public.itinerary_items where trip_id in (select id from test_trips) returning 1
), dd as (
  delete from public.day_notes where trip_id in (select id from test_trips) returning 1
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
