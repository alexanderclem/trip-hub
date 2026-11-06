// Turns a live-price plan into tentative itinerary items, so "Add to plan" fills the trip's Plan tab.
// Ids are stable per plan, so adding twice never duplicates, and undo removes exactly what was added.
// Nothing is booked: items are tentative and carry the offer's price as an estimate.
import { DateTime } from 'luxon'
import { db } from '@/data/db'
import { saveMany, softDelete } from '@/data/repo'
import type { ItemKind, ItineraryItem, Trip } from '@/data/types'
import { stableId } from '@/lib/ids'
import { findConflicts, toInstant } from '@/lib/time'
import type { FinalPlan } from './client'

const NOTE = 'From a live-price plan. Not booked yet, and prices can change.'
/** The server sends 'HH:mm'; older saved plans may hold a full ISO time. */
const hhmm = (t: string) => (t.includes('T') ? t.split('T')[1]! : t).slice(0, 5)
const KIND: Record<string, ItemKind> = { flight: 'flight', activity: 'activity', free: 'free' }

export function planItems(plan: FinalPlan, trip: Pick<Trip, 'id' | 'timezone'>, planId: string): ItineraryItem[] {
  const zone = trip.timezone
  const cost = new Map(plan.bookable.map((b) => [b.ref, b.totalMinor]))
  const priced = new Set<string>()
  const priceOnce = (ref: string | null) => {
    if (!ref || priced.has(ref) || !cost.has(ref)) return { est_cost_minor: null, est_cost_currency: null }
    priced.add(ref)
    return { est_cost_minor: cost.get(ref)!, est_cost_currency: plan.currency }
  }
  const item = (key: string, fields: Pick<ItineraryItem, 'title' | 'kind' | 'place_id' | 'start_local' | 'end_local' | 'details' | 'est_cost_minor' | 'est_cost_currency'>, startTz = zone, endTz = zone): ItineraryItem => ({
    id: stableId(trip.id, 'live-plan', planId, key), trip_id: trip.id, to_place_id: null, all_day: false,
    start_tz: startTz, end_tz: endTz, start_at: toInstant(fields.start_local, startTz), end_at: fields.end_local ? toInstant(fields.end_local, endTz) : null,
    status: 'tentative', confirmation_code: null, attendee_ids: null, notes: NOTE, ...fields,
  })
  const out: ItineraryItem[] = []
  const stays = new Set<string>()
  for (const day of plan.days) {
    const stay = day.stay
    if (stay?.checkin && stay.checkout && !stays.has(stay.rateId)) {
      stays.add(stay.rateId)
      out.push(item(`stay:${stay.rateId}`, {
        title: stay.name, kind: 'lodging', place_id: null, start_local: `${stay.checkin}T15:00`, end_local: `${stay.checkout}T11:00`,
        details: { live_plan_id: planId, ...(stay.address ? { address: stay.address } : {}) }, ...priceOnce(stay.rateId),
      }))
    }
    for (const i of day.items) {
      if (i.depart && i.arrive) {
        // Flights keep each end in its own airport's zone, like a flight entered by hand.
        out.push(item(`node:${i.node}:${i.depart.local}`, {
          title: i.title, kind: 'flight', place_id: null, start_local: i.depart.local, end_local: i.arrive.local,
          details: { live_plan_id: planId }, ...priceOnce(i.ref),
        }, i.depart.zone, i.arrive.zone))
        continue
      }
      const start = `${day.date}T${hhmm(i.start)}`
      let end = `${day.date}T${hhmm(i.end)}`
      if (end <= start) end = `${DateTime.fromISO(day.date).plus({ days: 1 }).toISODate()}T${hhmm(i.end)}` // overnight flight
      out.push(item(`node:${i.node}:${start}`, {
        title: i.title, kind: KIND[i.kind] ?? 'activity', place_id: i.placeId ?? null, start_local: start, end_local: end,
        details: { live_plan_id: planId, ...(i.url ? { link: i.url } : {}) }, ...priceOnce(i.kind === 'free' ? null : i.ref),
      }))
    }
  }
  return out
}

/** Adds what fits. Anything that clashes with an existing entry is left out and counted. */
export async function addPlanToTrip(plan: FinalPlan, trip: Trip, planId: string, memberId: string) {
  const items = planItems(plan, trip, planId)
  const ours = new Set(items.map((i) => i.id))
  const existing = await db.itinerary_items.where('trip_id').equals(trip.id).filter((r) => !r.deleted_at && r.status !== 'cancelled' && !ours.has(r.id)).toArray()
  const fits = items.filter((i) => !existing.some((row) => findConflicts([i, row]).length > 0))
  await saveMany('itinerary_items', fits, memberId)
  return { added: fits.length, skipped: items.length - fits.length, ids: fits.map((i) => i.id) }
}

export async function removePlanFromTrip(ids: string[], memberId: string) {
  for (const id of ids) await softDelete('itinerary_items', id, memberId)
}
