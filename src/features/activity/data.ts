import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import { buildFeed, unseenCount, type ActivityEvent } from './feed'

export function useActivity(tripId: string, limit = 50): ActivityEvent[] | undefined {
  return useLiveQuery(async () => {
    const mine = { trip_id: tripId }
    const [members, polls, options, places, items, expenses, tasks, attachments, comments, settlements, ratings] = await Promise.all([
      db.members.where(mine).toArray(), db.polls.where(mine).toArray(), db.poll_options.where(mine).toArray(), db.places.where(mine).toArray(),
      db.itinerary_items.where(mine).toArray(), db.expenses.where(mine).toArray(), db.trip_tasks.where(mine).toArray(),
      db.attachments.where(mine).toArray(), db.comments.where(mine).toArray(), db.settlements.where(mine).toArray(), db.place_ratings.where(mine).toArray(),
    ])
    return buildFeed({ members, polls, options, places, items, expenses, settlements, ratings, tasks, attachments, comments }, limit)
  }, [tripId, limit])
}

/** When this person last looked at the trip's news; before the first look, when they joined. */
export const useActivitySeen = (tripId: string) => useDevice((s) => s.activitySeen?.[tripId] ?? s.trips[tripId]?.joinedAt ?? null)

/** How many things other people have done since this person last looked. */
export function useUnseenActivity(tripId: string, me: string | null): number {
  const events = useActivity(tripId)
  const since = useActivitySeen(tripId)
  return events ? unseenCount(events, since, me) : 0
}

/**
 * Marks the news as seen once it is on screen, and returns the mark from before, so this visit
 * can still show which entries are new.
 */
export function useMarkActivitySeen(tripId: string, loaded: boolean): string | null {
  const [since] = useState(() => { const s = useDevice.getState(); return s.activitySeen?.[tripId] ?? s.trips[tripId]?.joinedAt ?? null })
  useEffect(() => {
    if (loaded) useDevice.getState().setActivitySeen(tripId, new Date().toISOString())
  }, [tripId, loaded])
  return since
}
