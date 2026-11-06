import { beforeAll, afterAll, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asAnon, asUser, asUserCommit, migratedDb } from './db'
import { T1, T2, U, M, seed } from './fixtures'

let pg: PGlite
const one = async <T,>(sql: string, params: unknown[] = []) => (await pg.query<{ result: T }>(sql, params)).rows[0]!.result
const create = () => asUserCommit(pg, U.A, () => one<string>('select public.create_calendar_feed($1) result', [T1]))
const read = (token: string) => asAnon(pg, () => one<{ name: string; events: { title: string; start: string }[] } | null>('select public.read_calendar_feed($1) result', [token]))
beforeAll(async () => { pg = await migratedDb(); await seed(pg) }, 60000)
afterAll(async () => { await pg?.close() })

it('requires trip membership and denies anonymous management or direct token-table access', async () => {
  await expect(asUser(pg, U.X, () => pg.query('select public.create_calendar_feed($1)', [T1]))).rejects.toThrow(/access/)
  await expect(asAnon(pg, () => pg.query('select public.create_calendar_feed($1)', [T1]))).rejects.toThrow(/permission/)
  await expect(asUser(pg, U.A, () => pg.query('select * from private.calendar_feeds'))).rejects.toThrow(/permission/)
  expect(await read('bad')).toBeNull()
  expect(await read('f'.repeat(64))).toBeNull()
})
it('only exports calendar fields and this person’s activities, with live edits', async () => {
  const token = await create()
  await pg.query(`insert into public.itinerary_items(id,trip_id,title,kind,start_local,start_tz,attendee_ids,notes,confirmation_code)
    values(gen_random_uuid(),$1,'Private policy','activity','2027-03-15T09:00','America/New_York',$2,'secret medical notes','PRIVATE123')`, [T1, [M.A]])
  await pg.query(`insert into public.itinerary_items(id,trip_id,title,kind,start_local,start_tz,attendee_ids)
    values(gen_random_uuid(),$1,'Other traveler only','activity','2027-03-15T10:00','UTC',$2)`, [T1, [M.B]])
  const payload = await read(token)
  expect(payload?.events.some((e) => e.title === 'Private policy' && e.start.includes('T'))).toBe(true)
  expect(payload?.events.some((e) => e.title === 'Other traveler only')).toBe(false)
  expect(JSON.stringify(payload)).not.toMatch(/secret medical|PRIVATE123|share_token|confirmation_code|notes/)
  await pg.query(`update public.itinerary_items set title='Edited plan' where title='Private policy'`)
  expect((await read(token))?.events.some((e) => e.title === 'Edited plan')).toBe(true)
})
it('rotation, revocation, expiry, identity changes and access changes invalidate old links', async () => {
  const first = await create(), second = await create()
  expect(first).not.toBe(second); expect(await read(first)).toBeNull()
  await asUserCommit(pg, U.A, () => pg.query('select public.revoke_calendar_feed($1)', [T1]))
  expect(await read(second)).toBeNull()
  const expired = await create()
  await pg.query(`update private.calendar_feeds set expires_at=now()-interval '1 day'`)
  expect(await read(expired)).toBeNull()
  const epoch = await create()
  // Bypass the mutation guard as the database owner, exactly as server access RPCs do.
  await pg.exec(`alter table public.trips disable trigger user; update public.trips set access_epoch=access_epoch+1 where id='${T1}'; alter table public.trips enable trigger user;`)
  expect(await read(epoch)).toBeNull()
  const member = await create()
  await pg.query('update public.trip_devices set member_id=$1 where trip_id=$2 and user_id=$3', [M.B, T1, U.A])
  expect(await read(member)).toBeNull()
  const pending = await create()
  await pg.query(`update public.trip_devices set role='pending' where trip_id=$1 and user_id=$2`, [T1, U.A])
  expect(await read(pending)).toBeNull()
  await expect(asUser(pg, U.A, () => pg.query('select public.create_calendar_feed($1)', [T2]))).rejects.toThrow()
})
