import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import { save, softDelete } from '@/data/repo'
import type { DayNote, ItineraryItem, Trip } from '@/data/types'
import { stableId } from '@/lib/ids'
import { deviceZone, normalizeLocal, toInstant } from '@/lib/time'

const alive = <T extends { deleted_at?: string | null }>(r: T) => !r.deleted_at

export function useItems(tripId: string) {
  return useLiveQuery(
    async () => (await db.itinerary_items.where('trip_id').equals(tripId).filter(alive).toArray()).sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [tripId],
  )
}

export function useItem(itemId: string | undefined) {
  return useLiveQuery(() => (itemId ? db.itinerary_items.get(itemId) : undefined), [itemId])
}

export function useDayNote(tripId: string, day: string) {
  return useLiveQuery(() => db.day_notes.get(stableId(tripId, 'day', day)), [tripId, day])
}

/** The zone times are shown in: the trip's destination, or this phone's own zone. */
export function useDisplayZone(trip: Trip | undefined): { zone: string; view: 'trip' | 'device'; tripZone: string; phoneZone: string } {
  const view = useDevice((s) => s.timeView)
  const tripZone = trip?.timezone ?? deviceZone()
  const phoneZone = deviceZone()
  return { zone: view === 'trip' ? tripZone : phoneZone, view, tripZone, phoneZone }
}

/**
 * Saves an item, deriving its instants locally (so the plan works offline; the server derives the
 * same ones). A place put on the plan is marked "planned" if it was still an idea or shortlisted.
 */
export async function saveItem(item: ItineraryItem, memberId: string | null): Promise<void> {
  const start_local = normalizeLocal(item.start_local)
  const end_local = item.end_local ? normalizeLocal(item.end_local) : null
  const row: ItineraryItem = {
    ...item,
    start_local,
    end_local,
    end_tz: end_local ? (item.end_tz ?? item.start_tz) : null,
    start_at: toInstant(start_local, item.start_tz),
    end_at: end_local ? toInstant(end_local, item.end_tz ?? item.start_tz) : null,
  }
  if (row.end_at && row.end_at < row.start_at) throw new Error('It ends before it starts.')
  await save('itinerary_items', row, memberId)

  for (const placeId of [row.place_id, row.to_place_id]) {
    if (!placeId) continue
    const place = await db.places.get(placeId)
    if (place && !place.deleted_at && (place.status === 'catalog' || place.status === 'shortlist')) {
      await save('places', { ...place, status: row.status === 'confirmed' && row.confirmation_code ? 'booked' : 'planned' }, memberId)
    }
  }
}

export const deleteItem = (id: string, memberId: string | null) => softDelete('itinerary_items', id, memberId)

export async function saveDayNote(tripId: string, day: string, text: string, memberId: string | null): Promise<void> {
  const note: DayNote = { id: stableId(tripId, 'day', day), trip_id: tripId, date: day, title: null, notes: text.trim() || null }
  await save('day_notes', note, memberId)
}
