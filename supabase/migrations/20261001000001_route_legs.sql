-- Travel times between places.
--
-- route_legs: computed by the route-legs Edge Function (OpenRouteService / OSRM), one row per
--   (from, to, mode), directional. Ids are uuidv5(trip_id, 'leg|from|to|mode') so recomputing
--   updates rows in place.
-- leg_overrides: times people report ("the lancha actually took 35 min"). Kept separate so a
--   recomputation can never clobber a human correction. Undirected: the pair is stored sorted.

create table public.route_legs (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_place_id uuid not null references public.places (id),
  to_place_id uuid not null references public.places (id),
  mode text not null check (mode in ('drive', 'walk')),
  distance_m integer check (distance_m >= 0),
  duration_s integer check (duration_s >= 0),
  source text not null check (source in ('ors', 'osrm')),
  -- Coordinates the leg was computed from; if a pin moves, the leg is stale.
  from_lat float8, from_lng float8, to_lat float8, to_lng float8,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  check (from_place_id <> to_place_id)
);

create table public.leg_overrides (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_a_id uuid not null references public.places (id),
  place_b_id uuid not null references public.places (id),
  mode text not null check (mode in ('drive', 'walk', 'boat', 'shuttle', 'tuktuk', 'bus', 'flight')),
  min_s integer not null check (min_s > 0),
  max_s integer not null check (max_s >= min_s),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  check (place_a_id < place_b_id)
);

do $$
declare t text;
begin
  foreach t in array array['route_legs', 'leg_overrides'] loop
    execute format(
      'create trigger sync_guard before insert or update on public.%I
         for each row execute function private.sync_guard()', t);
    execute format('create index %I on public.%I (trip_id, updated_at)', t || '_sync_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using ((select private.has_trip_access(trip_id)));
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check ((select private.has_trip_access(trip_id)));
      create policy %1$s_update on public.%1$I for update to authenticated
        using ((select private.has_trip_access(trip_id)))
        with check ((select private.has_trip_access(trip_id)));
    $f$, t);
  end loop;
end $$;

create index route_legs_from_idx on public.route_legs (from_place_id);
create index route_legs_to_idx on public.route_legs (to_place_id);
create index leg_overrides_a_idx on public.leg_overrides (place_a_id);
create index leg_overrides_b_idx on public.leg_overrides (place_b_id);

alter publication supabase_realtime add table public.route_legs, public.leg_overrides;
