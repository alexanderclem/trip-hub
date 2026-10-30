-- Reconstructed 30 Oct 2026 from the live project, where it was applied as three migrations that
-- never reached this repository (connector_editing, connector_two_clients, connector_places_undo).
-- It turns the schema of 20261008000001_chatgpt_connector.sql into what live has, and is written so
-- applying it to live again changes nothing. Read the definitions with pg_get_functiondef, not from
-- the original files.
--
-- What it adds: a second OAuth client slot; places readable by the connector; itinerary editing for
-- signed-in accounts that turn it on in Connected apps (connector_edit_access), with a change log
-- and undo (private.connector_changes). No app code calls these yet.

-- ─── Two OAuth clients ──────────────────────────────────────────────────────

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'private' and table_name = 'connector_oauth_config' and column_name = 'singleton') then
    alter table private.connector_oauth_config drop constraint connector_oauth_config_pkey;
    alter table private.connector_oauth_config drop column singleton;
    alter table private.connector_oauth_config add primary key (client_id);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'private' and table_name = 'connector_oauth_config' and column_name = 'slot') then
    alter table private.connector_oauth_config add column slot smallint not null default 2 check (slot in (1, 2));
    alter table private.connector_oauth_config add constraint connector_oauth_config_slot_key unique (slot);
  end if;
end $$;

create or replace function public.connector_access_token_hook(event jsonb)
 returns jsonb
 language plpgsql
 stable
 set search_path to ''
as $function$
declare
  claims jsonb := event -> 'claims';
  oauth_client text := coalesce(event ->> 'client_id', event -> 'claims' ->> 'client_id');
  config private.connector_oauth_config%rowtype;
begin
  if oauth_client is null or oauth_client = '' then return event; end if;
  select * into config from private.connector_oauth_config where client_id::text=oauth_client;
  if config.client_id is null then raise exception 'OAuth client is not configured for Stowaway'; end if;
  if claims ->> 'is_anonymous' is distinct from 'false' then
    raise exception 'Sign in to a Stowaway account before connecting';
  end if;
  claims := claims || jsonb_build_object('role','stowaway_connector','aud',config.resource_url,
    'client_id',oauth_client,'scope','openid',
    'exp',least((claims ->> 'exp')::bigint,extract(epoch from now())::bigint+300));
  return jsonb_set(event,'{claims}',claims);
end $function$;

-- ─── Places, readable by the connector ──────────────────────────────────────

grant select (id, trip_id, name, category, lat, lng, address, area, status, opening_hours, website, deleted_at)
  on public.places to stowaway_connector;
grant select (updated_at) on public.itinerary_items to stowaway_connector;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'places' and policyname = 'connector_read_places') then
    create policy connector_read_places on public.places for select to stowaway_connector
      using (deleted_at is null and private.has_trip_access(trip_id)
        and exists (select 1 from public.trips where trips.id = places.trip_id and trips.deleted_at is null));
  end if;
end $$;

-- ─── Itinerary editing with undo ────────────────────────────────────────────

create table if not exists private.connector_edit_grants (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null,
  primary key (user_id, client_id)
);
alter table private.connector_edit_grants enable row level security;

create table if not exists private.connector_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null,
  trip_id uuid not null references public.trips (id) on delete cascade,
  item_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete')),
  title text not null,
  before_values jsonb,
  after_revision timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  undone_at timestamptz,
  undo_result jsonb
);
create index if not exists connector_changes_account_idx on private.connector_changes (user_id, client_id, trip_id, created_at desc, id);
alter table private.connector_changes enable row level security;

create or replace function public.connector_client_allowed()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists(select 1 from private.connector_oauth_config
    where client_id::text=auth.jwt()->>'client_id'
      and resource_url=auth.jwt()->>'aud'
      and auth.jwt()->>'role'='stowaway_connector')
$function$;

create or replace function public.connector_edit_access(p_client_id uuid, p_enabled boolean default null::boolean)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if auth.uid() is null or auth.jwt()->>'is_anonymous' is distinct from 'false'
    or nullif(auth.jwt()->>'client_id','') is not null then
    raise exception 'Sign in to Stowaway to manage editing access';
  end if;
  if p_enabled is true then
    if not exists(select 1 from private.connector_oauth_config where client_id=p_client_id) then
      raise exception 'This client is not configured for Stowaway';
    end if;
    insert into private.connector_edit_grants values(auth.uid(),p_client_id) on conflict do nothing;
  elsif p_enabled is false then
    delete from private.connector_edit_grants where user_id=auth.uid() and client_id=p_client_id;
  end if;
  return exists(select 1 from private.connector_edit_grants where user_id=auth.uid() and client_id=p_client_id);
end $function$;

