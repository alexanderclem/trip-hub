import { db as defaultDb, type TripDb } from './db'
import type { TableName, Tables } from './types'

type Row<T extends TableName> = Tables[T]

const SERVER_MANAGED = new Set(['created_at', 'updated_at'])

/** What gets sent to the server: no local bookkeeping, no server-managed timestamps. */
export function toPayload(row: object): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('_') || SERVER_MANAGED.has(k) || v === undefined) continue
    out[k] = v
  }
  return out
}

/**
 * Saves a row locally and queues it for the server, atomically. The UI reads only from
 * IndexedDB, so the change is visible immediately whether or not there is signal.
 */
export async function save<T extends TableName>(
  table: T,
  row: Row<T>,
  memberId: string | null,
  database: TripDb = defaultDb,
): Promise<void> {
  await saveMany(table, [row], memberId, database)
}

export async function saveMany<T extends TableName>(
  table: T,
  rows: Row<T>[],
  memberId: string | null,
  database: TripDb = defaultDb,
): Promise<void> {
  const t = database.table(table)
  await database.transaction('rw', t, database._outbox, async () => {
    const now = new Date().toISOString()
    for (const row of rows) {
      const existing = (await t.get(row.id)) as (Row<T> & { _lrev?: number }) | undefined
      const lrev = (existing?._lrev ?? 0) + 1
      const merged = {
        ...row,
        created_by: existing?.created_by ?? row.created_by ?? memberId,
        updated_by: memberId,
        created_at: existing?.created_at ?? now,
        updated_at: now, // provisional; replaced by the server's clock on the next pull
        _dirty: 1 as const,
        _lrev: lrev,
      }
      await t.put(merged)

      const payload = toPayload(merged)
      const queued = await database._outbox.where('[table+rowId]').equals([table, row.id]).first()
      if (queued) {
        // Coalesce: keep the original queue position (preserves create-before-reference order).
        await database._outbox.update(queued.seq!, { payload, lrev, attempts: 0, nextAttemptAt: 0 })
      } else {
        await database._outbox.add({ table, rowId: row.id, lrev, payload, attempts: 0, nextAttemptAt: 0 })
      }
    }
  })
}

/** Soft delete. The tombstone syncs like any other edit and can't be undone on the server. */
export async function softDelete<T extends TableName>(
  table: T,
  id: string,
  memberId: string | null,
  database: TripDb = defaultDb,
): Promise<void> {
  const existing = (await database.table(table).get(id)) as Row<T> | undefined
  if (!existing || existing.deleted_at) return
  await save(table, { ...existing, deleted_at: new Date().toISOString() }, memberId, database)
}
