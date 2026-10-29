// A Postgres (PGlite) with every migration in supabase/migrations applied, for testing policies and
// RPCs against the real SQL. Supabase-only pieces (auth, storage, vault, pg_cron, pg_net) are stubbed
// just enough for the migrations to apply; nothing here calls the network.

import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS = new URL('../migrations/', import.meta.url)

const STUBS = `
  create role authenticator; create role authenticated; create role anon; create role service_role bypassrls;
  create role supabase_auth_admin;
  create schema auth; create schema storage; create schema vault; create schema cron; create schema net;
  create schema extensions;
  grant usage on schema auth to authenticated, anon;
  create table auth.users (id uuid primary key);
  create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt() ->> 'sub')::uuid $$;
  create function extensions.gen_random_bytes(n int) returns bytea language sql volatile as $$
    select substring(decode(md5(random()::text) || md5(random()::text) || md5(random()::text) || md5(random()::text), 'hex') from 1 for n)
  $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select, insert, update on storage.objects to authenticated;
  create table vault.secrets (name text primary key, secret text);
  create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;
  create function vault.create_secret(s text, n text) returns void language sql as $$ insert into vault.secrets values (n, s) $$;
  create function cron.schedule(name text, schedule text, command text) returns bigint language sql as $$ select 1::bigint $$;
  create function net.http_post(url text, headers jsonb default '{}', body jsonb default '{}', timeout_milliseconds int default 1000) returns bigint language sql as $$ select 1::bigint $$;
  create publication supabase_realtime;
  grant usage on schema public to authenticated, anon;
  alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, anon, service_role;
  alter default privileges in schema public grant execute on functions to authenticated, anon, service_role;
`

/** Migration file names in the order Supabase applies them. */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
}

function prepare(sql: string): string {
  // Extensions aren't available in PGlite; their functions are stubbed above.
  return sql.replace(/create extension[^;]*;/gi, '')
}

/** A fresh database with every migration applied (or only those before `until`, exclusive). */
export async function migratedDb(options: { until?: string } = {}): Promise<PGlite> {
  const pg = new PGlite()
  await pg.exec(STUBS)
  for (const file of migrationFiles()) {
    if (options.until && file >= options.until) break
    try {
      await pg.exec(prepare(readFileSync(new URL(file, MIGRATIONS), 'utf8')))
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return pg
}

/** Runs `fn` as a signed-in user (role authenticated) inside a transaction that is rolled back. */
export async function asUser<T>(pg: PGlite, userId: string, fn: () => Promise<T>, opts: { anonymous?: boolean; keep?: boolean } = {}): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: 'authenticated', is_anonymous: opts.anonymous ?? true })
  await pg.exec(`begin; set local role authenticated; select set_config('request.jwt.claims', '${claims}', true);`)
  try {
    const result = await fn()
    await pg.exec(opts.keep ? 'commit' : 'rollback')
    return result
  } catch (e) {
    await pg.exec('rollback')
    throw e
  }
}

/** Runs `fn` as a signed-in user and keeps what it wrote. */
export const asUserCommit = <T>(pg: PGlite, userId: string, fn: () => Promise<T>, opts: { anonymous?: boolean } = {}) =>
  asUser(pg, userId, fn, { ...opts, keep: true })
