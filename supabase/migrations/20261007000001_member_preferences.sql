-- One editable profile per trip member. Reading is shared; writing follows the claimed identity.
create table public.member_preferences (
  id uuid primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  member_id uuid not null references public.members(id),
  scores jsonb not null,
  description text not null default '' check (char_length(description) <= 2000),
  constraints text not null default '' check (char_length(constraints) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  unique (trip_id, member_id)
);

create function private.validate_member_preference() returns trigger
language plpgsql set search_path = '' as $$
declare axis text;
begin
  if tg_op = 'UPDATE' and new.member_id is distinct from old.member_id then
    raise exception 'Profile member cannot change' using errcode = '23514';
  end if;
  if not exists (select 1 from public.members m where m.id = new.member_id and m.trip_id = new.trip_id and m.deleted_at is null) then
    raise exception 'Profile member must belong to this trip' using errcode = '23514';
  end if;
  if jsonb_typeof(new.scores) <> 'object' then
    raise exception 'Scores must be an object' using errcode = '23514';
  end if;
  if (select count(*) from jsonb_object_keys(new.scores)) <> 8 then
    raise exception 'Exactly eight scores are required' using errcode = '23514';
  end if;
  foreach axis in array array['adventure','nature','culture','food','nightlife','relaxation','comfort','budget'] loop
    if not (new.scores ? axis) or jsonb_typeof(new.scores -> axis) <> 'number' then
      raise exception 'Missing or invalid preference score' using errcode = '23514';
    end if;
    if (new.scores ->> axis)::numeric < 0 or (new.scores ->> axis)::numeric > 100 or
       (new.scores ->> axis)::numeric <> trunc((new.scores ->> axis)::numeric) then
      raise exception 'Scores must be whole numbers from 0 to 100' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

create trigger validate_member_preference before insert or update on public.member_preferences
  for each row execute function private.validate_member_preference();
create trigger sync_guard before insert or update on public.member_preferences
  for each row execute function private.sync_guard();
create index member_preferences_sync_idx on public.member_preferences(trip_id, updated_at);
create index member_preferences_member_idx on public.member_preferences(member_id);
alter table public.member_preferences enable row level security;
create policy member_preferences_select on public.member_preferences for select to authenticated
  using ((select private.has_trip_access(trip_id)));
create policy member_preferences_insert on public.member_preferences for insert to authenticated
  with check ((select private.has_trip_access(trip_id)) and exists (
    select 1 from public.trip_devices d where d.trip_id = member_preferences.trip_id
      and d.user_id = (select auth.uid()) and d.member_id = member_preferences.member_id
  ));
create policy member_preferences_update on public.member_preferences for update to authenticated
  using ((select private.has_trip_access(trip_id)) and exists (
    select 1 from public.trip_devices d where d.trip_id = member_preferences.trip_id
      and d.user_id = (select auth.uid()) and d.member_id = member_preferences.member_id
  ))
  with check ((select private.has_trip_access(trip_id)) and exists (
    select 1 from public.trip_devices d where d.trip_id = member_preferences.trip_id
      and d.user_id = (select auth.uid()) and d.member_id = member_preferences.member_id
  ));
alter publication supabase_realtime add table public.member_preferences;
