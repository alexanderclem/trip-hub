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
export async function saveItem(item: ItineraryItem, memberId: string | null, attachmentId?: string): Promise<void> {
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
  await db.transaction('rw', [db.itinerary_items, db.attachments, db.places, db.polls, db.poll_options, db._outbox], async () => {
    if (row.details?.decision_poll_id) {
      const poll = await db.polls.get(row.details.decision_poll_id)
      const option = await db.poll_options.get(row.details.decision_option_id ?? '')
      // Ordinary edits remain possible after a vote is reopened; a new handoff must be current.
      const previous = await db.itinerary_items.get(row.id)
      if (previous?.deleted_at) throw new Error('This planned choice was removed. Link a different item from the vote.')
      if (!previous && (!poll || poll.deleted_at || poll.trip_id !== row.trip_id || poll.status !== 'closed' || poll.winner_option_id !== option?.id || !option || option.deleted_at || option.poll_id !== poll.id || option.trip_id !== row.trip_id)) throw new Error('This decision changed. Return to the vote to review it.')
      const duplicate = await db.itinerary_items.where('trip_id').equals(row.trip_id).filter((i) => i.id !== row.id && !i.deleted_at && i.status !== 'cancelled' && i.details?.decision_poll_id === row.details.decision_poll_id && i.details?.decision_option_id === row.details.decision_option_id).first()
      if (duplicate) throw new Error('This choice is already in the plan. Return to the vote to view it.')
    }
    const attachment = attachmentId ? await db.attachments.get(attachmentId) : undefined
    if (attachmentId) {
      if (!attachment || attachment.deleted_at || attachment.trip_id !== item.trip_id) throw new Error('This ticket is no longer available.')
      if (attachment.item_id && attachment.item_id !== item.id) {
        const linked = await db.itinerary_items.get(attachment.item_id)
        if (linked && !linked.deleted_at) throw new Error('This ticket is already linked to an itinerary item.')
      }
    }
    await save('itinerary_items', row, memberId)
    if (attachment) await save('attachments', { ...attachment, item_id: item.id }, memberId)

    for (const placeId of [row.place_id, row.to_place_id]) {
      if (!placeId) continue
      const place = await db.places.get(placeId)
      if (place && !place.deleted_at && (place.status === 'catalog' || place.status === 'shortlist')) {
        await save('places', { ...place, status: row.status === 'confirmed' && row.confirmation_code ? 'booked' : 'planned' }, memberId)
      }
    }
  })
}

export const deleteItem = (id: string, memberId: string | null) => softDelete('itinerary_items', id, memberId)

export async function saveDayNote(tripId: string, day: string, text: string, memberId: string | null): Promise<void> {
  const note: DayNote = { id: stableId(tripId, 'day', day), trip_id: tripId, date: day, title: null, notes: text.trim() || null }
  await save('day_notes', note, memberId)
}