create or replace function public.connector_list_changes(p_trip_id uuid, p_limit integer default 20, p_offset integer default 0)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if auth.jwt()->>'role' is distinct from 'stowaway_connector' or not public.connector_client_allowed()
    or not private.has_trip_access(p_trip_id) or not exists(select 1 from public.trips where id=p_trip_id and deleted_at is null) then
    raise exception 'Trip is unavailable';
  end if;
  if p_limit not between 1 and 50 or p_offset not between 0 and 10000 or p_limit is null or p_offset is null then
    raise exception 'Invalid pagination';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('changeId',id,'itemId',item_id,'action',action,
    'title',title,'createdAt',created_at,'undoneAt',undone_at) order by created_at desc,id),'[]')
    from (select * from private.connector_changes where user_id=auth.uid()
      and client_id::text=auth.jwt()->>'client_id' and trip_id=p_trip_id order by created_at desc,id limit p_limit offset p_offset) changes);
end $function$;

create or replace function private.connector_mutate_itinerary_base(p_action text, p_trip_id uuid, p_item_id uuid, p_expected_updated_at timestamp with time zone default null::timestamp with time zone, p_changes jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  item public.itinerary_items%rowtype;
  fresh public.itinerary_items%rowtype;
begin
  if auth.jwt()->>'role' is distinct from 'stowaway_connector'
    or auth.jwt()->>'is_anonymous' is distinct from 'false'
    or not exists(select 1 from private.connector_edit_grants g join private.connector_oauth_config c
      on c.client_id=g.client_id where g.user_id=auth.uid() and g.client_id::text=auth.jwt()->>'client_id') then
    raise exception 'Enable itinerary editing in Stowaway Connected apps first';
  end if;
  if not private.has_trip_access(p_trip_id) or not exists(select 1 from public.trips where id=p_trip_id and deleted_at is null) then
    raise exception 'Trip is unavailable';
  end if;
  if p_action not in ('create','update','delete') or p_action is null
    or p_item_id is null or p_changes is null or jsonb_typeof(p_changes) <> 'object'
    or exists(select 1 from jsonb_object_keys(p_changes) k where k not in
      ('title','kind','all_day','start_local','start_tz','end_local','end_tz','status')) then
    raise exception 'Unsupported itinerary change';
  end if;
  -- Serialize duplicate creates, and lock updates before comparing the revision.
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text,0));
  select * into item from public.itinerary_items where id=p_item_id for update;
  if found then
    if item.trip_id<>p_trip_id or item.deleted_at is not null then raise exception 'Item is unavailable'; end if;
    if p_action='create' then
      if jsonb_populate_record(item,p_changes) is not distinct from item then p_action:='retry';
      else raise exception 'Item ID already exists; read the itinerary before retrying'; end if;
    end if;
    if p_action<>'retry' and (p_expected_updated_at is null or item.updated_at<>p_expected_updated_at) then
      raise exception 'Item changed; read the itinerary again before editing';
    end if;
  elsif p_action <> 'create' then raise exception 'Item is unavailable';
  end if;
  if p_action='delete' then
    update public.itinerary_items set deleted_at=clock_timestamp() where id=p_item_id;
    return jsonb_build_object('itemId',p_item_id,'deleted',true);
  end if;
  if p_action='create' then
    item.id:=p_item_id; item.trip_id:=p_trip_id; item.kind:='activity'; item.status:='confirmed'; item.all_day:=false;
  end if;
  select * into fresh from jsonb_populate_record(item,p_changes);
  if fresh.title is null or length(trim(fresh.title)) not between 1 and 200
    or fresh.kind not in ('activity','meal','flight','transport','lodging','reservation','free')
    or fresh.status not in ('idea','tentative','confirmed','cancelled') or fresh.all_day is null
    or fresh.start_local is null or fresh.start_tz is null then raise exception 'Invalid itinerary details'; end if;
  if fresh.end_local is null then fresh.end_tz:=null;
  elsif fresh.end_tz is null then fresh.end_tz:=fresh.start_tz; end if;
  fresh.start_at:=fresh.start_local at time zone fresh.start_tz;
  fresh.end_at:=case when fresh.end_local is null then null else fresh.end_local at time zone fresh.end_tz end;
  if fresh.end_at<fresh.start_at then raise exception 'Item ends before it starts'; end if;
  if p_action='create' then
    insert into public.itinerary_items(id,trip_id,title,kind,all_day,start_local,start_tz,end_local,end_tz,status)
    values(p_item_id,p_trip_id,fresh.title,fresh.kind,fresh.all_day,fresh.start_local,fresh.start_tz,fresh.end_local,fresh.end_tz,fresh.status)
    returning * into item;
  elsif p_action='update' then
    update public.itinerary_items set title=fresh.title,kind=fresh.kind,all_day=fresh.all_day,
      start_local=fresh.start_local,start_tz=fresh.start_tz,end_local=fresh.end_local,end_tz=fresh.end_tz,status=fresh.status
    where id=p_item_id returning * into item;
  end if;
  return jsonb_build_object('item',jsonb_build_object('id',item.id,'trip_id',item.trip_id,'title',item.title,'kind',item.kind,
    'all_day',item.all_day,'start_local',item.start_local,'start_tz',item.start_tz,'end_local',item.end_local,
    'end_tz',item.end_tz,'start_at',item.start_at,'end_at',item.end_at,'status',item.status,'updated_at',item.updated_at), 'deleted',false);
