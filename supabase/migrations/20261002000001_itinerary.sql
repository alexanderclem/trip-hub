-- Itinerary: what happens when.
--
-- Times are stored as wall-clock local time + the IANA zone where that end of the item happens
-- (a flight departs 07:10 America/Guatemala and lands 12:05 America/Chicago). That keeps intent
-- ("dinner at 7 pm in Antigua") stable even if it's edited from a phone in another zone. The
-- absolute instants start_at/end_at are derived by trigger and used for sorting, overlap and "now".
-- Clients compute the same instants with Luxon so the plan works offline; the server's wins on pull.

create table public.itinerary_items (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  kind text not null default 'activity' check (kind in (
    'activity', 'meal', 'flight', 'transport', 'lodging', 'reservation', 'free')),
  place_id uuid references public.places (id),
  to_place_id uuid references public.places (id), -- destination for flights/transport
  all_day boolean not null default false,
  start_local timestamp not null,
  start_tz text not null,
  end_local timestamp,
  end_tz text,
  start_at timestamptz,
  end_at timestamptz,
  status text not null default 'confirmed' check (status in ('idea', 'tentative', 'confirmed', 'cancelled')),
  confirmation_code text,
  attendee_ids uuid[], -- null = everyone
  details jsonb not null default '{}', -- flight number, seat, terminal…
  notes text,
  est_cost_minor bigint,
  est_cost_currency char(3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  check (end_local is null or end_tz is not null)
);

-- One per (trip, date); id = stableId(trip, 'day', date).
create table public.day_notes (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  date date not null,
  title text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

-- Derive the instants. An invalid zone name makes AT TIME ZONE raise, which rejects the write.
create or replace function private.itinerary_instants() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.start_at := new.start_local at time zone new.start_tz;
  new.end_at := case when new.end_local is null then null else new.end_local at time zone new.end_tz end;
  if new.end_at is not null and new.end_at < new.start_at then
    raise exception 'Item ends before it starts' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger itinerary_instants before insert or update on public.itinerary_items
  for each row execute function private.itinerary_instants();

do $$
declare t text;
begin
  foreach t in array array['itinerary_items', 'day_notes'] loop
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

create index itinerary_items_start_idx on public.itinerary_items (trip_id, start_at);
create index itinerary_items_place_idx on public.itinerary_items (place_id);
create index itinerary_items_to_place_idx on public.itinerary_items (to_place_id);
create unique index day_notes_trip_date_idx on public.day_notes (trip_id, date);

alter publication supabase_realtime add table public.itinerary_items, public.day_notes;
