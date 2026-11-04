-- Calendar apps cannot send a Supabase session. A separate, revocable read-only token
-- exposes only calendar fields, never the trip invite, notes, booking codes or files.
create table private.calendar_feeds (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid references public.members(id),
  access_epoch integer not null,
  token text not null unique,
  expires_at timestamptz not null default now() + interval '1 year',
  primary key (trip_id, user_id)
);
alter table private.calendar_feeds enable row level security;
revoke all on private.calendar_feeds from public, anon, authenticated;

create function public.create_calendar_feed(p_trip_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_token text; v_member uuid; v_epoch integer;
begin
  if auth.uid() is null or not private.has_trip_access(p_trip_id) then raise exception 'Trip access required' using errcode = '42501'; end if;
  select d.member_id, t.access_epoch into v_member, v_epoch
    from public.trip_devices d join public.trips t on t.id = d.trip_id
    where d.trip_id = p_trip_id and d.user_id = auth.uid() and t.deleted_at is null;
  if not found then raise exception 'Trip unavailable' using errcode = '42501'; end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.calendar_feeds(trip_id,user_id,member_id,access_epoch,token)
    values(p_trip_id,auth.uid(),v_member,v_epoch,v_token)
    on conflict(trip_id,user_id) do update set member_id=excluded.member_id,access_epoch=excluded.access_epoch,token=excluded.token,expires_at=now()+interval '1 year';
  return v_token;
end $$;

create function public.revoke_calendar_feed(p_trip_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  delete from private.calendar_feeds where trip_id=p_trip_id and user_id=auth.uid();
end $$;

create function public.read_calendar_feed(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare f private.calendar_feeds; v_name text; v_items jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;
  select c.* into f from private.calendar_feeds c
    join public.trips t on t.id=c.trip_id
    join public.trip_devices d on d.trip_id=c.trip_id and d.user_id=c.user_id
    where c.token=p_token and c.expires_at>now() and t.deleted_at is null
      and c.access_epoch=t.access_epoch and d.role<>'pending'
      and d.member_id is not distinct from c.member_id
      and (t.access_mode='group' or d.role in ('owner','admin','traveler','viewer'))
      and not exists(select 1 from private.trip_revocations r where r.trip_id=c.trip_id and r.user_id=c.user_id);
  if not found then return null; end if;
  select name into v_name from public.trips where id=f.trip_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'uid', i.id::text || '@stowaway', 'title', i.title,
    'start', case when i.all_day or i.kind='lodging' then to_char(i.start_local,'YYYY-MM-DD') else to_jsonb(i.start_at)#>>'{}' end,
    'end', case when i.all_day or i.kind='lodging' then to_char(i.end_local,'YYYY-MM-DD') else to_jsonb(i.end_at)#>>'{}' end,
    'allDay', i.all_day or i.kind='lodging', 'tentative', i.status<>'confirmed',
    'updatedAt', i.updated_at, 'location', concat_ws(', ', p.name, p.address)
  ) order by i.start_at, i.id), '[]'::jsonb) into v_items
    from public.itinerary_items i left join public.places p on p.id=i.place_id and p.trip_id=i.trip_id and p.deleted_at is null
    where i.trip_id=f.trip_id and i.deleted_at is null and i.status<>'cancelled'
      and (i.attendee_ids is null or f.member_id=any(i.attendee_ids));
  return jsonb_build_object('name', v_name, 'events', v_items);
end $$;

revoke all on function public.create_calendar_feed(uuid), public.revoke_calendar_feed(uuid), public.read_calendar_feed(text) from public, anon, authenticated;
grant execute on function public.create_calendar_feed(uuid), public.revoke_calendar_feed(uuid) to authenticated;
grant execute on function public.read_calendar_feed(text) to anon, authenticated;
