// Invite link previews (20261107000001_invite_preview.sql): a preview key derived from the share
// token, kept in step by a trigger, and an anonymous RPC that shows only name, dates and group size.

import { createHash } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asAnon, asUser, asUserCommit, migratedDb } from './db'
import { T1, TOKEN, U, seed } from './fixtures'

let pg: PGlite
const keyOf = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex').slice(0, 20)
const tripRow = async () => (await pg.query<{ share_token: string; preview_key: string; name: string }>(
  `select share_token, preview_key, name from public.trips where id = $1`, [T1])).rows[0]!
const preview = (key: string) => asAnon(pg, async () =>
  (await pg.query<Record<string, unknown>>(`select * from public.invite_preview($1)`, [key])).rows)

beforeAll(async () => {
  pg = await migratedDb()
  await seed(pg)
})

describe('invite preview', () => {
  it('derives the key from the share token, matching what phones compute', async () => {
    const row = await tripRow()
    expect(row.share_token).toBe(TOKEN)
    expect(row.preview_key).toBe(keyOf(TOKEN))
  })

  it('shows only name, dates and the number of people to someone not signed in', async () => {
    const rows = await preview(keyOf(TOKEN))
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0]!).sort()).toEqual(['end_date', 'name', 'people', 'start_date'])
    const people = (await pg.query<{ n: number }>(`select count(*)::int as n from public.members where trip_id = $1 and deleted_at is null`, [T1])).rows[0]!.n
    expect(rows[0]!.people).toBe(people)
    expect(rows[0]!.name).toBe((await tripRow()).name)
  })

  it('answers nothing for unknown, malformed or token-shaped keys', async () => {
    expect(await preview('0'.repeat(20))).toEqual([])
    expect(await preview(TOKEN)).toEqual([])
    expect(await preview(`${keyOf(TOKEN)}' or true --`)).toEqual([])
  })

  it('cannot be set by a phone', async () => {
    await asUser(pg, U.A, async () => {
      await pg.query(`update public.trips set preview_key = 'aaaaaaaaaaaaaaaaaaaa' where id = $1`, [T1])
      expect((await pg.query<{ k: string }>(`select preview_key as k from public.trips where id = $1`, [T1])).rows[0]!.k).toBe(keyOf(TOKEN))
    })
  })

  it('retires the old preview when the link is rotated', async () => {
    const before = keyOf(TOKEN)
    const token = await asUserCommit(pg, U.A, async () =>
      (await pg.query<{ t: string }>(`select public.rotate_share_token($1) as t`, [T1])).rows[0]!.t)
    const row = await tripRow()
    expect(row.share_token).toBe(token)
    expect(row.preview_key).toBe(keyOf(token))
    expect(await preview(before)).toEqual([])
    expect(await preview(keyOf(token))).toHaveLength(1)
  })

  it('hides deleted trips', async () => {
    await pg.query(`update public.trips set deleted_at = now() where id = $1`, [T1])
    expect(await preview((await tripRow()).preview_key)).toEqual([])
  })
})
