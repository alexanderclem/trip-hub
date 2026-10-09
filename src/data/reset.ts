// Alpha began with an empty server: every trip and account from before RESET_AT was removed
// there. A phone's saved copy of those trips can't sync any more, so it is cleared the next time
// the app opens. Trips joined after the reset are never touched.

import { db } from './db'
import { useDevice, type JoinedTrip } from './device'

export const RESET_AT = '2026-10-09T00:07:00.000Z'

/** The ids of saved trips that were joined before the reset. */
export function preResetTrips(trips: Record<string, JoinedTrip>, resetAt = RESET_AT): string[] {
  const cutoff = Date.parse(resetAt)
  // A trip with no readable join time can only be an old one.
  return Object.values(trips).filter((t) => !(Date.parse(t.joinedAt) >= cutoff)).map((t) => t.tripId)
}

async function dropTrip(tripId: string): Promise<void> {
  const fileNames = (await db.attachments.where('trip_id').equals(tripId).primaryKeys()).map((id) => `att:${id}`)
  await db.files.bulkDelete(fileNames)
  for (const table of db.tables) {
    if (table.schema.indexes.some((i) => i.name === 'trip_id')) await table.where('trip_id').equals(tripId).delete()
  }
  await db.trips.delete(tripId)
  await db._outbox.filter((e) => e.rowId === tripId || e.payload.trip_id === tripId).delete()
  await db._deadletter.filter((e) => e.rowId === tripId || e.payload.trip_id === tripId).delete()
  await db._meta.where('key').startsWith(`cursor:${tripId}:`).delete()
}

/** Removes pre-reset trips from this phone. True if anything was removed. */
export async function clearPreResetTrips(): Promise<boolean> {
  const { trips } = useDevice.getState()
  const stale = preResetTrips(trips)
  if (stale.length === 0) return false
  if (stale.length === Object.keys(trips).length) {
    // Nothing here is from after the reset: start clean, including the sign-in the server no longer knows.
    const { supabase } = await import('@/lib/supabase')
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
    useDevice.setState({ trips: {} })
    await db.delete()
    return true
  }
  for (const tripId of stale) {
    await dropTrip(tripId)
    useDevice.getState().forgetTrip(tripId)
  }
  return true
}
