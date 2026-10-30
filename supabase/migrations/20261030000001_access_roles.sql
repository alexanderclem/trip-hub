-- Roles, hosted trips, removing people, and private documents (docs/PLAN_THE_SWITCH.md, section 2).
--
-- Every existing trip stays in 'group' mode, where everyone who joined can do everything they can
-- today. A trip becomes 'hosted' only when its organizer switches it; then:
--   owner / admin  everything (plan, money, documents, people)
--   traveler       read the plan; vote, rate, comment, tick packing, add their own personal items,
--                  tasks assigned to them, expenses they're part of, their own documents
--   viewer         read the plan and documents shared with the whole trip
--   pending        joined by link, waiting for approval: the trip's name and dates only
--
-- Access is still "this auth user has a trip_devices row"; the row now carries a role. Policies ask
-- private.can(trip, capability). In group mode every capability except 'staff' is true for anyone
-- who joined, so group trips behave exactly as before (tested in supabase/testing/access.test.ts).

-- ─── Columns ────────────────────────────────────────────────────────────────

alter table public.trips
  add column access_mode text not null default 'group' check (access_mode in ('group', 'hosted')),
  -- Bumped when the mode changes, so phones drop what they may no longer see and pull again.
  add column access_epoch integer not null default 0,
  -- The role someone gets when they join by link.
  add column join_role text not null default 'member' check (join_role in ('member', 'traveler', 'pending'));

alter table public.trip_devices
  add column role text not null default 'member'
    check (role in ('owner', 'admin', 'member', 'traveler', 'viewer', 'pending'));

alter table public.attachments
  add column visibility text not null default 'trip' check (visibility in ('trip', 'staff', 'owner')),
  add column owner_member_id uuid references public.members (id);

-- People removed from a trip. join_trip refuses them, so an old link can't bring them back.
create table private.trip_revocations (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null,
  member_id uuid,
  revoked_at timestamptz not null default now(),
  revoked_by uuid,
  primary key (trip_id, user_id)
);
alter table private.trip_revocations enable row level security;

-- Only the RPCs below may change a trip's mode, epoch or join role.
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
    end if;
    if old.deleted_at is not null then
      new.deleted_at := old.deleted_at;
    end if;
  else
    new.created_at := new.updated_at;
  end if;
  return new;
end $$;

-- ─── Access checks ──────────────────────────────────────────────────────────

create function private.trip_role(t uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.trip_devices where trip_id = t and user_id = (select auth.uid())
$$;

-- Capabilities: 'read' and 'participate' are what a hosted traveler has ('read' alone for a viewer).
-- 'staff' is owner/admin in any mode. Every other capability ('plan', 'money', 'docs', 'roster')
-- is true for everyone in a group trip and for owner/admin in a hosted one.
create function private.can(t uuid, cap text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when d.role = 'pending' then false
      when cap = 'staff' then d.role in ('owner', 'admin')
      when tr.access_mode = 'group' then true
      when d.role in ('owner', 'admin') then true
      when d.role = 'traveler' then cap in ('read', 'participate')
      when d.role = 'viewer' then cap = 'read'
      else false
    end
    from public.trip_devices d join public.trips tr on tr.id = d.trip_id
    where d.trip_id = t and d.user_id = (select auth.uid())
  ), false)
$$;

