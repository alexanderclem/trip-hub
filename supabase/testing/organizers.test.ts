import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asUser, asUserCommit, migratedDb } from './db'
import { T1, U, seed } from './fixtures'

let pg: PGlite
beforeAll(async () => { pg = await migratedDb(); await seed(pg) }, 60000)
afterAll(async () => { await pg?.close() })

const account = { anonymous: false }

describe('organizers', () => {
  it('needs an account, a name and a real email address', async () => {
    await asUser(pg, U.A, async () => { await expect(pg.query(`select public.save_organizer('Ana Trips', 'ana@example.com')`)).rejects.toThrow(/Sign in/) })
    await asUser(pg, U.A, async () => { await expect(pg.query(`select public.save_organizer(' ', 'ana@example.com')`)).rejects.toThrow(/name/) }, account)
    await asUser(pg, U.A, async () => { await expect(pg.query(`select public.save_organizer('Ana Trips', 'nope')`)).rejects.toThrow(/email/) }, account)
  })

  it('makes a unique slug and lets only the owner read the profile', async () => {
    const a = await asUserCommit(pg, U.A, async () => (await pg.query<{ slug: string }>(`select (public.save_organizer('Ana’s Trips!', 'Ana@Example.com')).slug`)).rows[0]!.slug, account)
    expect(a).toBe('ana-s-trips')
    const x = await asUserCommit(pg, U.X, async () => (await pg.query<{ slug: string }>(`select (public.save_organizer('Ana’s Trips', 'x@example.com')).slug`)).rows[0]!.slug, account)
    expect(x).toMatch(/^ana-s-trips-[0-9a-f]{4}$/)
    await asUser(pg, U.B, async () => { expect((await pg.query(`select * from public.organizers`)).rows).toEqual([]) })
    await asUser(pg, U.A, async () => { expect((await pg.query(`select support_email from public.organizers`)).rows).toEqual([{ support_email: 'ana@example.com' }]) }, account)
  })

  it('records the organizer on a claimed trip, which a plain update can’t change', async () => {
    await asUserCommit(pg, U.A, async () => { await pg.query(`select public.claim_trip('${T1}')`) }, account)
    const org = (await pg.query<{ id: string }>(`select id from public.organizers where owner_user_id = '${U.A}'`)).rows[0]!.id
    expect((await pg.query(`select organizer_id from public.trips where id = '${T1}'`)).rows[0]).toEqual({ organizer_id: org })
    await asUser(pg, U.A, async () => {
      await pg.query(`update public.trips set organizer_id = null where id = '${T1}'`)
      expect((await pg.query(`select organizer_id from public.trips where id = '${T1}'`)).rows[0]).toEqual({ organizer_id: org })
    }, account)
    expect((await pg.query(`select trips_claimed from private.funnel_daily limit 1`)).rows[0]).toEqual({ trips_claimed: 1 })
  })
})

describe('Pro', () => {
  it('is free for every organizer during the beta, and off when the beta ends', async () => {
    const me = await asUser(pg, U.A, async () => (await pg.query<{ o: { pro: boolean; beta: boolean } }>(`select public.my_organizer() as o`)).rows[0]!.o, account)
    expect(me).toMatchObject({ pro: true, beta: true })
    await pg.exec(`update private.app_settings set value = 'false' where key = 'pro_free_beta'`)
    const after = await asUser(pg, U.A, async () => (await pg.query<{ o: { pro: boolean } }>(`select public.my_organizer() as o`)).rows[0]!.o, account)
    expect(after.pro).toBe(false)
    await pg.exec(`update public.organizers set plan = 'pro' where owner_user_id = '${U.A}'`)
    expect((await asUser(pg, U.A, async () => (await pg.query<{ o: { pro: boolean } }>(`select public.my_organizer() as o`)).rows[0]!.o, account)).pro).toBe(true)
    await pg.exec(`update private.app_settings set value = 'true' where key = 'pro_free_beta'; update public.organizers set plan = 'free'`)
    expect(await asUser(pg, U.B, async () => (await pg.query(`select public.my_organizer() as o`)).rows[0])).toEqual({ o: null })
  })
})
