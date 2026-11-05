// Offline-first sync. The contract, in full:
//  1. Local writes go to IndexedDB + an outbox in one transaction (see repo.ts).
//  2. push(): the outbox is sent in queue order, batching consecutive rows of one table.
//     Network/5xx failures back off and retry; 4xx (rejected by the server) go to a
//     dead-letter list the user can see, so one bad row can never block the queue.
//  3. pull(): rows changed on the server since our cursor (minus an overlap window) are
//     copied in, except rows with unpushed local edits, which win until they're pushed.
//  4. The server's clock orders everything (last write to arrive wins, per row). Deletes
//     are tombstones the server refuses to clear.

import { db as defaultDb, type OutboxEntry, type TripDb } from '../db'
import type { TableName } from '../types'
import type { Remote, RemoteError } from './remote'

/** Pull order: parents before children. */
export const SYNCED_TABLES: TableName[] = ['trips', 'members', 'places', 'links', 'route_legs', 'leg_overrides', 'polls', 'poll_options', 'poll_votes', 'place_ratings', 'itinerary_items', 'day_notes', 'expenses', 'settlements', 'fx_snapshots', 'attachments', 'trip_tasks', 'member_preferences', 'packing_items', 'packing_checks', 'member_safety', 'comments', 'trip_offers', 'bookings', 'booking_payments', 'room_assignments']

const BATCH = 200
const PAGE = 1000
const OVERLAP_MS = 30_000
const MAX_BACKOFF_MS = 5 * 60_000
const EPOCH = '1970-01-01T00:00:00Z'

const isRejection = (e: RemoteError) =>
  e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429

export interface PushResult {
  pushed: number
  deadLettered: number
  retryLater: boolean
}

export async function push(remote: Remote, database: TripDb = defaultDb): Promise<PushResult> {
  const result: PushResult = { pushed: 0, deadLettered: 0, retryLater: false }
  for (;;) {
    const now = Date.now()
    const queue = await database._outbox.orderBy('seq').toArray()
    const head = queue[0]
    if (!head) return result
    if (head.nextAttemptAt > now) {
      // Strict order: don't skip past a waiting entry (a later row may depend on it).
      result.retryLater = true
      return result
    }
    const batch: OutboxEntry[] = []
    for (const e of queue) {
      if (e.table !== head.table || batch.length >= BATCH) break
      batch.push(e)
    }

    const err = await remote.write(head.table, batch.map((e) => e.payload))
    if (!err) {
      await markPushed(batch, database)
      result.pushed += batch.length
      continue
    }
    if (isRejection(err)) {
      if (batch.length > 1) {
        // Find the offending row(s) by sending one at a time.
        for (const e of batch) {
          const single = await remote.write(e.table, [e.payload])
          if (!single) {
            await markPushed([e], database)
            result.pushed++
          } else if (isRejection(single)) {
            await deadLetter(e, single, database)
            result.deadLettered++
          } else {
            await backoff([e], single, database)
            result.retryLater = true
            return result
          }
        }
        continue
      }
      await deadLetter(head, err, database)
      result.deadLettered++
      continue
    }
    await backoff(batch, err, database)
    result.retryLater = true
    return result
  }
}

async function markPushed(entries: OutboxEntry[], database: TripDb) {
  await database.transaction('rw', [database._outbox, database._deadletter, ...SYNCED_TABLES.map((t) => database.table(t))], async () => {
    for (const e of entries) {
      const current = await database._outbox.get(e.seq!)
      // If the row was edited again while this push was in flight, keep the newer entry.
      if (current && current.lrev === e.lrev) await database._outbox.delete(e.seq!)
      const t = database.table(e.table)
      const row = await t.get(e.rowId)
      if (row && row._lrev === e.lrev) await t.update(e.rowId, { _dirty: 0 })
      await database._deadletter.filter((entry) => entry.table === e.table && entry.rowId === e.rowId && !entry.resolvedAt).modify({ resolvedAt: Date.now() })
    }
  })
}

async function deadLetter(e: OutboxEntry, err: RemoteError, database: TripDb) {
  await database.transaction('rw', [database._outbox, database._deadletter, database.table(e.table)], async () => {
    const current = await database._outbox.get(e.seq!)
    if (current?.lrev === e.lrev) await database._outbox.delete(e.seq!)
    await database._deadletter.add({
      table: e.table,
      rowId: e.rowId,
      payload: e.payload,
      error: `${err.status}: ${err.message}`,
      at: Date.now(),
    })
    // A rejection applies only to the version sent. A newer edit must stay queued and dirty.
    const table = database.table(e.table)
    const row = await table.get(e.rowId)
    if (row?._lrev === e.lrev) await table.update(e.rowId, { _dirty: 0 })
  })
}

async function backoff(entries: OutboxEntry[], err: RemoteError, database: TripDb) {
  const now = Date.now()
  await database.transaction('rw', database._outbox, async () => {
    for (const e of entries) {
      const current = await database._outbox.get(e.seq!)
      if (current?.lrev !== e.lrev) continue
      const attempts = e.attempts + 1
      const delay = Math.min(MAX_BACKOFF_MS, 2_000 * 2 ** (attempts - 1))
      await database._outbox.update(e.seq!, {
        attempts,
        nextAttemptAt: now + delay,
        lastError: `${err.status}: ${err.message}`,
      })
    }
  })
}

/** Makes all waiting outbox entries eligible immediately (e.g. when the device comes online). */
export async function resetBackoff(database: TripDb = defaultDb) {
  await database._outbox.toCollection().modify({ nextAttemptAt: 0 })
}

const cursorKey = (tripId: string, table: TableName) => `cursor:${tripId}:${table}`

export interface PullResult {
  received: number
  error?: RemoteError
}

export async function pull(
  remote: Remote,
  tripId: string,
  database: TripDb = defaultDb,
  tables: TableName[] = SYNCED_TABLES,
): Promise<PullResult> {
  let received = 0
  // Fetch independent first pages together, but apply parent rows before child rows as before.
  for (let start = 0; start < tables.length; start += 4) {
    const batch = await Promise.all(tables.slice(start, start + 4).map(async (table) => {
      const key = cursorKey(tripId, table)
      const cursor = (await database._meta.get(key))?.value ?? EPOCH
      const since = new Date(Math.max(0, Date.parse(cursor) - OVERLAP_MS)).toISOString()
      return { table, key, cursor, since, first: await remote.pull(table, tripId, since, 0, PAGE) }
    }))
    for (const { table, key, cursor, since, first } of batch) {
      let maxSeen = cursor
      for (let offset = 0; ; offset += PAGE) {
        const res = offset === 0 ? first : await remote.pull(table, tripId, since, offset, PAGE)
        if ('error' in res) return { received, error: res.error }
        const t = database.table(table)
        await database.transaction('rw', t, async () => {
          for (const row of res.rows) {
            const id = row.id as string
            const local = await t.get(id)
            if (local?._dirty) continue // unpushed local edit wins until it's pushed
            await t.put({ ...row, _dirty: 0, _lrev: local?._lrev ?? 0 })
            const u = row.updated_at as string
            if (Date.parse(u) > Date.parse(maxSeen)) maxSeen = u
          }
        })
        received += res.rows.length
        if (res.rows.length < PAGE) break
      }
      if (maxSeen !== cursor) await database._meta.put({ key, value: maxSeen })
    }
  }
  return { received }
}

/** Forgets pull cursors so the next pull re-downloads everything for the trip. */
export async function resetCursors(tripId: string, database: TripDb = defaultDb) {
  await database._meta.bulkDelete(SYNCED_TABLES.map((t) => cursorKey(tripId, t)))
}