-- Unchanged meaning for group trips; people waiting for approval no longer count as joined.
create or replace function private.has_trip_access(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can(t, 'read')
$$;

-- Plan editors, or this device's own member doing something allowed to travelers.
create function private.can_as(t uuid, cap text, m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can(t, cap) or (private.can(t, 'participate') and private.claims_member(t, m))
$$;

-- Is this device's member a payer, in the split, or the author of an expense?
create function private.in_expense(t uuid, p_payers jsonb, p_split jsonb, p_created_by uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trip_devices d
    where d.trip_id = t and d.user_id = (select auth.uid()) and d.member_id is not null
      and (d.member_id = p_created_by
        or p_payers @> jsonb_build_array(jsonb_build_object('member_id', d.member_id))
        or p_split @> jsonb_build_array(jsonb_build_object('member_id', d.member_id)))
  )
$$;

create function private.can_read_attachment(t uuid, p_visibility text, p_owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can(t, 'docs')
    or (private.can(t, 'read') and p_visibility = 'trip')
    or (private.can(t, 'participate') and p_visibility = 'owner' and private.claims_member(t, p_owner))
$$;

-- Does the trip have an organizer? Until it does, nobody holds 'staff'.
create function private.has_staff(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trip_devices where trip_id = t and role in ('owner', 'admin'))
$$;

revoke all on function private.trip_role(uuid), private.can(uuid, text), private.can_as(uuid, text, uuid),
  private.in_expense(uuid, jsonb, jsonb, uuid), private.can_read_attachment(uuid, text, uuid),
  private.has_staff(uuid) from public;
grant execute on function private.trip_role(uuid), private.can(uuid, text), private.can_as(uuid, text, uuid),
  private.in_expense(uuid, jsonb, jsonb, uuid), private.can_read_attachment(uuid, text, uuid),
  private.has_staff(uuid) to authenticated;

-- ─── Policies ───────────────────────────────────────────────────────────────

-- The trip row: people waiting for approval see it (name, dates); editing it is planning.
drop policy trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated
  using ((select private.has_trip_access(id)) or (select private.trip_role(id)) = 'pending');
drop policy trips_update on public.trips;
create policy trips_update on public.trips for update to authenticated
  using ((select private.can(id, 'plan'))) with check ((select private.can(id, 'plan')));

-- Who joined: everyone in a group trip; in a hosted one, organizers, plus each device its own row.
drop policy trip_devices_select on public.trip_devices;
create policy trip_devices_select on public.trip_devices for select to authenticated
  using ((select private.can(trip_id, 'roster')) or user_id = (select auth.uid()));

-- Shared plan: anyone reads, planners write.
do $$
declare t text;
begin
  foreach t in array array['places', 'links', 'leg_overrides', 'polls', 'poll_options', 'itinerary_items', 'day_notes'] loop
    execute format('drop policy %I on public.%I', t || '_insert', t);
    execute format('drop policy %I on public.%I', t || '_update', t);
    execute format($f$
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check ((select private.can(trip_id, 'plan')));
      create policy %1$s_update on public.%1$I for update to authenticated
        using ((select private.can(trip_id, 'plan')))
        with check ((select private.can(trip_id, 'plan')));
    $f$, t);
  end loop;
end $$;

-- Each person's own rows: planners write any; travelers write their own member's.
do $$
declare t text;
begin
  foreach t in array array['poll_votes', 'place_ratings', 'packing_checks', 'member_preferences'] loop
    execute format('drop policy %I on public.%I', t || '_insert', t);
    execute format('drop policy %I on public.%I', t || '_update', t);
  end loop;
  foreach t in array array['poll_votes', 'place_ratings', 'packing_checks'] loop
    execute format($f$
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check (private.can_as(trip_id, 'plan', member_id));
      create policy %1$s_update on public.%1$I for update to authenticated
        using (private.can_as(trip_id, 'plan', member_id))
        with check (private.can_as(trip_id, 'plan', member_id));
    $f$, t);
  end loop;
end $$;

-- Travel preferences were already only their own person's to write.
create policy member_preferences_insert on public.member_preferences for insert to authenticated
  with check ((select private.can(trip_id, 'participate')) and private.claims_member(trip_id, member_id));
create policy member_preferences_update on public.member_preferences for update to authenticated
  using ((select private.can(trip_id, 'participate')) and private.claims_member(trip_id, member_id))
  with check ((select private.can(trip_id, 'participate')) and private.claims_member(trip_id, member_id));

-- Comments: anyone who can take part, as themselves.
drop policy comments_insert on public.comments;
drop policy comments_update on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check ((select private.can(trip_id, 'participate')) and private.claims_member(trip_id, member_id));
create policy comments_update on public.comments for update to authenticated
  using ((select private.can(trip_id, 'participate')) and private.claims_member(trip_id, member_id))
  with check ((select private.can(trip_id, 'participate')) and private.claims_member(trip_id, member_id));

-- Packing: shared lists are planning; a personal item belongs to its owner.
drop policy packing_items_insert on public.packing_items;
drop policy packing_items_update on public.packing_items;
create policy packing_items_insert on public.packing_items for insert to authenticated
  with check ((select private.can(trip_id, 'plan')) or (kind = 'personal' and private.can_as(trip_id, 'plan', owner_id)));
create policy packing_items_update on public.packing_items for update to authenticated
  using ((select private.can(trip_id, 'plan')) or (kind = 'personal' and private.can_as(trip_id, 'plan', owner_id)))
  with check ((select private.can(trip_id, 'plan')) or (kind = 'personal' and private.can_as(trip_id, 'plan', owner_id)));

-- Tasks: planning, but whoever a task is assigned to may tick it off.
drop policy trip_tasks_insert on public.trip_tasks;
drop policy trip_tasks_update on public.trip_tasks;
create policy trip_tasks_insert on public.trip_tasks for insert to authenticated
  with check ((select private.can(trip_id, 'plan')));
create policy trip_tasks_update on public.trip_tasks for update to authenticated
  using (private.can_as(trip_id, 'plan', assignee_id))
  with check (private.can_as(trip_id, 'plan', assignee_id));

-- Members: planners edit anyone; a person edits themselves. New people come through the RPCs.
drop policy members_insert on public.members;
drop policy members_update on public.members;
create policy members_insert on public.members for insert to authenticated
  with check ((select private.can(trip_id, 'plan')));
create policy members_update on public.members for update to authenticated
  using (private.can_as(trip_id, 'plan', id))
  with check (private.can_as(trip_id, 'plan', id));

-- Money: everyone in a group trip; in a hosted one, organizers, or the people an expense involves.
drop policy expenses_select on public.expenses;
drop policy expenses_insert on public.expenses;
drop policy expenses_update on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using ((select private.can(trip_id, 'money')) or ((select private.can(trip_id, 'participate')) and private.in_expense(trip_id, payers, split, created_by)));
create policy expenses_insert on public.expenses for insert to authenticated
  with check ((select private.can(trip_id, 'money')) or ((select private.can(trip_id, 'participate')) and private.in_expense(trip_id, payers, split, created_by)));
create policy expenses_update on public.expenses for update to authenticated
  using ((select private.can(trip_id, 'money')) or ((select private.can(trip_id, 'participate')) and private.in_expense(trip_id, payers, split, created_by)))
  with check ((select private.can(trip_id, 'money')) or ((select private.can(trip_id, 'participate')) and private.in_expense(trip_id, payers, split, created_by)));

drop policy settlements_select on public.settlements;
drop policy settlements_insert on public.settlements;
drop policy settlements_update on public.settlements;
create policy settlements_select on public.settlements for select to authenticated
  using ((select private.can(trip_id, 'money')) or ((select private.can(trip_id, 'participate'))
    and (private.claims_member(trip_id, from_member_id) or private.claims_member(trip_id, to_member_id))));
create policy settlements_insert on public.settlements for insert to authenticated
  with check ((select private.can(trip_id, 'money')) or ((select private.can(trip_id, 'participate'))
    and (private.claims_member(trip_id, from_member_id) or private.claims_member(trip_id, to_member_id))));
create policy settlements_update on public.settlements for update to authenticated
  using ((select private.can(trip_id, 'money')) or ((select private.can(trip_id, 'participate'))
    and (private.claims_member(trip_id, from_member_id) or private.claims_member(trip_id, to_member_id))))
  with check ((select private.can(trip_id, 'money')) or ((select private.can(trip_id, 'participate'))
    and (private.claims_member(trip_id, from_member_id) or private.claims_member(trip_id, to_member_id))));

-- Safety cards: everyone in a group trip (unchanged); in a hosted one, organizers and the person.
drop policy member_safety_select on public.member_safety;
create policy member_safety_select on public.member_safety for select to authenticated
  using ((select private.can(trip_id, 'docs')) or ((select private.can(trip_id, 'read')) and private.claims_member(trip_id, member_id)));
drop policy member_safety_insert on public.member_safety;
drop policy member_safety_update on public.member_safety;
create policy member_safety_insert on public.member_safety for insert to authenticated
  with check ((select private.can(trip_id, 'participate')) and private.claims_member(trip_id, member_id));
create policy member_safety_update on public.member_safety for update to authenticated
  using ((select private.can(trip_id, 'participate')) and private.claims_member(trip_id, member_id))
  with check ((select private.can(trip_id, 'participate')) and private.claims_member(trip_id, member_id));

-- Documents: by visibility in hosted trips. A traveler may add their own, private or shared.
drop policy attachments_select on public.attachments;
drop policy attachments_insert on public.attachments;
drop policy attachments_update on public.attachments;
create policy attachments_select on public.attachments for select to authenticated
  using (private.can_read_attachment(trip_id, visibility, owner_member_id));
create policy attachments_insert on public.attachments for insert to authenticated
  with check ((select private.can(trip_id, 'docs'))
    or ((select private.can(trip_id, 'participate')) and visibility in ('trip', 'owner') and private.claims_member(trip_id, owner_member_id)));
create policy attachments_update on public.attachments for update to authenticated
  using ((select private.can(trip_id, 'docs')) or ((select private.can(trip_id, 'participate')) and private.claims_member(trip_id, owner_member_id)))
  with check ((select private.can(trip_id, 'docs'))
    or ((select private.can(trip_id, 'participate')) and visibility in ('trip', 'owner') and private.claims_member(trip_id, owner_member_id)));

-- Files follow their attachment row (<trip>/<attachment>/<file>).
create function private.object_readable(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_trip uuid;
  v_att public.attachments;
begin
  v_trip := split_part(object_name, '/', 1)::uuid;
  select * into v_att from public.attachments where id = split_part(object_name, '/', 2)::uuid and trip_id = v_trip;
  if v_att.id is null then
    -- Uploaded before its row reached the server: organizers (or anyone, in a group trip) only.
    return private.can(v_trip, 'docs');
  end if;
  return private.can_read_attachment(v_trip, v_att.visibility, v_att.owner_member_id);
exception when others then
  return false; -- not a trip folder
end $$;

create function private.object_writable(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_trip uuid;
  v_owner uuid;
begin
  v_trip := split_part(object_name, '/', 1)::uuid;
  if private.can(v_trip, 'docs') then return true; end if;
  if not private.can(v_trip, 'participate') then return false; end if;
  select owner_member_id into v_owner from public.attachments where id = split_part(object_name, '/', 2)::uuid and trip_id = v_trip;
  -- A traveler uploads the file for a row they just made, or replaces their own.
  return not found or private.claims_member(v_trip, v_owner);
exception when others then
  return false;
end $$;
revoke all on function private.object_readable(text), private.object_writable(text) from public;
grant execute on function private.object_readable(text), private.object_writable(text) to authenticated;

drop policy "attachments: read own trips" on storage.objects;
drop policy "attachments: upload to own trips" on storage.objects;
drop policy "attachments: replace in own trips" on storage.objects;
create policy "attachments: read own trips" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (select private.object_readable(name)));
create policy "attachments: upload to own trips" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (select private.object_writable(name)));
create policy "attachments: replace in own trips" on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (select private.object_writable(name)))
  with check (bucket_id = 'attachments' and (select private.object_writable(name)));

-- ─── Connected apps (20261008000002_connector_editing.sql) ──────────────────

-- A connected app edits the plan through this function as the signed-in person, so it must follow
-- the same rule as the app: in a hosted trip only organizers change the plan. The original check
-- stays, under a new name; the connector RPCs call this one by name.
alter function private.connector_mutate_itinerary_base(text, uuid, uuid, timestamptz, jsonb)
  rename to connector_mutate_itinerary_unchecked;
create function private.connector_mutate_itinerary_base(p_action text, p_trip_id uuid, p_item_id uuid,
  p_expected_updated_at timestamptz default null, p_changes jsonb default '{}')
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can(p_trip_id, 'plan') then
    raise exception 'Only the trip''s organizers can change its plan' using errcode = '42501';
  end if;
  return private.connector_mutate_itinerary_unchecked(p_action, p_trip_id, p_item_id, p_expected_updated_at, p_changes);
end $$;
revoke all on function private.connector_mutate_itinerary_base(text, uuid, uuid, timestamptz, jsonb) from public, anon, authenticated;

-- ─── Joining and "Who are you?" ─────────────────────────────────────────────

-- Removed people can't come back through an old link. New people get the trip's join role.
create or replace function public.join_trip(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_trip uuid;
  v_role text;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select id, join_role into v_trip, v_role from public.trips
  where share_token = p_token and deleted_at is null;
  if v_trip is null then
    raise exception 'This trip link is invalid or has been replaced' using errcode = 'P0002';
  end if;
  if exists (select 1 from private.trip_revocations where trip_id = v_trip and user_id = v_uid) then
    raise exception 'You were removed from this trip' using errcode = 'TH403';
  end if;
  insert into public.trip_devices (trip_id, user_id, role) values (v_trip, v_uid, v_role)
  on conflict (trip_id, user_id) do update set last_seen_at = now();
  return v_trip;
end $$;

-- In a hosted trip, nobody can become a person another phone already speaks for (that would show
-- them that person's documents and money). Organizers can.
create or replace function public.claim_member(p_trip_id uuid, p_member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_trip_access(p_trip_id) then
    raise exception 'No access to this trip' using errcode = '42501';
  end if;
  if not exists (select 1 from public.members
                 where id = p_member_id and trip_id = p_trip_id and deleted_at is null) then
    raise exception 'Unknown member' using errcode = 'P0002';
  end if;
  if (select access_mode from public.trips where id = p_trip_id) = 'hosted'
     and not private.can(p_trip_id, 'staff')
     and exists (select 1 from public.trip_devices where trip_id = p_trip_id and member_id = p_member_id
                 and user_id <> auth.uid()) then
    raise exception 'Someone else is already this person on this trip. Ask the organizer.' using errcode = '42501';
  end if;
  update public.trip_devices set member_id = p_member_id, last_seen_at = now()
  where trip_id = p_trip_id and user_id = auth.uid();
end $$;

-- People waiting for approval may add themselves, so the organizer knows who to approve.
create or replace function public.create_member_and_claim(
  p_trip_id uuid, p_member_id uuid, p_name text, p_color text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_trip_access(p_trip_id) and private.trip_role(p_trip_id) is distinct from 'pending' then
    raise exception 'No access to this trip' using errcode = '42501';
  end if;
  insert into public.members (id, trip_id, display_name, color, created_by, updated_by)
  values (p_member_id, p_trip_id, p_name, p_color, p_member_id, p_member_id);
  update public.trip_devices set member_id = p_member_id, last_seen_at = now()
  where trip_id = p_trip_id and user_id = auth.uid();
end $$;

-- Once a trip has an organizer, only organizers replace its link.
create or replace function public.rotate_share_token(p_trip_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_token text := private.new_share_token();
begin
  if not private.has_trip_access(p_trip_id)
     or (private.has_staff(p_trip_id) and not private.can(p_trip_id, 'staff')) then
    raise exception 'No access to this trip' using errcode = '42501';
  end if;
  perform set_config('trip_hub.rotating_token', 'on', true);
  update public.trips set share_token = v_token where id = p_trip_id;
  perform set_config('trip_hub.rotating_token', 'off', true);
  return v_token;
end $$;

-- ─── Organizer RPCs ─────────────────────────────────────────────────────────

-- The trip's creator, signed in with an account, becomes its owner. Nothing else changes.
create function public.claim_trip(p_trip_id uuid) returns void
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
end $$;

-- Group ↔ hosted. Everyone's phone re-reads the trip afterwards (access_epoch).
create function public.set_access_mode(p_trip_id uuid, p_mode text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can(p_trip_id, 'staff') then
    raise exception 'Only the organizer can change who can edit this trip' using errcode = '42501';
  end if;
  if p_mode not in ('group', 'hosted') then
    raise exception 'Unknown mode' using errcode = '22023';
  end if;
  perform set_config('trip_hub.access_change', 'on', true);
  update public.trips
  set access_mode = p_mode, join_role = case p_mode when 'hosted' then 'pending' else 'member' end,
      access_epoch = access_epoch + 1
  where id = p_trip_id and access_mode <> p_mode;
  perform set_config('trip_hub.access_change', 'off', true);
  if p_mode = 'hosted' then
    update public.trip_devices set role = 'traveler' where trip_id = p_trip_id and role = 'member';
  else
    update public.trip_devices set role = 'member' where trip_id = p_trip_id and role in ('traveler', 'viewer', 'pending');
  end if;
end $$;

-- Sets the role of everyone's phones that are this person. Only the owner makes admins; the owner's
-- own role never changes here.
create function public.set_member_role(p_trip_id uuid, p_member_id uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can(p_trip_id, 'staff') then
    raise exception 'Only the organizer can change roles' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'traveler', 'viewer', 'pending', 'member') then
    raise exception 'Unknown role' using errcode = '22023';
  end if;
  if p_role = 'admin' and private.trip_role(p_trip_id) <> 'owner' then
    raise exception 'Only the owner can add organizers' using errcode = '42501';
  end if;
  if exists (select 1 from public.trip_devices where trip_id = p_trip_id and member_id = p_member_id and role = 'owner') then
    raise exception 'The owner''s role can''t be changed' using errcode = '42501';
  end if;
  update public.trip_devices set role = p_role where trip_id = p_trip_id and member_id = p_member_id;
end $$;

-- Who may remove people: organizers, or in a trip without one, its creator.
create function private.can_remove(p_trip_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can(p_trip_id, 'staff')
    or (not private.has_staff(p_trip_id) and private.has_trip_access(p_trip_id)
        and private.claims_member(p_trip_id, (select created_by from public.trips where id = p_trip_id)))
$$;
revoke all on function private.can_remove(uuid) from public;

-- Removes everyone's phones that are this person and stops them rejoining. Replaces the link
-- unless told not to, because a removed person could otherwise rejoin as someone new.
-- Returns the new link token, or null when the link was kept.
create function public.remove_from_trip(p_trip_id uuid, p_member_id uuid, p_replace_link boolean default true) returns text
language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  if not private.can_remove(p_trip_id) then
    raise exception 'Only the organizer can remove people from this trip' using errcode = '42501';
  end if;
  if private.claims_member(p_trip_id, p_member_id) then
    raise exception 'You can''t remove yourself' using errcode = '42501';
  end if;
  if exists (select 1 from public.trip_devices where trip_id = p_trip_id and member_id = p_member_id and role = 'owner')
     or p_member_id = (select created_by from public.trips where id = p_trip_id) and not private.can(p_trip_id, 'staff') then
    raise exception 'The organizer can''t be removed' using errcode = '42501';
  end if;
  insert into private.trip_revocations (trip_id, user_id, member_id, revoked_by)
  select trip_id, user_id, member_id, auth.uid() from public.trip_devices
  where trip_id = p_trip_id and member_id = p_member_id
  on conflict (trip_id, user_id) do update set member_id = excluded.member_id, revoked_at = now(), revoked_by = excluded.revoked_by;
  delete from public.trip_devices where trip_id = p_trip_id and member_id = p_member_id;
  -- Their pending notifications go nowhere.
  update public.push_subscriptions set enabled = false where trip_id = p_trip_id and member_id = p_member_id;
  if p_replace_link then
    v_token := private.new_share_token();
    perform set_config('trip_hub.rotating_token', 'on', true);
    update public.trips set share_token = v_token where id = p_trip_id;
    perform set_config('trip_hub.rotating_token', 'off', true);
  end if;
  return v_token;
end $$;

-- Lets a removed person join again with the link.
create function public.undo_remove(p_trip_id uuid, p_member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_remove(p_trip_id) then
    raise exception 'Only the organizer can do this' using errcode = '42501';
  end if;
  delete from private.trip_revocations where trip_id = p_trip_id and member_id = p_member_id;
end $$;

-- What this phone may do on a trip. Called at the start of each sync, and cached for offline use.
create function public.my_trip_access(p_trip_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'role', d.role,
    'mode', t.access_mode,
    'epoch', t.access_epoch,
    'removed', exists (select 1 from private.trip_revocations r where r.trip_id = p_trip_id and r.user_id = (select auth.uid())),
    'can_remove', private.can_remove(p_trip_id),
    'organized', private.has_staff(p_trip_id),
    'removed_members', case when private.can_remove(p_trip_id) then coalesce((
      select jsonb_agg(distinct r.member_id) from private.trip_revocations r where r.trip_id = p_trip_id and r.member_id is not null), '[]') end
  )
  from public.trips t left join public.trip_devices d on d.trip_id = t.id and d.user_id = (select auth.uid())
  where t.id = p_trip_id
    -- Nothing for someone who never joined.
    and (d.user_id is not null
      or exists (select 1 from private.trip_revocations r where r.trip_id = p_trip_id and r.user_id = (select auth.uid())))
$$;

revoke execute on function public.claim_trip(uuid), public.set_access_mode(uuid, text),
  public.set_member_role(uuid, uuid, text), public.remove_from_trip(uuid, uuid, boolean),
  public.undo_remove(uuid, uuid), public.my_trip_access(uuid)
from public, anon;
grant execute on function public.claim_trip(uuid), public.set_access_mode(uuid, text),
  public.set_member_role(uuid, uuid, text), public.remove_from_trip(uuid, uuid, boolean),
  public.undo_remove(uuid, uuid), public.my_trip_access(uuid)
to authenticated;

notify pgrst, 'reload schema';
