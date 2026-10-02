import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { TripDb } from '../db'
import { save, softDelete } from '../repo'
import type { Place, TableName } from '../types'
import { pull, push, resetBackoff } from './engine'
import type { Remote, RemoteError } from './remote'

const TRIP = '00000000-0000-4000-8000-000000000001'

/** In-memory server that follows the same rules as the Postgres sync_guard trigger. */
class FakeServer implements Remote {
  tables = new Map<TableName, Map<string, Record<string, unknown>>>()
  clock = Date.parse('2027-01-01T00:00:00Z')
  online = true
  writes = 0
  reject: (row: Record<string, unknown>) => RemoteError | null = () => null

  private table(t: TableName) {
    let m = this.tables.get(t)
    if (!m) this.tables.set(t, (m = new Map()))
    return m
  }

  async write(table: TableName, rows: Record<string, unknown>[]) {
    this.writes++
    if (!this.online) return { status: 0, message: 'Failed to fetch' }
    for (const r of rows) {
      const err = this.reject(r)
      if (err) return err // Postgres rejects the whole statement
    }
    for (const r of rows) {
      const m = this.table(table)
      const old = m.get(r.id as string)
      const updated_at = new Date((this.clock += 1000)).toISOString()
      m.set(r.id as string, {
        ...r,
        created_at: old?.created_at ?? updated_at,
        updated_at,
        deleted_at: old?.deleted_at ?? r.deleted_at ?? null,
      })
    }
    return null
  }

  async pull(table: TableName, _tripId: string, since: string, offset: number, limit: number) {
    if (!this.online) return { error: { status: 0, message: 'Failed to fetch' } }
    const rows = [...this.table(table).values()]
      .filter((r) => Date.parse(r.updated_at as string) > Date.parse(since))
      .sort((a, b) => Date.parse(a.updated_at as string) - Date.parse(b.updated_at as string))
    return { rows: rows.slice(offset, offset + limit) }
  }

  /** Another device's edit, written straight to the server. */
  serverEdit(table: TableName, row: object) {
    return this.write(table, [row as Record<string, unknown>])
  }
}

const place = (id: string, name: string, over: Partial<Place> = {}): Place => ({
  id,
  trip_id: TRIP,
  name,
  category: 'food',
  tags: [],
  lat: 14.55,
  lng: -90.73,
  address: null,
  area: 'Antigua',
  status: 'shortlist',
  notes: null,
  phone: null,
  website: null,
  opening_hours: null,
  external_ids: {},
  source: 'manual',
  ...over,
})

let n = 0
let db: TripDb
let server: FakeServer
beforeEach(() => {
  db = new TripDb(`test-${++n}`)
  server = new FakeServer()
})

describe('push', () => {
  it('sends local saves and clears the dirty flag', async () => {
    await save('places', place('p1', 'Café Sky'), 'ana', db)
    expect((await db.places.get('p1'))!._dirty).toBe(1)

    const r = await push(server, db)
    expect(r).toMatchObject({ pushed: 1, deadLettered: 0 })
    expect(await db._outbox.count()).toBe(0)
    expect((await db.places.get('p1'))!._dirty).toBe(0)
    expect(server.tables.get('places')!.get('p1')!.name).toBe('Café Sky')
  })

  it('never sends local bookkeeping or client timestamps', async () => {
    await save('places', place('p1', 'X'), 'ana', db)
    await push(server, db)
    const sent = server.tables.get('places')!.get('p1')!
    expect(Object.keys(sent).some((k) => k.startsWith('_'))).toBe(false)
    expect(sent.updated_by).toBe('ana')
    expect(sent.created_by).toBe('ana')
  })

  it('coalesces repeated edits of one row into one queued write', async () => {
    await save('places', place('p1', 'v1'), 'ana', db)
    await save('places', place('p1', 'v2'), 'ana', db)
    await save('places', place('p1', 'v3'), 'ana', db)
    expect(await db._outbox.count()).toBe(1)
    await push(server, db)
    expect(server.writes).toBe(1)
    expect(server.tables.get('places')!.get('p1')!.name).toBe('v3')
  })

  it('keeps queue order across tables (a place is pushed before the link that references it)', async () => {
    const order: string[] = []
    const inner = server.write.bind(server)
    server.write = async (t, rows) => {
      order.push(t)
      return inner(t, rows)
    }
    await save('places', place('p1', 'A'), 'ana', db)
    await save('links', { id: 'l1', trip_id: TRIP, place_id: 'p1', item_id: null, expense_id: null, url: 'https://a.b', label: null, kind: 'info' }, 'ana', db)
    await save('places', place('p1', 'A (edited)'), 'ana', db) // coalesced, keeps first position
    await push(server, db)
    expect(order).toEqual(['places', 'links'])
  })

  it('offline: keeps everything queued and backs off', async () => {
    server.online = false
    await save('places', place('p1', 'A'), 'ana', db)
    const r = await push(server, db)
    expect(r.retryLater).toBe(true)
    const entry = (await db._outbox.toArray())[0]!
    expect(entry.attempts).toBe(1)
    expect(entry.nextAttemptAt).toBeGreaterThan(Date.now())

    // Still backing off: nothing is attempted.
    server.online = true
    const writesBefore = server.writes
    await push(server, db)
    expect(server.writes).toBe(writesBefore)

    // Coming back online resets the backoff.
    await resetBackoff(db)
    expect((await push(server, db)).pushed).toBe(1)
  })

  it('dead-letters a row the server rejects without blocking the rest of the batch', async () => {
    server.reject = (row) => (row.name === 'bad' ? { status: 400, message: 'check constraint' } : null)
    await save('places', place('p1', 'good 1'), 'ana', db)
    await save('places', place('p2', 'bad'), 'ana', db)
    await save('places', place('p3', 'good 2'), 'ana', db)
    const r = await push(server, db)
    expect(r).toMatchObject({ pushed: 2, deadLettered: 1 })
    expect(await db._outbox.count()).toBe(0)
    const dead = await db._deadletter.toArray()
    expect(dead).toHaveLength(1)
    expect(dead[0]!.rowId).toBe('p2')
    expect(dead[0]!.error).toContain('400')
  })

  it('an edit made while a push is in flight stays queued', async () => {
    await save('places', place('p1', 'v1'), 'ana', db)
    const inner = server.write.bind(server)
    server.write = async (t, rows) => {
      server.write = inner // edit only during the first push
      server.online = false // and keep the second write from landing, so we can inspect
      await save('places', place('p1', 'v2 (during push)'), 'ana', db)
      server.online = true
      const r = await inner(t, rows)
      server.online = false
      return r
    }
    await push(server, db)
    expect(server.tables.get('places')!.get('p1')!.name).toBe('v1')
    expect(await db._outbox.count()).toBe(1)
    expect((await db.places.get('p1'))!._dirty).toBe(1)
    expect((await db.places.get('p1'))!.name).toBe('v2 (during push)')

    server.online = true
    await resetBackoff(db)
    await push(server, db)
    expect(server.tables.get('places')!.get('p1')!.name).toBe('v2 (during push)')
    expect(await db._outbox.count()).toBe(0)
  })
})

