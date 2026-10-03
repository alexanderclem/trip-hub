import { useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import type { MemberPreference } from '@/data/types'
import { useSyncStatus } from '@/data/sync/controller'
import { saveProfile } from '@/features/discovery/data'
import { profileSchema, type Profile, type Scores } from '@/features/discovery/model'

/** This person's profile row in a trip, in any state (a row seeded elsewhere may not use the stable id). */
const myRow = (tripId: string, memberId: string) =>
  db.member_preferences.where('trip_id').equals(tripId).filter((r) => r.member_id === memberId).first()

const asProfile = (row: MemberPreference | undefined): Profile | null => {
  if (!row || row.deleted_at) return null
  const parsed = profileSchema.safeParse(row)
  return parsed.success ? parsed.data : null
}

/**
 * Saves a finished quiz as this device's travel profile and, inside a trip, as this person's
 * profile there. Notes typed earlier in the full editor are kept.
 */
export async function saveQuizResult(scores: Scores, tripId?: string, memberId?: string | null): Promise<Profile> {
  const device = useDevice.getState()
  const existing = tripId && memberId ? asProfile(await myRow(tripId, memberId)) : null
  const base = existing ?? device.travelProfile
  const profile: Profile = { scores, description: base?.description ?? '', constraints: base?.constraints ?? '' }
  if (tripId && memberId) await saveProfile(tripId, memberId, profile)
  device.setTravelProfile(profile)
  device.setQuizSeen()
  return profile
}

/**
 * The person's profile in a trip, so a second phone (or a reinstall) adopts it instead of asking
 * again. undefined while loading, null when there's none.
 */
export function useMyTripProfile(tripId: string, memberId: string | null, enabled: boolean): Profile | null | undefined {
  return useLiveQuery(async () => (enabled && memberId ? asProfile(await myRow(tripId, memberId)) : null), [tripId, memberId, enabled])
}

/** Uses a profile found in a trip as this device's own, which also ends the opening quiz. */
export function adoptProfile(profile: Profile) {
  const device = useDevice.getState()
  device.setTravelProfile(profile)
  device.setQuizSeen()
}

/** After Google sign-in: false if the quiz is done, or a restored trip has this person's profile to adopt. */
export async function quizStillNeeded(): Promise<boolean> {
  const device = useDevice.getState()
  if (device.quizSeen || device.travelProfile) return false
  for (const { tripId, memberId } of Object.values(device.trips)) {
    const profile = memberId ? asProfile(await myRow(tripId, memberId)) : null
    if (profile) {
      adoptProfile(profile)
      return false
    }
  }
  return true
}

/**
 * Copies this device's profile into a trip that doesn't have one for this person yet. It waits
 * for a sync to finish after the trip opens, so a profile another phone already saved arrives
 * first and is never overwritten. Offline it simply waits.
 */
export function useSeedMyProfile(tripId: string, memberId: string | null) {
  const profile = useDevice((s) => s.travelProfile)
  const lastSyncedAt = useSyncStatus((s) => s.lastSyncedAt)
  // A sync that finished before this trip opened may have been for another trip.
  const openedAfter = useMemo(() => (tripId ? useSyncStatus.getState().lastSyncedAt : null), [tripId])
  const synced = lastSyncedAt !== null && lastSyncedAt !== openedAfter

  useEffect(() => {
    if (!memberId || !profile || !synced) return
    let cancelled = false
    void myRow(tripId, memberId)
      .then((row) => (row || cancelled ? undefined : saveProfile(tripId, memberId, profile)))
      .catch(() => undefined) // tried again on the next sync
    return () => {
      cancelled = true
    }
  }, [tripId, memberId, profile, synced])
}
