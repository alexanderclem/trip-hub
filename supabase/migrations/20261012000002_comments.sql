-- Comments on a vote, a place or a plan item.
--
-- One row per comment. Everyone on the trip reads them; only the device that is that person
-- ("Who are you?") can write as them. The author removes a comment with a soft delete, like
-- every other row; nothing is ever hard-deleted.
create table public.comments (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  subject_type text not null check (subject_type in ('poll', 'place', 'item')),
  subject_id uuid not null,
  member_id uuid not null references public.members (id),
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

create function private.validate_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare found boolean;
begin
  if not exists (select 1 from public.members m where m.id = new.member_id and m.trip_id = new.trip_id) then
    raise exception 'Member must belong to this trip' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.member_id <> old.member_id or new.subject_type <> old.subject_type or new.subject_id <> old.subject_id then
      raise exception 'A comment can''t move to another person or subject' using errcode = '23514';
    end if;
    return new;
  end if;
  case new.subject_type
    when 'poll' then select exists (select 1 from public.polls s where s.id = new.subject_id and s.trip_id = new.trip_id) into found;
    when 'place' then select exists (select 1 from public.places s where s.id = new.subject_id and s.trip_id = new.trip_id) into found;
    else select exists (select 1 from public.itinerary_items s where s.id = new.subject_id and s.trip_id = new.trip_id) into found;
  end case;
  if not found then
    raise exception 'A comment must be about something on this trip' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_comment() from public;

create trigger validate_comment before insert or update on public.comments
  for each row execute function private.validate_comment();
create trigger sync_guard before insert or update on public.comments
  for each row execute function private.sync_guard();
create index comments_sync_idx on public.comments (trip_id, updated_at);
create index comments_subject_idx on public.comments (subject_type, subject_id);
create index comments_member_idx on public.comments (member_id);
alter table public.comments enable row level security;
create policy comments_select on public.comments for select to authenticated
  using ((select private.has_trip_access(trip_id)));
-- Writing needs this device to be that person, not just trip access.
create policy comments_insert on public.comments for insert to authenticated
  with check ((select private.has_trip_access(trip_id)) and private.claims_member(trip_id, member_id));
create policy comments_update on public.comments for update to authenticated
  using ((select private.has_trip_access(trip_id)) and private.claims_member(trip_id, member_id))
  with check ((select private.has_trip_access(trip_id)) and private.claims_member(trip_id, member_id));
alter publication supabase_realtime add table public.comments;
