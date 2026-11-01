// Phase 4 (20261105000001_imports.sql): importing past travelers, without carrying consent over.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asUser, asUserCommit, migratedDb } from './db'
import { T1, U, seed } from './fixtures'

const account = { anonymous: false }
let pg: PGlite
const one = async <T,>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows[0]!

beforeAll(async () => {
  pg = await migratedDb()
  await seed(pg)
  await asUserCommit(pg, U.A, async () => {
    await pg.query(`select public.save_organizer('Ana Trips', 'ana@example.com')`)
    await pg.query(`select public.claim_trip('${T1}')`)
  }, account)
}, 60000)
afterAll(async () => { await pg?.close() })

describe('importing past travelers', () => {
  it('adds new people, merges tags for known ones, skips bad emails, and never turns consent on', async () => {
    const org = (await one<{ id: string }>(`select id from public.organizers`)).id
    await pg.exec(`insert into public.organizer_contacts (organizer_id, email, name, tags) values ('${org}', 'ola@example.com', 'Ola', '{repeat}')`)
    const rows = [{ name: 'Ola N', email: 'OLA@example.com', tags: ['VIP'] }, { name: '', email: 'kim@example.com', tags: [], consent: true }, { name: 'Bad', email: 'nope' }]
    const r = await asUserCommit(pg, U.A, () => one<{ r: unknown }>(`select public.import_contacts($1::jsonb) as r`, [JSON.stringify(rows)]), account)
    expect(r.r).toEqual({ added: 1, updated: 1 })
    expect((await pg.query(`select email, name, tags, marketing_consent from public.organizer_contacts order by email`)).rows).toEqual([
      { email: 'kim@example.com', name: 'kim', tags: [], marketing_consent: false },
      { email: 'ola@example.com', name: 'Ola', tags: ['repeat', 'vip'], marketing_consent: false },
    ])
  })

  it('is for organizers with Pro, a batch at a time', async () => {
    await expect(asUser(pg, U.B, () => pg.query(`select public.import_contacts('[]')`))).rejects.toThrow(/Pro/)
    const many = JSON.stringify(Array.from({ length: 2001 }, (_, i) => ({ email: `p${i}@example.com` })))
    await expect(asUser(pg, U.A, () => pg.query(`select public.import_contacts($1::jsonb)`, [many]), account)).rejects.toThrow(/2,000/)
  })
})
