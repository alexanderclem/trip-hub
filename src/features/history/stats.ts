import { DateTime } from 'luxon'
import type { ItineraryItem, Place, Trip } from '@/data/types'
import { tripAreas } from '@/features/destinations/destinations'
import { haversineM } from '@/lib/geo'

/** A summary of personal past plans, not a claim that a reservation was actually used. */
export function travelHistory(trips: Trip[], items: ItineraryItem[], places: Place[], members: Record<string, string | null>, now: number) {
  const past = trips.filter((t) => !t.deleted_at && members[t.id] && t.end_date && t.end_date < DateTime.fromMillis(now, { zone: t.timezone }).toISODate()!)
  const ids = new Set(past.map((t) => t.id))
  const personal = items.filter((i) => ids.has(i.trip_id) && !i.deleted_at && i.status !== 'cancelled' && (!i.attendee_ids || i.attendee_ids.includes(members[i.trip_id]!)))
  const countries = [...new Set(past.flatMap((t) => {
    const codes = tripAreas(t).map((a) => a.countryCode)
    codes.push(typeof t.settings.destination_country === 'string' ? t.settings.destination_country : null)
    return codes.filter((c): c is string => !!c && /^[a-z]{2}$/i.test(c)).map((c) => c.toUpperCase())
  }))].sort()
  const nights = new Set<string>()
  let flightMinutes = 0, distanceKm = 0
  const byPlace = new Map(places.filter((p) => !p.deleted_at).map((p) => [p.id, p]))
  for (const item of personal) {
    if (item.kind === 'flight' && item.end_at) flightMinutes += Math.max(0, (Date.parse(item.end_at) - Date.parse(item.start_at)) / 60000)
    if (item.kind === 'lodging' && item.end_local) {
      let day = DateTime.fromISO(item.start_local.slice(0, 10), { zone: 'UTC' })
      const end = DateTime.fromISO(item.end_local.slice(0, 10), { zone: 'UTC' })
      // Bound corrupt legacy ranges; real trips do not require thousands of nights.
      for (let n = 0; n < 3660 && day.isValid && day < end; n++, day = day.plus({ days: 1 })) nights.add(`${item.trip_id}:${day.toISODate()}`)
    }
    if (item.kind === 'flight' || item.kind === 'transport') {
      const from = byPlace.get(item.place_id ?? ''), to = byPlace.get(item.to_place_id ?? '')
      if (from?.trip_id === item.trip_id && to?.trip_id === item.trip_id && from.lat != null && from.lng != null && to.lat != null && to.lng != null) distanceKm += haversineM({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }) / 1000
    }
  }
  return { trips: past.length, countries, nights: nights.size, flights: personal.filter((i) => i.kind === 'flight').length, flightMinutes: Math.round(flightMinutes), distanceKm: Math.round(distanceKm) }
}
