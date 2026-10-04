import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { save } from '@/data/repo'
import type { Trip } from '@/data/types'
import type { WrappedData } from './stats'

/** Everything the recap needs, from this phone's copy of the trip. */
export function useWrappedData(tripId: string): WrappedData | null | undefined {
  return useLiveQuery(async () => {
    const trip = await db.trips.get(tripId)
    if (!trip) return null
    const [members, items, places, legs, ratings, polls, options, votes, expenses, tasks, packing, attachments, preferences] = await Promise.all([
      db.members.where('trip_id').equals(tripId).toArray(),
      db.itinerary_items.where('trip_id').equals(tripId).toArray(),
      db.places.where('trip_id').equals(tripId).toArray(),
      db.route_legs.where('trip_id').equals(tripId).toArray(),
      db.place_ratings.where('trip_id').equals(tripId).toArray(),
      db.polls.where('trip_id').equals(tripId).toArray(),
      db.poll_options.where('trip_id').equals(tripId).toArray(),
      db.poll_votes.where('trip_id').equals(tripId).toArray(),
      db.expenses.where('trip_id').equals(tripId).toArray(),
      db.trip_tasks.where('trip_id').equals(tripId).toArray(),
      db.packing_items.where('trip_id').equals(tripId).toArray(),
      db.attachments.where('trip_id').equals(tripId).toArray(),
      db.member_preferences.where('trip_id').equals(tripId).toArray(),
    ])
    return { trip, members, items, places, legs, ratings, polls, options, votes, expenses, tasks, packing, attachments, preferences }
  }, [tripId])
}

/** The group's shared photo album link, kept in trips.settings.album_url. */
export const albumUrl = (trip: Pick<Trip, 'settings'>) => {
  const v = trip.settings?.album_url
  return typeof v === 'string' && /^https:\/\//.test(v) ? v : null
}

export async function saveAlbumUrl(tripId: string, url: string, me: string | null) {
  const clean = url.trim()
  if (clean && !/^https:\/\/\S+$/.test(clean)) throw new Error('Paste a link that starts with https://')
  const trip = await db.trips.get(tripId)
  if (!trip) throw new Error('This trip is not on this phone.')
  await save('trips', { ...trip, settings: { ...trip.settings, album_url: clean || null } }, me)
}
