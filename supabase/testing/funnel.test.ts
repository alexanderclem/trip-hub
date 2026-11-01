import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asUser, asUserCommit, migratedDb } from './db'
import { T1, T2, U, seed } from './fixtures'

let pg: PGlite
const events = (sql = '') => pg.query<{ kind: string; trip_id: string | null }>(`select kind, trip_id from private.product_events ${sql} order by id`).then((r) => r.rows)

beforeAll(async () => {
  pg = await migratedDb()
  await seed(pg)
}, 60000)
afterAll(async () => { await pg?.close() })

describe('funnel events', () => {
  it('records trips and people joining from the server side', async () => {
    const created = await events(`where kind = 'trip_created'`)
    expect(created.map((e) => e.trip_id).sort()).toEqual([T1, T2])
    expect((await events(`where kind = 'member_joined' and trip_id = '${T1}'`)).length).toBe(3)
  })

  it('takes allowed events for the caller’s own trips', async () => {
    const kept = await asUserCommit(pg, U.B, async () => (await pg.query<{ n: number }>(`select public.log_events($1::jsonb) as n`, [JSON.stringify([
      { kind: 'invite_shared', trip_id: T1, props: { method: 'copy' } },
      { kind: 'money_moment_shown', trip_id: T1, props: { reason: 'size' } },
    ])])).rows[0]!.n)
    expect(kept).toBe(2)
    expect(await events(`where kind in ('invite_shared', 'money_moment_shown')`)).toEqual([
      { kind: 'invite_shared', trip_id: T1 }, { kind: 'money_moment_shown', trip_id: T1 },
    ])
  })

  it('refuses unknown kinds, other people’s trips, oversize props and outsiders', async () => {
    const send = (user: string, list: unknown[]) => asUser(pg, user, () => pg.query(`select public.log_events($1::jsonb)`, [JSON.stringify(list)]))
    await expect(send(U.B, [{ kind: 'page_view', trip_id: null }])).rejects.toThrow(/Unknown event/)
    await expect(send(U.B, [{ kind: 'invite_shared', trip_id: T2 }])).rejects.toThrow(/No access/)
    await expect(send(U.B, [{ kind: 'invite_shared', trip_id: null, props: { x: 'y'.repeat(3000) } }])).rejects.toThrow()
    await expect(send(U.B, Array.from({ length: 51 }, () => ({ kind: 'invite_shared', trip_id: null })))).rejects.toThrow(/50/)
    await expect(asUser(pg, U.B, () => pg.query(`select * from private.product_events`))).rejects.toThrow(/permission denied/)
  })

  it('stops at a daily cap per person', async () => {
    const batch = JSON.stringify(Array.from({ length: 50 }, () => ({ kind: 'trip_source', trip_id: null, props: { source: 'test' } })))
    let kept = 0
    for (let i = 0; i < 7; i++) kept += await asUserCommit(pg, U.C, async () => (await pg.query<{ n: number }>(`select public.log_events($1::jsonb) as n`, [batch])).rows[0]!.n)
    expect(kept).toBe(300)
  })

  it('keeps early-access emails apart and checks them', async () => {
    await asUser(pg, U.A, async () => { await expect(pg.query(`select public.request_payments_early_access('not an email', '${T1}')`)).rejects.toThrow(/email address/) })
    await asUserCommit(pg, U.A, async () => { await pg.query(`select public.request_payments_early_access(' Ana@Example.com ', '${T1}')`) })
    await asUserCommit(pg, U.A, async () => { await pg.query(`select public.request_payments_early_access('ana@example.com', '${T1}')`) })
    const rows = await pg.query(`select email, trip_id, travelers from private.early_access_requests`)
    expect(rows.rows).toEqual([{ email: 'ana@example.com', trip_id: T1, travelers: 3 }])
    await asUser(pg, U.X, async () => { await expect(pg.query(`select public.request_payments_early_access('x@example.com', '${T1}')`)).rejects.toThrow(/No access/) })
  })

  it('counts the funnel by day', async () => {
    const day = await pg.query<Record<string, number>>(`select trips_created, trips_with_joins, trips_invites_shared, trips_money_moment_shown from private.funnel_daily limit 1`)
    expect(day.rows[0]).toEqual({ trips_created: 2, trips_with_joins: 2, trips_invites_shared: 1, trips_money_moment_shown: 1 })
  })
})
