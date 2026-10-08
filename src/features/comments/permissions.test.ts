// Runs the real migrations for this release against PostgreSQL (PGlite), with just enough of the
// existing schema stubbed, and checks who can read and write comments and who gets notified.

import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const id = (n: number) => `${String(n).repeat(8)}-0000-4000-8000-000000000000`
const trip = id(1), otherTrip = id(2)
const alex = id(3), sam = id(4), kim = id(5), stranger = id(6)
const alexUser = id(7), samUser = id(8), outsiderUser = id(9)
const poll = 'aaaaaaaa-0000-4000-8000-000000000001', place = 'aaaaaaaa-0000-4000-8000-000000000002', item = 'aaaaaaaa-0000-4000-8000-000000000003'
const otherPoll = 'aaaaaaaa-0000-4000-8000-000000000004', option = 'aaaaaaaa-0000-4000-8000-000000000005'
let pg: PGlite
let next = 0
const fresh = () => `bbbbbbbb-0000-4000-8000-${String(++next).padStart(12, '0')}`
const migration = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), 'utf8')

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`
    create role authenticated; create role anon; create role service_role;
    create schema auth; create schema private;
    grant usage on schema private to authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    create publication supabase_realtime;
    create table public.trips (id uuid primary key, name text, timezone text default 'America/Guatemala');
    create table public.members (id uuid primary key, trip_id uuid, display_name text, deleted_at timestamptz);
    create table public.trip_devices (trip_id uuid, user_id uuid, member_id uuid);
    create table public.polls (id uuid primary key, trip_id uuid, title text, status text not null default 'open', winner_option_id uuid,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz, created_by uuid, updated_by uuid);
    create table public.poll_options (id uuid primary key, trip_id uuid, poll_id uuid, label text, deleted_at timestamptz);
    create table public.poll_votes (id uuid primary key default gen_random_uuid(), poll_id uuid, member_id uuid, score smallint);
    create table public.places (id uuid primary key, trip_id uuid, name text);
    create table public.itinerary_items (id uuid primary key, trip_id uuid, title text);
    create function private.has_trip_access(t uuid) returns boolean language sql stable security definer set search_path = '' as
      $$ select exists (select 1 from public.trip_devices where trip_id = t and user_id = auth.uid()) $$;
    create function private.claims_member(p_trip_id uuid, p_member_id uuid) returns boolean language sql stable security definer set search_path = '' as
      $$ select exists (select 1 from public.trip_devices where trip_id = p_trip_id and user_id = (select auth.uid()) and member_id = p_member_id) $$;
    grant execute on function private.has_trip_access(uuid), private.claims_member(uuid, uuid) to authenticated;
    create function private.member_name(p_member_id uuid) returns text language sql stable security definer set search_path = '' as
      $$ select coalesce((select display_name from public.members where id = p_member_id), 'Someone') $$;
    -- The parts of sync_guard that matter here: the server's clock, and deletes that stay deleted.
    create function private.sync_guard() returns trigger language plpgsql as $$
    begin
      new.updated_at := clock_timestamp();
      if tg_op = 'UPDATE' and old.deleted_at is not null then new.deleted_at := old.deleted_at; end if;
      return new;
    end $$;
    create trigger sync_guard before insert or update on public.polls for each row execute function private.sync_guard();
    create table private.push_queue (id bigint generated always as identity primary key, trip_id uuid, member_id uuid,
      kind text not null constraint push_queue_kind_check check (kind in ('vote', 'vote_nudge', 'expense', 'task', 'task_due', 'leave')),
      data jsonb not null, dedupe_key text not null unique, send_after timestamptz not null default now(), sent_at timestamptz, created_at timestamptz not null default now());
    create table private.push_reminders (member_id uuid, item_id uuid, item_start_at timestamptz, leave_at timestamptz, note text);
    create table public.push_subscriptions (trip_id uuid, member_id uuid, endpoint text, p256dh text, auth text, enabled boolean default true, prefs jsonb default '{}');
    create table public.trip_tasks (id uuid, trip_id uuid, title text, assignee_id uuid, due_date date, completed boolean, deleted_at timestamptz);
    alter table public.itinerary_items add column start_at timestamptz, add column all_day boolean, add column status text, add column kind text,
      add column attendee_ids uuid[], add column deleted_at timestamptz;

    insert into public.trips (id, name) values ('${trip}', 'Guatemala'), ('${otherTrip}', 'Elsewhere');
    insert into public.members (id, trip_id, display_name) values ('${alex}', '${trip}', 'Alex'), ('${sam}', '${trip}', 'Sam'), ('${kim}', '${trip}', 'Kim'), ('${stranger}', '${otherTrip}', 'Stranger');
    insert into public.trip_devices values ('${trip}', '${alexUser}', '${alex}'), ('${trip}', '${samUser}', '${sam}'), ('${otherTrip}', '${outsiderUser}', '${stranger}');
    insert into public.polls (id, trip_id, title, created_by) values ('${poll}', '${trip}', 'Where do we stay?', '${alex}'), ('${otherPoll}', '${otherTrip}', 'Not yours', '${stranger}');
    insert into public.poll_options (id, trip_id, poll_id, label) values ('${option}', '${trip}', '${poll}', 'Casa del Mundo');
    insert into public.places (id, trip_id, name) values ('${place}', '${trip}', 'Café Sabor');
    insert into public.itinerary_items (id, trip_id, title) values ('${item}', '${trip}', 'Lancha');
  `)
  await pg.exec(migration('20261012000001_poll_upgrades.sql'))
  await pg.exec(migration('20261012000002_comments.sql'))
  await pg.exec(migration('20261012000003_push_votes_comments.sql'))
  // Supabase grants table privileges to signed-in users by default; RLS does the real work.
  await pg.exec('grant select, insert, update, delete on public.comments to authenticated')
}, 60000)
afterAll(async () => { await pg?.close() })

