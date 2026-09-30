import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { Member, Place, Trip } from './types'

const alive = <T extends { deleted_at?: string | null }>(r: T) => !r.deleted_at

export function useTrip(tripId: string | undefined): Trip | undefined {
  return useLiveQuery(() => (tripId ? db.trips.get(tripId) : undefined), [tripId])
}

export function useMembers(tripId: string | undefined): Member[] | undefined {
  return useLiveQuery(
    async () =>
      tripId
        ? (await db.members.where('trip_id').equals(tripId).filter(alive).toArray()).sort((a, b) =>
            a.display_name.localeCompare(b.display_name),
          )
        : [],
    [tripId],
  )
}

export function usePlaces(tripId: string | undefined): Place[] | undefined {
  return useLiveQuery(
    async () => (tripId ? db.places.where('trip_id').equals(tripId).filter(alive).toArray() : []),
    [tripId],
  )
}

export function usePlace(placeId: string | undefined): Place | undefined {
  return useLiveQuery(() => (placeId ? db.places.get(placeId) : undefined), [placeId])
}

export function useLinks(placeId: string | undefined) {
  return useLiveQuery(
    async () => (placeId ? db.links.where('place_id').equals(placeId).filter(alive).toArray() : []),
    [placeId],
  )
}

export function usePendingCount(): number {
  return useLiveQuery(() => db._outbox.count(), []) ?? 0
}

export function useDeadLetters() {
  return useLiveQuery(() => db._deadletter.toArray(), []) ?? []
}
