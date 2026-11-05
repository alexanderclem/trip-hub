import { DateTime } from 'luxon'
import type { AreaRoute, ItineraryItem, Place } from '@/data/types'
import { db, type TripDb } from '@/data/db'
import type { LegContext } from '@/features/routing/legs'
import { dayKey, findConflicts } from '@/lib/time'
import { applySchedule, atInstant, type SchedulePreview } from './reschedule'
import { planTransfers, scheduledItems, type Transfer } from './travel'

export interface ScheduleIssue { id: string; from: ItineraryItem; to: ItineraryItem; requiredS: number; kind: 'travel' | 'overlap'; transfer?: Transfer }
export interface ScheduleFix { id: string; title: string; preview: SchedulePreview; blocked: string | null }
const key = (a: string, b: string) => [a, b].sort().join(':')
const fixed = (item: ItineraryItem) => !!item.confirmation_code || item.kind === 'flight' || item.kind === 'lodging'

export function scheduleIssues(items: ItineraryItem[], transfers: Transfer[]): ScheduleIssue[] {
  const issues = new Map<string, ScheduleIssue>()
  for (const transfer of transfers) {
    if (transfer.gapS === null || transfer.gapS >= transfer.requiredS) continue
    const id = key(transfer.from.id, transfer.to.id)
    issues.set(id, { id, from: transfer.from, to: transfer.to, requiredS: transfer.requiredS, kind: transfer.gapS < 0 ? 'overlap' : 'travel', transfer })
  }
  const sorted = scheduledItems(items)
  for (const [a, b] of findConflicts(sorted)) {
    const id = key(a, b)
    if (issues.has(id)) continue
    issues.set(id, { id, from: sorted.find((i) => i.id === a)!, to: sorted.find((i) => i.id === b)!, requiredS: 0, kind: 'overlap' })
  }
  return [...issues.values()].sort((a, b) => Date.parse(a.to.start_at) - Date.parse(b.to.start_at))
}

/** Offer single-activity moves, never shorten an activity or move a flight or coded booking. */
export function scheduleFixes(issue: ScheduleIssue, items: ItineraryItem[], places: Place[], ctx: LegContext, zone: string, members: string[], bounds: { start: string | null; end: string | null }): ScheduleFix[] {
  if (!issue.from.end_at) return []
  const delta = Math.ceil((Date.parse(issue.from.end_at) + issue.requiredS * 1000 - Date.parse(issue.to.start_at)) / 60_000) * 60_000
  if (!(delta > 0)) return []
  const context = items.filter((i) => !i.deleted_at)
  const beforeConflicts = new Set(findConflicts(scheduledItems(context)).map(([a, b]) => key(a, b)))
  const beforeTravel = new Map(planTransfers(context, places, ctx, zone, members).filter((t) => t.gapS !== null).map((t) => [key(t.from.id, t.to.id), Math.max(0, t.requiredS - t.gapS!)]))
  const moves = [{ item: issue.to, delta, direction: 'later' }, { item: issue.from, delta: -delta, direction: 'earlier' }]
  return moves.filter((move) => !fixed(move.item)).map((move) => {
    let after: ItineraryItem
    try { after = atInstant(move.item, move.delta) }
    catch (error) { return { id: move.item.id, title: `Move ${move.item.title} ${move.direction}`, blocked: error instanceof Error ? error.message : 'Choose the times manually.', preview: { before: [move.item], after: [move.item], conflicts: 0, context } } }
    const combined = context.map((item) => item.id === after.id ? after : item)
    const conflicts = findConflicts(scheduledItems(combined))
    const transfers = planTransfers(combined, places, ctx, zone, members)
    const newOverlap = conflicts.some(([a, b]) => !beforeConflicts.has(key(a, b)))
    const newTravel = transfers.some((t) => t.gapS !== null && Math.max(0, t.requiredS - t.gapS) > (beforeTravel.get(key(t.from.id, t.to.id)) ?? 0))
    const unresolved = conflicts.some(([a, b]) => key(a, b) === issue.id) || transfers.some((t) => key(t.from.id, t.to.id) === issue.id && t.gapS !== null && t.gapS < t.requiredS)
    const date = dayKey(after.start_at, zone)
    const endDate = dayKey(after.end_at ?? after.start_at, zone)
    const outside = !!bounds.start && date < bounds.start || !!bounds.end && endDate > bounds.end
    const blocked = outside ? 'This would move the activity outside the trip dates.' : newOverlap ? 'This would create another overlap. Review the day manually.' : newTravel ? 'This would leave too little travel time elsewhere. Review the day manually.' : unresolved ? 'This move does not fully resolve the warning.' : null
    return { id: move.item.id, title: `Move ${move.item.title} ${Math.round(delta / 60_000)} min ${move.direction}`, blocked, preview: { before: [move.item], after: [after], conflicts: conflicts.filter(([a, b]) => a === after.id || b === after.id).length, context } }
  })
}

export const scheduleTime = (item: ItineraryItem, zone: string) => `${DateTime.fromISO(item.start_at, { zone }).toFormat('ccc d LLL, HH:mm')}${item.end_at ? `–${DateTime.fromISO(item.end_at, { zone }).toFormat(dayKey(item.start_at, zone) === dayKey(item.end_at, zone) ? 'HH:mm' : 'ccc d LLL, HH:mm')}` : ''}`

/** Route evidence and new plan entries can change while the preview is open. Check both atomically. */
export async function applyScheduleFix(issue: ScheduleIssue, fix: ScheduleFix, me: string | null, database: TripDb = db) {
  return database.transaction('rw', [database.trips, database.members, database.places, database.route_legs, database.leg_overrides, database.itinerary_items, database._outbox], async () => {
    const tripId = issue.from.trip_id
    const alive = <T extends { deleted_at?: string | null }>(row: T) => !row.deleted_at
    const [trip, items, places, members, legs, overrides] = await Promise.all([
      database.trips.get(tripId), database.itinerary_items.where('trip_id').equals(tripId).filter(alive).toArray(),
      database.places.where('trip_id').equals(tripId).filter(alive).toArray(), database.members.where('trip_id').equals(tripId).filter(alive).toArray(),
      database.route_legs.where('trip_id').equals(tripId).filter(alive).toArray(), database.leg_overrides.where('trip_id').equals(tripId).filter(alive).toArray(),
    ])
    if (!trip || trip.deleted_at) throw new Error('This trip is no longer available.')
    const ctx: LegContext = { legs, overrides, areaRoutes: trip.settings?.area_routes as AreaRoute[] ?? [], factorLow: Number(trip.route_factor_low ?? 1.4), factorHigh: Number(trip.route_factor_high ?? 2) }
    const memberIds = members.map((member) => member.id)
    const currentIssue = scheduleIssues(items, planTransfers(items, places, ctx, trip.timezone, memberIds)).find((value) => value.id === issue.id)
    const currentFix = currentIssue && scheduleFixes(currentIssue, items, places, ctx, trip.timezone, memberIds, { start: trip.start_date, end: trip.end_date }).find((value) => value.id === fix.id && !value.blocked)
    if (!currentFix || fix.blocked || currentFix.preview.after[0]?.start_at !== fix.preview.after[0]?.start_at || currentFix.preview.after[0]?.end_at !== fix.preview.after[0]?.end_at) throw new Error('The schedule or travel estimate changed. Close this preview and review the warning again.')
    return applySchedule(fix.preview, me, database)
  })
}
