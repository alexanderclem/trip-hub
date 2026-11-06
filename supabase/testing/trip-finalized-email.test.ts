// public.queue_trip_finalized_email (20261108000001): the agent's "itinerary is ready" email.
import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asUser, asUserCommit, migratedDb } from './db'
import { T1, T2, U, seed } from './fixtures'

const plan = JSON.stringify({ summary: 'A week in Antigua.', currency: 'USD', totalMinor: 230000, days: [{ date: '2027-03-22', stay: 'Casa', items: [] }] })
const call = (pg: PGlite, trip: string, key = 'plan1', body = plan) =>
  pg.query<{ r: string }>('select public.queue_trip_finalized_email($1, $2, $3::jsonb) as r', [trip, key, body]).then((x) => x.rows[0]!.r)
const outbox = async (pg: PGlite) => (await pg.query<{ to_email: string; template: string; data: Record<string, unknown> }>('select to_email, template, data from private.email_outbox')).rows

describe('queue_trip_finalized_email', () => {
  let pg: PGlite
  beforeAll(async () => {
    pg = await migratedDb()
    await pg.exec('alter table auth.users add column email text, add column is_anonymous boolean')
    await seed(pg)
    await pg.exec(`update auth.users set email = 'ana@example.com', is_anonymous = false where id = '${U.A}'; update auth.users set is_anonymous = true where id = '${U.B}'`)
  }, 60000)

  it('queues one email to the caller’s own address, with the trip filled in by the server', async () => {
    expect(await asUserCommit(pg, U.A, () => call(pg, T1), { anonymous: false })).toBe('queued')
    expect(await asUserCommit(pg, U.A, () => call(pg, T1), { anonymous: false })).toBe('queued') // same plan: deduped
    const rows = await outbox(pg)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ to_email: 'ana@example.com', template: 'trip_finalized' })
    expect(rows[0]!.data).toMatchObject({ trip_name: 'Trip one', traveler_name: 'Ana', total_minor: 230000, trip_url: `https://joinstowaway.app/t/${T1}/plan` })
  })

  it('does nothing for a guest device with no account email', async () => {
    expect(await asUser(pg, U.B, () => call(pg, T1, 'plan2'))).toBe('no_email')
  })

  it('refuses trips the caller has not joined and malformed plans', async () => {
    await expect(asUser(pg, U.A, () => call(pg, T2, 'plan3'), { anonymous: false })).rejects.toThrow(/Join this trip/)
    await expect(asUser(pg, U.A, () => call(pg, T1, 'bad key!'), { anonymous: false })).rejects.toThrow(/Invalid plan/)
    await expect(asUser(pg, U.A, () => call(pg, T1, 'plan4', '{"days": "nope"}'), { anonymous: false })).rejects.toThrow(/Invalid plan/)
  })
})
