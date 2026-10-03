-- Packing list. Three kinds of item:
--   everyone: each person brings their own (passport, bug spray); ticks live in packing_checks
--   group:    one person brings it for the group (speaker, first-aid kit); owner_id = who claimed it
--   personal: only the owner's list; hidden from others in the app (not secret: the trip can read rows)
create table public.packing_items (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  kind text not null check (kind in ('everyone', 'group', 'personal')),
  category text check (category is null or char_length(category) <= 40),
  owner_id uuid references public.members (id),
  packed boolean not null default false,
  quantity int check (quantity is null or quantity between 1 and 99),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

-- Each person's tick on an "everyone" item. Never soft-deleted (deletes are sticky):
-- "not yet" is a NULL state, so ticks can be undone forever.
create table public.packing_checks (
  id uuid primary key, -- stableId(trip, 'pack', item, member)
  trip_id uuid not null references public.trips (id) on delete cascade,
  item_id uuid not null references public.packing_items (id),
  member_id uuid not null references public.members (id),
  state text check (state is null or state in ('packed', 'skip')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

create function private.validate_packing_item() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'personal' and new.owner_id is null then
    raise exception 'A personal item needs an owner' using errcode = '23514';
  end if;
  if new.kind = 'everyone' and new.owner_id is not null then
    raise exception 'Everyone brings their own; it has no single owner' using errcode = '23514';
  end if;
  if new.owner_id is not null and not exists (
    select 1 from public.members m where m.id = new.owner_id and m.trip_id = new.trip_id
  ) then
    raise exception 'Owner must belong to this trip' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.validate_packing_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.packing_items i where i.id = new.item_id and i.trip_id = new.trip_id and i.kind = 'everyone') then
    raise exception 'Ticks are only for this trip''s "everyone brings" items' using errcode = '23514';
  end if;
  if not exists (select 1 from public.members m where m.id = new.member_id and m.trip_id = new.trip_id) then
    raise exception 'Member must belong to this trip' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.item_id <> old.item_id or new.member_id <> old.member_id) then
    raise exception 'A tick can''t move to another item or person' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger validate_packing_item before insert or update on public.packing_items
  for each row execute function private.validate_packing_item();
create trigger validate_packing_check before insert or update on public.packing_checks
  for each row execute function private.validate_packing_check();

do $$
declare t text;
begin
  foreach t in array array['packing_items', 'packing_checks'] loop
    execute format('create trigger sync_guard before insert or update on public.%I for each row execute function private.sync_guard()', t);
    execute format('create index %I on public.%I (trip_id, updated_at)', t || '_sync_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.has_trip_access(trip_id)))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.has_trip_access(trip_id)))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.has_trip_access(trip_id))) with check ((select private.has_trip_access(trip_id)))', t || '_update', t);
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end;
$$;

create index packing_items_owner_idx on public.packing_items (owner_id);
create index packing_checks_item_idx on public.packing_checks (item_id);
create index packing_checks_member_idx on public.packing_checks (member_id);