/** Runs as a signed-in phone, then rolls back so tests don't see each other's rows. */
async function as<T>(user: string, run: () => Promise<T>): Promise<T> {
  await pg.exec(`begin; select set_config('request.jwt.sub', '${user}', true); set local role authenticated;`)
  try { return await run() } finally { await pg.exec('rollback') }
}
const insert = (member: string, type: string, subject: string, tripId = trip, body = 'Looks good') =>
  pg.query(`insert into public.comments (id, trip_id, subject_type, subject_id, member_id, body) values ('${fresh()}', '${tripId}', '${type}', '${subject}', '${member}', $1) returning id`, [body])
const queued = async (kind: string) =>
  (await pg.query<{ member_id: string; data: Record<string, unknown> }>(`select member_id, data from private.push_queue where kind = '${kind}' order by member_id`)).rows

describe('comments: who can read and write', () => {
  it('lets a member comment as themselves on a vote, a place and a plan item', async () => {
    await as(alexUser, async () => {
      for (const [type, subject] of [['poll', poll], ['place', place], ['item', item]] as const) await insert(alex, type, subject)
      expect((await pg.query('select count(*)::int as n from public.comments')).rows).toEqual([{ n: 3 }])
    })
  })

  it('refuses a comment written as someone else', async () => {
    await expect(as(alexUser, () => insert(sam, 'poll', poll))).rejects.toThrow(/row-level security/)
  })

  it('refuses a comment about something on another trip, or with nothing in it', async () => {
    await expect(as(alexUser, () => insert(alex, 'poll', otherPoll))).rejects.toThrow(/must be about something on this trip/)
    await expect(as(alexUser, () => insert(alex, 'place', poll))).rejects.toThrow(/must be about something on this trip/)
    await expect(as(alexUser, () => insert(alex, 'poll', poll, trip, '   '))).rejects.toThrow(/check constraint/)
    await expect(as(alexUser, () => insert(alex, 'poll', poll, trip, 'x'.repeat(1001)))).rejects.toThrow(/check constraint/)
  })

  it('keeps people outside the trip from reading or writing', async () => {
    const c = fresh()
    await pg.exec(`insert into public.comments (id, trip_id, subject_type, subject_id, member_id, body) values ('${c}', '${trip}', 'poll', '${poll}', '${alex}', 'Private to the trip')`)
    try {
      await as(outsiderUser, async () => {
        expect((await pg.query('select id from public.comments')).rows).toEqual([])
        expect((await pg.query(`update public.comments set body = 'Changed' where id = '${c}'`)).affectedRows).toBe(0)
      })
      // As themselves they are not on this trip; posing as a real member, they are not that person.
      await expect(as(outsiderUser, () => insert(stranger, 'poll', poll))).rejects.toThrow(/Member must belong to this trip/)
      await expect(as(outsiderUser, () => insert(alex, 'poll', poll))).rejects.toThrow(/row-level security/)
      await as(samUser, async () => {
        expect((await pg.query('select body from public.comments')).rows).toEqual([{ body: 'Private to the trip' }])
        // Another member can read it but not edit, remove or hard-delete it.
        expect((await pg.query(`update public.comments set body = 'Changed' where id = '${c}'`)).affectedRows).toBe(0)
        expect((await pg.query(`update public.comments set deleted_at = now() where id = '${c}'`)).affectedRows).toBe(0)
        expect((await pg.query(`delete from public.comments where id = '${c}'`)).affectedRows).toBe(0)
      })
      await as(alexUser, async () => {
        expect((await pg.query(`update public.comments set deleted_at = now() where id = '${c}'`)).affectedRows).toBe(1)
        expect((await pg.query(`delete from public.comments where id = '${c}'`)).affectedRows).toBe(0)
        await expect(pg.query(`update public.comments set member_id = '${sam}' where id = '${c}'`)).rejects.toThrow(/row-level security|can't move/)
      })
    } finally { await pg.exec(`delete from public.comments where id = '${c}'; delete from private.push_queue`) }
  })
})

describe('comments and votes: who is told', () => {
  it('tells earlier commenters, voters and whoever started the vote, never the author', async () => {
    await pg.exec(`begin; insert into public.poll_votes (poll_id, member_id, score) values ('${poll}', '${kim}', 3)`)
    try {
      await insert(sam, 'poll', poll, trip, 'Too far from the dock?')
      // Alex started the vote, Kim voted; Sam wrote it.
      expect((await queued('comment')).map((r) => r.member_id)).toEqual([alex, kim])
      expect((await queued('comment'))[0]!.data).toMatchObject({ subject_type: 'poll', subject_id: poll, subject: 'Where do we stay?', by: 'Sam', body: 'Too far from the dock?' })
      await pg.exec('delete from private.push_queue')
      await insert(sam, 'place', place)
      expect(await queued('comment')).toEqual([]) // nobody else is in that conversation yet
      await insert(alex, 'place', place)
      expect((await queued('comment')).map((r) => r.member_id)).toEqual([sam])
    } finally { await pg.exec('rollback') }
  })

  it('announces a result to everyone but whoever closed the vote, each time it is closed', async () => {
    await pg.exec('begin')
    try {
      await pg.exec(`update public.polls set status = 'closed', winner_option_id = '${option}', updated_by = '${sam}' where id = '${poll}'`)
      const first = await queued('vote_closed')
      expect(first.map((r) => r.member_id)).toEqual([alex, kim])
      expect(first[0]!.data).toMatchObject({ poll_id: poll, title: 'Where do we stay?', winner: 'Casa del Mundo' })
      await pg.exec(`update public.polls set title = 'Where do we stay at the lake?' where id = '${poll}'`)
      expect(await queued('vote_closed')).toHaveLength(2) // an edit to a closed vote is not news
      await pg.exec(`update public.polls set status = 'open', winner_option_id = null where id = '${poll}'`)
      await pg.exec(`update public.polls set status = 'closed', winner_option_id = null, updated_by = '${alex}' where id = '${poll}'`)
      expect(await queued('vote_closed')).toHaveLength(4)
    } finally { await pg.exec('rollback') }
  })

  it('nudges people who have not voted in the last 3 hours before a deadline, once', async () => {
    await pg.exec(`begin;
      update public.polls set closes_at = now() + interval '2 hours', created_at = now() - interval '1 day' where id = '${poll}';
      insert into public.poll_votes (poll_id, member_id, score) values ('${poll}', '${kim}', 2);`)
    try {
      await pg.exec('select private.push_enqueue_due(); select private.push_enqueue_due();')
      expect((await queued('vote_closing')).map((r) => r.member_id)).toEqual([alex, sam])
      expect(await queued('vote_nudge')).toEqual([]) // a deadline vote gets "closing soon" instead of the day-later nudge
    } finally { await pg.exec('rollback') }
  })

  it('accepts date options only as a whole, in order', async () => {
    const add = (starts: string | null, ends: string | null) =>
      pg.query(`insert into public.poll_options (id, trip_id, poll_id, label, starts_on, ends_on) values ('${fresh()}', '${trip}', '${poll}', 'x', $1, $2)`, [starts, ends])
    await pg.exec('begin')
    try {
      await add('2027-03-13', '2027-03-20')
      await add(null, null)
      await pg.exec('savepoint s')
      await expect(add('2027-03-20', '2027-03-13')).rejects.toThrow(/poll_options_dates_check/)
      await pg.exec('rollback to s')
      await expect(add('2027-03-13', null)).rejects.toThrow(/poll_options_dates_check/)
    } finally { await pg.exec('rollback') }
  })
})
