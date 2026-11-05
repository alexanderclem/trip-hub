import { DateTime } from 'luxon'
import { db, type TripDb } from '@/data/db'
import type { ItineraryItem } from '@/data/types'
import { saveMany, softDelete, toPayload } from '@/data/repo'
import { checkLocalTime, findConflicts, normalizeLocal, toInstant } from '@/lib/time'

export interface SchedulePreview { before: ItineraryItem[]; after: ItineraryItem[]; conflicts: number }

export function duplicateEndDate(source: ItineraryItem, date: string): string {
  const next = DateTime.fromISO(date, { zone: 'utc' })
  if (!next.isValid) return source.end_local?.slice(0, 10) ?? date
  const start = DateTime.fromISO(source.start_local.slice(0, 10), { zone: 'utc' })
  const end = DateTime.fromISO((source.end_local ?? source.start_local).slice(0, 10), { zone: 'utc' })
  return next.plus({ days: end.diff(start, 'days').days }).toISODate()!
}

function atInstant(item: ItineraryItem, delta: number): ItineraryItem {
  const local = (instant: string, zone: string) => DateTime.fromMillis(Date.parse(instant) + delta, { zone }).toFormat("yyyy-MM-dd'T'HH:mm")
  const start_local = local(item.start_at, item.start_tz)
  const end_local = item.end_at ? local(item.end_at, item.end_tz ?? item.start_tz) : null
  return { ...item, start_local, start_at: toInstant(start_local, item.start_tz), end_local, end_at: end_local ? toInstant(end_local, item.end_tz ?? item.start_tz) : null }
}

export function previewSchedule(items: ItineraryItem[], itemId: string, date: string, time: string, shiftLater: boolean, zone: string): SchedulePreview {
  const item = items.find(i => i.id === itemId && !i.deleted_at)
  if (!item) throw new Error('This item was removed.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !DateTime.fromISO(date).isValid) throw new Error('Choose a valid date.')
  if (!item.all_day && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose a valid start time.')
  const start_local = `${date}T${item.all_day ? '00:00' : time}`
  const checked = checkLocalTime(start_local, item.start_tz)
  if (checked.kind === 'gap') throw new Error('That time does not exist because the clocks change. Choose another time.')
  const delta = Date.parse(checked.instant) - Date.parse(item.start_at)
  let moved = atInstant(item, delta)
  if (item.all_day && item.end_local) {
    const days = DateTime.fromISO(date).diff(DateTime.fromISO(item.start_local.slice(0, 10)), 'days').days
    const end_local = DateTime.fromISO(normalizeLocal(item.end_local)).plus({ days }).toFormat("yyyy-MM-dd'T'HH:mm")
    moved = { ...moved, end_local, end_at: toInstant(end_local, item.end_tz ?? item.start_tz) }
  }
  const day = DateTime.fromISO(item.start_at, { zone: 'utc' }).setZone(zone).toISODate()
  const before = [item, ...items.filter(i => shiftLater && !item.all_day && !i.deleted_at && !i.all_day && i.kind !== 'lodging' && i.status !== 'cancelled' && Date.parse(i.start_at) > Date.parse(item.start_at) && DateTime.fromISO(i.start_at, { zone: 'utc' }).setZone(zone).toISODate() === day).sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))]
  const after = before.map(i => i.id === item.id ? moved : atInstant(i, delta))
  const replacements = new Map(after.map(i => [i.id, i]))
  const combined = items.map(i => replacements.get(i.id) ?? i).filter(i => !i.deleted_at && !i.all_day && i.kind !== 'lodging' && i.status !== 'cancelled')
  const changed = new Set(after.map(i => i.id))
  const conflicts = findConflicts(combined).filter(pair => pair.some(id => changed.has(id))).length
  return { before, after, conflicts }
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, stable(value)]))
  return value
}
function comparable(item: ItineraryItem) {
  return stable({ ...toPayload(item), start_local: normalizeLocal(item.start_local), end_local: item.end_local ? normalizeLocal(item.end_local) : null, start_at: Date.parse(item.start_at), end_at: item.end_at ? Date.parse(item.end_at) : null })
}
const unchanged = (a: ItineraryItem, b: ItineraryItem) => JSON.stringify(comparable(a)) === JSON.stringify(comparable(b))

export async function undoDuplicate(saved: ItineraryItem, me: string | null, database: TripDb = db): Promise<void> {
  await database.transaction('rw', database.itinerary_items, database._outbox, async () => {
    const current = await database.itinerary_items.get(saved.id)
    if (!current || !unchanged(saved, current)) throw new Error('The copy changed after it was created. Remove it from the itinerary instead.')
    await softDelete('itinerary_items', saved.id, me, database)
  })
}

/** Re-read under the same transaction as the writes so a preview never overwrites a later edit. */
export async function applySchedule(preview: SchedulePreview, me: string | null, database: TripDb = db): Promise<() => Promise<void>> {
  let written: ItineraryItem[] = []
  await database.transaction('rw', database.itinerary_items, database._outbox, async () => {
    for (const original of preview.before) {
      const current = await database.itinerary_items.get(original.id)
      if (!current || !unchanged(original, current)) throw new Error('The itinerary changed. Close this preview and try again.')
    }
    await saveMany('itinerary_items', preview.after, me, database)
    written = await database.itinerary_items.bulkGet(preview.after.map(i => i.id)) as ItineraryItem[]
  })
  return async () => {
    await database.transaction('rw', database.itinerary_items, database._outbox, async () => {
      for (const saved of written) {
        const current = await database.itinerary_items.get(saved.id)
        if (!current || !unchanged(saved, current)) throw new Error('This item changed again. Undo would overwrite that edit.')
      }
      await saveMany('itinerary_items', preview.before, me, database)
    })
  }
}
