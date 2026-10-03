-- Emergency details, one row per person per trip (id = stableId(trip, 'safety', member)).
-- Everyone on the trip can read them (that's the point in an emergency); only the person
-- whose card it is can write it. Never soft-deleted: clearing a field stores null.
create table public.member_safety (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  member_id uuid not null references public.members (id),
  emergency_name text check (char_length(emergency_name) <= 120),
  emergency_relation text check (char_length(emergency_relation) <= 60),
  emergency_phone text check (char_length(emergency_phone) <= 40),
  allergies text check (char_length(allergies) <= 500),
  medical text check (char_length(medical) <= 1000),
  blood_type text check (char_length(blood_type) <= 10),
  insurance_provider text check (char_length(insurance_provider) <= 120),
  insurance_policy text check (char_length(insurance_policy) <= 80),
  insurance_phone text check (char_length(insurance_phone) <= 40),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  unique (trip_id, member_id)
);

create function private.validate_member_safety() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.members m where m.id = new.member_id and m.trip_id = new.trip_id) then
    raise exception 'Member must belong to this trip' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.member_id <> old.member_id then
    raise exception 'An emergency card can''t move to another person' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger validate_member_safety before insert or update on public.member_safety
  for each row execute function private.validate_member_safety();
create trigger sync_guard before insert or update on public.member_safety
  for each row execute function private.sync_guard();
create index member_safety_sync_idx on public.member_safety (trip_id, updated_at);
create index member_safety_member_idx on public.member_safety (member_id);
alter table public.member_safety enable row level security;
create policy member_safety_select on public.member_safety for select to authenticated
  using ((select private.has_trip_access(trip_id)));
-- Writing needs this device to be that person ("Who are you?"), not just trip access.
create policy member_safety_insert on public.member_safety for insert to authenticated
  with check ((select private.has_trip_access(trip_id)) and private.claims_member(trip_id, member_id));
create policy member_safety_update on public.member_safety for update to authenticated
  using ((select private.has_trip_access(trip_id)) and private.claims_member(trip_id, member_id))
  with check ((select private.has_trip_access(trip_id)) and private.claims_member(trip_id, member_id));
alter publication supabase_realtime add table public.member_safety;

-- claims_member was created for the push RPCs; RLS evaluates it as the signed-in user.
grant execute on function private.claims_member(uuid, uuid) to authenticated;
