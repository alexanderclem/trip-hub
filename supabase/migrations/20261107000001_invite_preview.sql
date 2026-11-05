-- Invite link previews.
--
-- The invite token travels in the link's #fragment, which chat apps never send when they fetch a
-- preview. Links now also carry a preview key in the path: /join/p/<key>#t=<token>. The key is a
-- one-way digest of the token, so it can't be turned back into the token and grants no access.
-- It only lets the Worker show the trip's name, dates and group size in the link preview.
--
-- A trigger keeps it in step with share_token, so rotating the link (rotate_share_token,
-- remove_from_trip) retires the old preview too, and a phone can't set it to anything else.

alter table public.trips add column preview_key text;

create or replace function private.trip_preview_key() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.preview_key := left(encode(pg_catalog.sha256(pg_catalog.convert_to(new.share_token, 'UTF8')), 'hex'), 20);
  return new;
end $$;

-- Named to run after sync_guard (triggers fire in name order), which may restore share_token.
create trigger zz_trip_preview_key before insert or update on public.trips
  for each row execute function private.trip_preview_key();

-- Backfill. The update also bumps updated_at, so phones pull the new column.
update public.trips set preview_key = null;

create index trips_preview_key_idx on public.trips (preview_key) where deleted_at is null;

-- What a link preview may show: name, dates and how many people are in the group. Nothing else.
create or replace function public.invite_preview(p_key text)
returns table (name text, start_date date, end_date date, people integer)
language sql stable security definer set search_path = '' as $$
  select t.name, t.start_date, t.end_date,
    (select count(*)::integer from public.members m where m.trip_id = t.id and m.deleted_at is null)
  from public.trips t
  where p_key ~ '^[0-9a-f]{20}$' and t.preview_key = p_key and t.deleted_at is null
  limit 1
$$;

revoke all on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;
