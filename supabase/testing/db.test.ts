import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { migratedDb, migrationFiles } from './db'

let pg: PGlite
beforeAll(async () => { pg = await migratedDb() }, 60000)
afterAll(async () => { await pg?.close() })

describe('all-migrations test database', () => {
  it('applies every migration', async () => {
    expect(migrationFiles().length).toBeGreaterThan(20)
    const tables = await pg.query<{ n: number }>(`select count(*)::int as n from pg_tables where schemaname = 'public'`)
    expect(tables.rows[0]!.n).toBeGreaterThanOrEqual(24)
  })
})