describe('pull', () => {
  it('syncs task creation and reversible completion between devices', async () => {
    const second = new TripDb(`task-second-${crypto.randomUUID()}`)
    try {
      const task = { id: 'task-1', trip_id: TRIP, title: 'Book shuttle', assignee_id: null, due_date: '2027-03-14', notes: null, completed: false }
      await save('trip_tasks', task, 'ana', db)
      await push(server, db)
      await pull(server, TRIP, second)
      expect(await second.trip_tasks.get(task.id)).toMatchObject({ title: 'Book shuttle', completed: false })
      await save('trip_tasks', { ...task, completed: true }, 'ben', second)
      await push(server, second)
      await pull(server, TRIP, db)
      expect(await db.trip_tasks.get(task.id)).toMatchObject({ completed: true })
      await save('trip_tasks', { ...task, completed: false }, 'ana', db)
      await push(server, db)
      await pull(server, TRIP, second)
      expect(await second.trip_tasks.get(task.id)).toMatchObject({ completed: false })
    } finally { await second.delete() }
  })

  it("brings in other devices' changes", async () => {
    await server.serverEdit('places', place('p9', 'From Ben'))
    const r = await pull(server, TRIP, db, ['places'])
    expect(r.received).toBe(1)
    expect((await db.places.get('p9'))!.name).toBe('From Ben')
  })

  it('never overwrites a local edit that has not been pushed yet', async () => {
    await server.serverEdit('places', place('p1', 'server v1'))
    await pull(server, TRIP, db, ['places'])
    server.online = false
    await save('places', place('p1', 'my offline edit'), 'ana', db)
    server.online = true
    await server.serverEdit('places', place('p1', 'server v2'))
    await pull(server, TRIP, db, ['places'])
    expect((await db.places.get('p1'))!.name).toBe('my offline edit')

    // Once pushed, my edit is the latest write on the server and comes back unchanged.
    await resetBackoff(db)
    await push(server, db)
    await pull(server, TRIP, db, ['places'])
    expect((await db.places.get('p1'))!.name).toBe('my offline edit')
    expect((await db.places.get('p1'))!._dirty).toBe(0)
  })

  it('is idempotent: re-reading the overlap window changes nothing', async () => {
    await server.serverEdit('places', place('p1', 'A'))
    await pull(server, TRIP, db, ['places'])
    const before = await db.places.toArray()
    const r = await pull(server, TRIP, db, ['places'])
    expect(r.received).toBe(1) // re-read within the 30s overlap
    expect(await db.places.toArray()).toEqual(before)
  })

  it('advances the cursor so rows older than the overlap window are not re-downloaded', async () => {
    await server.serverEdit('places', place('p1', 'A'))
    await pull(server, TRIP, db, ['places'])
    server.clock += 10 * 60_000
    await server.serverEdit('places', place('p2', 'B'))
    await pull(server, TRIP, db, ['places'])
    server.clock += 10 * 60_000
    await server.serverEdit('places', place('p3', 'C'))
    const r = await pull(server, TRIP, db, ['places'])
    expect(r.received).toBe(2) // p2 (inside the 30s overlap) + p3; p1 is not re-read
    expect(await db.places.count()).toBe(3)
  })

  it('offline pull reports an error and leaves data alone', async () => {
    await server.serverEdit('places', place('p1', 'A'))
    await pull(server, TRIP, db, ['places'])
    server.online = false
    const r = await pull(server, TRIP, db, ['places'])
    expect(r.error?.status).toBe(0)
    expect(await db.places.count()).toBe(1)
  })
})

describe('deletes', () => {
  it('soft delete syncs as a tombstone and cannot be undone by a later write', async () => {
    await save('places', place('p1', 'A'), 'ana', db)
    await push(server, db)
    await softDelete('places', 'p1', 'ana', db)
    await push(server, db)
    expect(server.tables.get('places')!.get('p1')!.deleted_at).toBeTruthy()

    // Another device that still has the old copy edits it: the tombstone survives.
    await server.serverEdit('places', place('p1', 'resurrected?', { deleted_at: null }))
    await pull(server, TRIP, db, ['places'])
    expect((await db.places.get('p1'))!.deleted_at).toBeTruthy()
  })
})
