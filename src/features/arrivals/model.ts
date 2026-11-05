import { DateTime } from 'luxon'
import type { ItineraryItem, Member, Place } from '@/data/types'

export type JourneyDirection = 'arrival' | 'departure'
export function journeyDirection(item: ItineraryItem): JourneyDirection | null {
  const value = item.details?.journey_direction
  return (item.kind === 'flight' || item.kind === 'transport') && (value === 'arrival' || value === 'departure') ? value : null
}
export function journeyTime(item: ItineraryItem): string | null {
  return journeyDirection(item) === 'arrival' ? item.end_at : item.start_at
}
export function journeyLocation(item: ItineraryItem, places: Place[]): string {
  const id = journeyDirection(item) === 'arrival' ? item.to_place_id : item.place_id
  return item.details?.journey_location || places.find((p) => p.id === id)?.name || 'Location to be added'
}
export function boardRows(items: ItineraryItem[], direction: JourneyDirection) {
  return items.filter((i) => !i.deleted_at && i.status !== 'cancelled' && journeyDirection(i) === direction)
    .sort((a, b) => (journeyTime(a) ? DateTime.fromISO(journeyTime(a)!).toMillis() : Infinity) - (journeyTime(b) ? DateTime.fromISO(journeyTime(b)!).toMillis() : Infinity) || a.title.localeCompare(b.title))
}
export function missingTravelers(items: ItineraryItem[], members: Member[], direction: JourneyDirection) {
  const rows = boardRows(items, direction)
  return members.filter((m) => !m.deleted_at && !rows.some((i) => i.attendee_ids === null || i.attendee_ids.includes(m.id)))
}
/** Suggestions only: same known location, within 90 minutes, with different travelers. */
export function rideMatches(item: ItineraryItem, items: ItineraryItem[], places: Place[]) {
  const at = journeyTime(item)
  const location = journeyLocation(item, places)
  if (!at || location === 'Location to be added') return []
  return boardRows(items, journeyDirection(item)!).filter((other) => {
    const otherAt = journeyTime(other)
    return other.id !== item.id && !!otherAt && journeyLocation(other, places).trim().toLowerCase() === location.trim().toLowerCase()
      && Math.abs(DateTime.fromISO(at).toMillis() - DateTime.fromISO(otherAt).toMillis()) <= 90 * 60_000
      && item.attendee_ids !== null && other.attendee_ids !== null
      && other.attendee_ids.some((id) => !item.attendee_ids!.includes(id))
  })
}