end $function$;

create or replace function public.connector_mutate_itinerary(p_action text, p_trip_id uuid, p_item_id uuid, p_expected_updated_at timestamp with time zone default null::timestamp with time zone, p_changes jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  previous public.itinerary_items%rowtype;
  current_item public.itinerary_items%rowtype;
  result jsonb;
  change_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text,0));
  select * into previous from public.itinerary_items where id=p_item_id;
  result:=private.connector_mutate_itinerary_base(p_action,p_trip_id,p_item_id,p_expected_updated_at,p_changes);
  select * into current_item from public.itinerary_items where id=p_item_id;
  if previous.updated_at is not distinct from current_item.updated_at then
    select id into change_id from private.connector_changes where item_id=p_item_id
      and after_revision=current_item.updated_at and user_id=auth.uid()
      and client_id::text=auth.jwt()->>'client_id' order by created_at desc limit 1;
  else
    insert into private.connector_changes(user_id,client_id,trip_id,item_id,action,title,before_values,after_revision)
    values(auth.uid(),(auth.jwt()->>'client_id')::uuid,p_trip_id,p_item_id,p_action,current_item.title,
      case when previous.id is null then null else jsonb_build_object('title',previous.title,'kind',previous.kind,
        'all_day',previous.all_day,'start_local',previous.start_local,'start_tz',previous.start_tz,
        'end_local',previous.end_local,'end_tz',previous.end_tz,'status',previous.status) end,current_item.updated_at)
    returning id into change_id;
  end if;
  return result||jsonb_build_object('changeId',change_id);
end $function$;

create or replace function public.connector_undo_change(p_change_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  change private.connector_changes%rowtype;
  item public.itinerary_items%rowtype;
  result jsonb;
begin
  if auth.jwt()->>'role' is distinct from 'stowaway_connector' or auth.jwt()->>'is_anonymous' is distinct from 'false'
    or not public.connector_client_allowed()
    or not exists(select 1 from private.connector_edit_grants where user_id=auth.uid() and client_id::text=auth.jwt()->>'client_id') then
    raise exception 'Enable itinerary editing in Stowaway Connected apps first';
  end if;
  select * into change from private.connector_changes where id=p_change_id
    and user_id=auth.uid() and client_id::text=auth.jwt()->>'client_id' for update;
  if not found then raise exception 'Change is unavailable'; end if;
  if not private.has_trip_access(change.trip_id) or not exists(select 1 from public.trips where id=change.trip_id and deleted_at is null) then
    raise exception 'Trip is unavailable';
  end if;
  if change.undone_at is not null then return change.undo_result; end if;
  perform pg_advisory_xact_lock(hashtextextended(change.item_id::text,0));
  select * into item from public.itinerary_items where id=change.item_id for update;
  if not found or item.updated_at<>change.after_revision then
    raise exception 'Item changed since this action; undo would overwrite newer edits';
  end if;
  if change.action='create' then
    result:=private.connector_mutate_itinerary_base('delete',change.trip_id,item.id,item.updated_at,'{}');
  elsif change.action='update' then
    result:=private.connector_mutate_itinerary_base('update',change.trip_id,item.id,item.updated_at,change.before_values);
  else
    if item.deleted_at is null then raise exception 'Item is unavailable'; end if;
    -- Preserve the sync tombstone. Restore as a new row instead of resurrecting an old ID.
    item.id:=gen_random_uuid(); item.deleted_at:=null; item.created_by:=null; item.updated_by:=null;
    insert into public.itinerary_items select (item).* returning * into item;
    result:=jsonb_build_object('itemId',item.id,'restoredFromItemId',change.item_id,'deleted',false);
  end if;
  result:=result||jsonb_build_object('changeId',change.id,'undone',true);
  update private.connector_changes set undone_at=clock_timestamp(),undo_result=result where id=change.id;
  return result;
end $function$;

-- Execute rights exactly as live has them.
revoke all on function public.connector_client_allowed(), public.connector_edit_access(uuid, boolean),
  public.connector_list_changes(uuid, integer, integer), private.connector_mutate_itinerary_base(text, uuid, uuid, timestamptz, jsonb),
  public.connector_mutate_itinerary(text, uuid, uuid, timestamptz, jsonb), public.connector_undo_change(uuid) from public, anon, authenticated;
grant execute on function public.connector_client_allowed(), public.connector_list_changes(uuid, integer, integer),
  public.connector_mutate_itinerary(text, uuid, uuid, timestamptz, jsonb), public.connector_undo_change(uuid) to stowaway_connector;
grant execute on function public.connector_edit_access(uuid, boolean) to authenticated;
