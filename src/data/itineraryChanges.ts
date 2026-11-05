import { DateTime } from 'luxon'
import type { ItineraryItem } from './types'

const KEY = 'stowaway_changes_v1'
export interface PlanChange { id: string; at: string; by: string | null; title: string; text: string }

/** Stored inside the existing synced details field; no separate event service is required. */
export function planChanges(item: Pick<ItineraryItem, 'details'>): PlanChange[] {
  try {
    const value: unknown = JSON.parse(item.details?.[KEY] ?? '[]')
    return Array.isArray(value) ? value.filter((v): v is PlanChange => !!v && typeof v.id === 'string' && typeof v.at === 'string' && Number.isFinite(Date.parse(v.at)) && (v.by === null || typeof v.by === 'string') && typeof v.title === 'string' && typeof v.text === 'string').slice(-40) : []
  } catch { return [] }
}

const when = (item: ItineraryItem) => item.all_day
  ? DateTime.fromISO(item.start_local).toFormat('d LLL yyyy') + ' (all day)'
  : DateTime.fromISO(item.start_at, { zone: 'utc' }).setZone(item.start_tz).toFormat('d LLL yyyy, HH:mm ZZZZ')
const samePeople = (a: string[] | null, b: string[] | null) => JSON.stringify(a ? [...a].sort() : null) === JSON.stringify(b ? [...b].sort() : null)
const changedInstant = (a: string | null, b: string | null) => a !== b && (!a || !b || Date.parse(a) !== Date.parse(b))

export function recordPlanChange(before: ItineraryItem | undefined, after: ItineraryItem, by: string | null, at: string, id: string): ItineraryItem {
  if (!before) return after
  const changes: string[] = []
  if (before.title !== after.title) changes.push(`renamed “${before.title}” to “${after.title}”`)
  if (changedInstant(before.start_at, after.start_at) || before.start_tz !== after.start_tz || before.all_day !== after.all_day) changes.push(`moved “${after.title}” from ${when(before)} to ${when(after)}`)
  else if (changedInstant(before.end_at, after.end_at) || before.end_tz !== after.end_tz) changes.push(`changed the end of “${after.title}” to ${after.end_at ? DateTime.fromISO(after.end_at, { zone: 'utc' }).setZone(after.end_tz ?? after.start_tz).toFormat('d LLL yyyy, HH:mm ZZZZ') : 'no end time'}`)
  if (before.status !== after.status) changes.push(`marked “${after.title}” ${after.status}`)
  if (before.place_id !== after.place_id || before.to_place_id !== after.to_place_id) changes.push(`changed the location of “${after.title}”`)
  if (!samePeople(before.attendee_ids, after.attendee_ids)) changes.push(`changed who’s going to “${after.title}”`)
  if (before.notes !== after.notes) changes.push(`updated the notes for “${after.title}”`)
  if (!before.deleted_at && after.deleted_at) changes.push(`removed “${after.title}” from the itinerary`)
  const history = planChanges(before)
  if (changes.length) history.push({ id, at, by, title: after.title, text: changes.join('; ') })
  // Restore operations must not rewind the history along with the item's old values.
  return history.length ? { ...after, details: { ...after.details, [KEY]: JSON.stringify(history.slice(-40)) } } : after
}
