// Turns a live-price plan into tentative itinerary items, so "Add to plan" fills the trip's Plan tab.
// Ids are stable per plan, so adding twice never duplicates, and undo removes exactly what was added.
// Nothing is booked: items are tentative and carry the offer's price as an estimate. The plan shows
// an "AI" flag for `details.live_plan_id` (features/itinerary/AiFlag.tsx).
// Hotels and tours become places in the trip, so they show up on the map: tied to a place the trip
// already has with the same name, else a new place at the provider's location (a hotel without one
// is found by name and address later, by useAutoLocate).
import { DateTime } from 'luxon'
import { db } from '@/data/db'
import { saveMany, softDelete } from '@/data/repo'
import type { ItemKind, ItineraryItem, Place, Trip } from '@/data/types'
import { stableId } from '@/lib/ids'
import { findConflicts, toInstant } from '@/lib/time'
import { findKnownPlace } from '@/features/places/locate'
import type { FinalPlan } from './client'

/** The server sends 'HH:mm'; older saved plans may hold a full ISO time. */
const hhmm = (t: string) => (t.includes('T') ? t.split('T')[1]! : t).slice(0, 5)
const KIND: Record<string, ItemKind> = { flight: 'flight', activity: 'activity', free: 'free' }
const located = (lat: number | null | undefined, lng: number | null | undefined) => lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)

/**
 * The places a plan's hotels and tours belong to: `links` maps `stay:<rateId>` and `node:<n>` to a
 * place id, and `places` are the new rows to save. Free time already names its place.
 */
export function planPlaces(plan: FinalPlan, trip: Pick<Trip, 'id'>, known: Place[], area: string | null = null) {
  const links = new Map<string, string>()
  const places = new Map<string, Place>()
  const pool = [...known]
  const place = (key: string, id: string, row: Pick<Place, 'name' | 'category' | 'lat' | 'lng' | 'address' | 'external_ids'>) => {
    const match = findKnownPlace(row.name, pool)
    if (match) { links.set(key, match.id); return }
    const created: Place = { id, trip_id: trip.id, tags: ['ai-suggested'], status: 'planned', notes: null, phone: null, website: null, opening_hours: null, source: 'suggestion', area, ...row }
    places.set(id, created)
    pool.push(created)
    links.set(key, id)
  }
  for (const day of plan.days) {
    const stay = day.stay
    if (stay && !links.has(`stay:${stay.rateId}`)) {
      const at = located(stay.lat, stay.lng)
      place(`stay:${stay.rateId}`, stableId(trip.id, 'live-place', 'hotel', stay.hotelId ?? stay.name), {
        name: stay.name, category: 'lodging', lat: at ? stay.lat! : null, lng: at ? stay.lng! : null,
        address: stay.address ?? null, external_ids: stay.hotelId ? { liteapi_hotel: stay.hotelId } : {},
      })
    }
    for (const i of day.items) {
      // A tour with no meeting point has nothing to pin; its title is rarely a place's name.
      if (i.kind !== 'activity' || i.placeId || !located(i.lat, i.lng)) continue
      place(`node:${i.node}`, stableId(trip.id, 'live-place', 'tour', i.product ?? i.title), {
        name: i.title, category: 'activity', lat: i.lat!, lng: i.lng!, address: null, external_ids: i.product ? { liteapi_product: i.product } : {},
      })
    }
  }
  return { links, places: [...places.values()] }
}

export function planItems(plan: FinalPlan, trip: Pick<Trip, 'id' | 'timezone'>, planId: string, links: Map<string, string> = new Map()): ItineraryItem[] {
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
    status: 'tentative', confirmation_code: null, attendee_ids: null, notes: null, ...fields,
  })
  const out: ItineraryItem[] = []
  const stays = new Set<string>()
  for (const day of plan.days) {
    const stay = day.stay
    if (stay?.checkin && stay.checkout && !stays.has(stay.rateId)) {
      stays.add(stay.rateId)
      out.push(item(`stay:${stay.rateId}`, {
        title: stay.name, kind: 'lodging', place_id: links.get(`stay:${stay.rateId}`) ?? null, start_local: `${stay.checkin}T15:00`, end_local: `${stay.checkout}T11:00`,
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
        title: i.title, kind: KIND[i.kind] ?? 'activity', place_id: i.placeId ?? links.get(`node:${i.node}`) ?? null, start_local: start, end_local: end,
        details: { live_plan_id: planId, ...(i.url ? { link: i.url } : {}) }, ...priceOnce(i.kind === 'free' ? null : i.ref),
      }))
    }
  }
  return out
}

/** Adds what fits. Anything that clashes with an existing entry is left out and counted. */
export async function addPlanToTrip(plan: FinalPlan, trip: Trip, planId: string, memberId: string, area: string | null = null) {
  const known = await db.places.where('trip_id').equals(trip.id).filter((p) => !p.deleted_at).toArray()
  const { links, places } = planPlaces(plan, trip, known, area)
  const items = planItems(plan, trip, planId, links)
  const ours = new Set(items.map((i) => i.id))
  const existing = await db.itinerary_items.where('trip_id').equals(trip.id).filter((r) => !r.deleted_at && r.status !== 'cancelled' && !ours.has(r.id)).toArray()
  const fits = items.filter((i) => !existing.some((row) => findConflicts([i, row]).length > 0))
  const used = new Set(fits.map((i) => i.place_id))
  const newPlaces = places.filter((p) => used.has(p.id))
  // Places the plan uses that were only ideas become planned, so they show on the map.
  const promoted = known.filter((p) => used.has(p.id) && (p.status === 'catalog' || p.status === 'shortlist')).map((p) => ({ ...p, status: 'planned' as const }))
  await saveMany('places', [...newPlaces, ...promoted], memberId)
  await saveMany('itinerary_items', fits, memberId)
  return { added: fits.length, skipped: items.length - fits.length, ids: fits.map((i) => i.id), placeIds: newPlaces.map((p) => p.id) }
}

/** Removes the plan's items, and the places it created unless something else now uses them. */
export async function removePlanFromTrip(ids: string[], memberId: string, placeIds: string[] = []) {
  for (const id of ids) await softDelete('itinerary_items', id, memberId)
  for (const id of placeIds) {
    const place = await db.places.get(id)
    if (!place || place.deleted_at) continue
    const [items, expenses, attachments, ratings, options] = await Promise.all([
      db.itinerary_items.where('trip_id').equals(place.trip_id).filter((r) => !r.deleted_at && (r.place_id === id || r.to_place_id === id)).count(),
      db.expenses.where('place_id').equals(id).filter((r) => !r.deleted_at).count(),
      db.attachments.where('trip_id').equals(place.trip_id).filter((r) => !r.deleted_at && r.place_id === id).count(),
      db.place_ratings.where('place_id').equals(id).filter((r) => !r.deleted_at).count(),
      db.poll_options.where('place_id').equals(id).filter((r) => !r.deleted_at).count(),
    ])
    if (!items && !expenses && !attachments && !ratings && !options) await softDelete('places', id, memberId)
  }
}
