-- Shared tasks use the same offline outbox and trip access model as the plan.
create table public.trip_tasks (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  assignee_id uuid references public.members (id),
  due_date date,
  completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

-- A task may only be assigned to a member of its own trip.
create function private.validate_trip_task() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.assignee_id is not null and not exists (
    select 1 from public.members m where m.id = new.assignee_id and m.trip_id = new.trip_id
  ) then
    raise exception 'Assignee must belong to this trip' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger validate_trip_task before insert or update on public.trip_tasks
  for each row execute function private.validate_trip_task();
create trigger sync_guard before insert or update on public.trip_tasks
  for each row execute function private.sync_guard();
create index trip_tasks_sync_idx on public.trip_tasks (trip_id, updated_at);
create index trip_tasks_assignee_idx on public.trip_tasks (assignee_id);
alter table public.trip_tasks enable row level security;
create policy trip_tasks_select on public.trip_tasks for select to authenticated
  using ((select private.has_trip_access(trip_id)));
create policy trip_tasks_insert on public.trip_tasks for insert to authenticated
  with check ((select private.has_trip_access(trip_id)));
create policy trip_tasks_update on public.trip_tasks for update to authenticated
  using ((select private.has_trip_access(trip_id)))
  with check ((select private.has_trip_access(trip_id)));
alter publication supabase_realtime add table public.trip_tasks;
