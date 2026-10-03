import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const user = '11111111-1111-4111-8111-111111111111'
const trip = '22222222-2222-4222-8222-222222222222'
const other = '33333333-3333-4333-8333-333333333333'
const removed = '44444444-4444-4444-8444-444444444444'
const client = '55555555-5555-4555-8555-555555555555'
let pg: PGlite

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`
    create role authenticator; create role authenticated; create role anon; create role supabase_auth_admin;
    create schema auth; create schema private;
    create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims', true)::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table public.trips (id uuid primary key, name text, timezone text, start_date date, end_date date, base_currency text, local_currency text, deleted_at timestamptz, share_token text);
    create table public.trip_devices (trip_id uuid, user_id uuid);
    create function private.has_trip_access(t uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.trip_devices where trip_id=t and user_id=auth.uid()) $$;
    revoke execute on function private.has_trip_access(uuid) from public;
    create table public.itinerary_items (id uuid, trip_id uuid, title text, kind text, place_id uuid, to_place_id uuid, all_day boolean, start_local timestamp, start_tz text, end_local timestamp, end_tz text, start_at timestamptz, end_at timestamptz, status text, deleted_at timestamptz, confirmation_code text, notes text, details jsonb);
    create table public.expenses (id uuid, trip_id uuid, amount bigint);
    create table public.attachments (id uuid, trip_id uuid, storage_path text);
    create function public.create_trip() returns uuid language sql security definer as $$ insert into public.trips(id) values(gen_random_uuid()) returning id $$;
    revoke execute on function public.create_trip() from public;
    grant execute on function public.create_trip() to authenticated;
    alter table public.trips enable row level security;
    alter table public.itinerary_items enable row level security;
    insert into public.trips(id,name,share_token,deleted_at) values ('${trip}','My trip','secret',null),('${other}','Other trip','other-secret',null),('${removed}','Deleted trip','deleted-secret',now());
    insert into public.trip_devices values ('${trip}','${user}'),('${removed}','${user}');
    insert into public.itinerary_items(id,trip_id,title,confirmation_code) values (gen_random_uuid(),'${trip}','Dinner','private-code'),(gen_random_uuid(),'${other}','Other dinner','other-code'),(gen_random_uuid(),'${removed}','Removed trip dinner','removed-code');
    insert into public.itinerary_items(id,trip_id,title,deleted_at) values(gen_random_uuid(),'${trip}','Deleted dinner',now());
  `)
  await pg.exec(readFileSync(new URL('../supabase/migrations/20261008000001_chatgpt_connector.sql', import.meta.url), 'utf8'))
  await pg.exec(`insert into private.connector_oauth_config(client_id,resource_url) values('${client}','https://stowaway.example/mcp')`)
}, 30000)
afterAll(async () => { await pg?.close() })

async function asRole<T>(role: string, run: () => Promise<T>) {
  await pg.exec(`begin; set local role ${role}; select set_config('request.jwt.claims','{"sub":"${user}","role":"stowaway_connector"}', true);`)
  try { return await run() } finally { await pg.exec('rollback') }
}

describe('actual database connector permissions', () => {
  it('can read only live joined trips and their live itinerary items', async () => {
    await asRole('stowaway_connector', async () => {
      expect((await pg.query('select id,name from public.trips')).rows).toEqual([{ id: trip, name: 'My trip' }])
      expect((await pg.query('select title from public.itinerary_items')).rows).toEqual([{ title: 'Dinner' }])
      expect((await pg.query(`select id from public.trips where id='${other}'`)).rows).toEqual([])
    })
  })
  it('cannot read invitation tokens, booking codes, notes, expenses or tickets', async () => {
    for (const sql of ['select share_token from public.trips', 'select confirmation_code from public.itinerary_items',
      'select notes from public.itinerary_items', 'select details from public.itinerary_items', 'select * from public.expenses',
      'select * from public.attachments', 'select * from private.connector_oauth_config']) {
      await expect(asRole('stowaway_connector', () => pg.query(sql))).rejects.toThrow(/permission denied/)
    }
  })
  it('cannot modify rows or call membership/write RPCs directly', async () => {
    for (const sql of [`update public.trips set name='Changed' where id='${trip}'`,
      `insert into public.trips(id,name) values(gen_random_uuid(),'New')`, `delete from public.itinerary_items where trip_id='${trip}'`,
      'select public.create_trip()']) {
      await expect(asRole('stowaway_connector', () => pg.query(sql))).rejects.toThrow(/permission denied/)
    }
  })
  it('keeps first-party claims intact and issues bounded, resource-specific connector tokens', async () => {
    const claims = { role: 'authenticated', sub: user, aud: 'authenticated', exp: 4102444800, is_anonymous: false }
    await asRole('supabase_auth_admin', async () => {
      const regular = { user_id: user, claims }
      const normal = await pg.query<{ result: unknown }>('select public.connector_access_token_hook($1::jsonb) as result', [JSON.stringify(regular)])
      expect(normal.rows[0]!.result).toEqual(regular)
      const oauth = await pg.query<{ result: { claims: Record<string, unknown> } }>('select public.connector_access_token_hook($1::jsonb) as result', [JSON.stringify({ user_id: user, client_id: client, claims })])
      expect(oauth.rows[0]!.result.claims).toMatchObject({ role: 'stowaway_connector', aud: 'https://stowaway.example/mcp', scope: 'openid', client_id: client })
      expect(oauth.rows[0]!.result.claims.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 301)
    })
  })
  it('refuses anonymous accounts and unregistered OAuth clients', async () => {
    for (const event of [{ client_id: other, claims: { is_anonymous: false } }, { client_id: client, claims: { is_anonymous: true } }]) {
      await expect(asRole('supabase_auth_admin', () => pg.query('select public.connector_access_token_hook($1::jsonb)', [JSON.stringify(event)]))).rejects.toThrow()
    }
  })
})
