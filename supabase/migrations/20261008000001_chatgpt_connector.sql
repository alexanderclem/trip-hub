-- Dedicated OAuth role: connector credentials cannot use normal authenticated grants,
-- write APIs, membership RPCs, expenses, ticket storage, or trip invitation tokens.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'stowaway_connector') then
    create role stowaway_connector nologin noinherit;
  end if;
end $$;
grant stowaway_connector to authenticator;
grant usage on schema public, private, auth to stowaway_connector;
grant execute on function auth.uid(), auth.jwt(), private.has_trip_access(uuid) to stowaway_connector;

grant select (id, name, timezone, start_date, end_date, base_currency, local_currency, deleted_at)
  on public.trips to stowaway_connector;
grant select (id, trip_id, title, kind, place_id, to_place_id, all_day,
  start_local, start_tz, end_local, end_tz, start_at, end_at, status, deleted_at)
  on public.itinerary_items to stowaway_connector;

create policy connector_read_trips on public.trips for select to stowaway_connector
  using (deleted_at is null and (select private.has_trip_access(id)));
create policy connector_read_itinerary on public.itinerary_items for select to stowaway_connector
  using (deleted_at is null and (select private.has_trip_access(trip_id))
    and exists (select 1 from public.trips where id = trip_id and deleted_at is null));

-- Configure this with the pre-registered ChatGPT OAuth client and the exact MCP URL.
-- There is deliberately no default client: third-party token issuance fails closed.
create table private.connector_oauth_config (
  singleton boolean primary key default true check (singleton),
  client_id uuid not null,
  resource_url text not null check (resource_url ~ '^https://[^/]+/mcp$')
);
alter table private.connector_oauth_config enable row level security;
grant usage on schema private to supabase_auth_admin;
grant select on private.connector_oauth_config to supabase_auth_admin;
create policy auth_read_connector_config on private.connector_oauth_config
  for select to supabase_auth_admin using (true);

-- Enable as the Custom Access Token Hook in Supabase Auth only after configuring
-- the row above. If another hook already exists, merge this logic into that hook.
create function public.connector_access_token_hook(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  claims jsonb := event -> 'claims';
  oauth_client text := coalesce(event ->> 'client_id', event -> 'claims' ->> 'client_id');
  config private.connector_oauth_config%rowtype;
begin
  -- First-party browser and guest sessions retain their original permissions.
  if oauth_client is null or oauth_client = '' then return event; end if;
  select * into config from private.connector_oauth_config where singleton;
  if config.client_id is null or oauth_client <> config.client_id::text then
    raise exception 'OAuth client is not configured for Stowaway';
  end if;
  if claims ->> 'is_anonymous' is distinct from 'false' then
    raise exception 'Sign in to a Stowaway account before connecting';
  end if;
  claims := claims || jsonb_build_object(
    'role', 'stowaway_connector', 'aud', config.resource_url,
    'client_id', oauth_client, 'scope', 'openid',
    'exp', least((claims ->> 'exp')::bigint, extract(epoch from now())::bigint + 300));
  return jsonb_set(event, '{claims}', claims);
end $$;
revoke execute on function public.connector_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.connector_access_token_hook(jsonb) to supabase_auth_admin;
