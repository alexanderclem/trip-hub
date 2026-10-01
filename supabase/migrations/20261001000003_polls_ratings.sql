-- Group decisions and group ratings.
--
-- Votes and ratings are one row per (option|place, member) with a deterministic id, so one
-- person's two phones converge on the same row. Because deletes are sticky (sync_guard), a
-- withdrawn vote/rating is stored as a NULL score/stars, never as a delete — otherwise that
-- person could never vote on that option again.

create table public.polls (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  description text,
  status text not null default 'open' check (status in ('open', 'closed')),
  winner_option_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

create table public.poll_options (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  poll_id uuid not null references public.polls (id),
  label text not null check (length(trim(label)) between 1 and 200),
  place_id uuid references public.places (id),
  url text check (url is null or url ~* '^https?://'),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

create table public.poll_votes (
  id uuid primary key, -- stableId(trip, 'vote', option_id, member_id)
  trip_id uuid not null references public.trips (id) on delete cascade,
  poll_id uuid not null references public.polls (id),
  option_id uuid not null references public.poll_options (id),
  member_id uuid not null references public.members (id),
  score smallint check (score between 0 and 3), -- 0 No way, 1 Fine, 2 Want, 3 Must-do; NULL = no vote
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

create table public.place_ratings (
  id uuid primary key, -- stableId(trip, 'rating', place_id, member_id)
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id uuid not null references public.places (id),
  member_id uuid not null references public.members (id),
  stars smallint check (stars between 1 and 5), -- NULL = rating withdrawn
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

do $$
declare t text;
begin
  foreach t in array array['polls', 'poll_options', 'poll_votes', 'place_ratings'] loop
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

create index poll_options_poll_idx on public.poll_options (poll_id);
create index poll_options_place_idx on public.poll_options (place_id);
create index poll_votes_option_idx on public.poll_votes (option_id);
create index poll_votes_poll_idx on public.poll_votes (poll_id);
create index poll_votes_member_idx on public.poll_votes (member_id);
create index place_ratings_place_idx on public.place_ratings (place_id);
create index place_ratings_member_idx on public.place_ratings (member_id);

alter publication supabase_realtime add table public.polls, public.poll_options, public.poll_votes, public.place_ratings;
