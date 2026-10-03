// Leave-by times for push reminders. This phone already knows the best travel time between
// stops (reported times, lanchas and shuttles, routed times); the server only knows start
// times. After each sync, a phone with notifications on sends its person's next 48 hours.

import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import type { AreaRoute } from '@/data/types'
import { MODE_LABEL } from '@/features/routing/legs'
import { planTransfers, type Transfer } from '@/features/itinerary/travel'
import { supabase } from '@/lib/supabase'

const WINDOW_MS = 48 * 3600_000

export interface ReminderRow {
  item_id: string
  leave_at: string
  item_start_at: string
  note: string
}

const minutes = (s: number) => Math.round(s / 60)

export function remindersFor(transfers: Transfer[], memberId: string, now: number): ReminderRow[] {
  return transfers
    .filter((t) => (t.memberIds.includes(memberId) || t.memberIds.includes('everyone')) && t.leaveAt > now && t.leaveAt < now + WINDOW_MS)
    .map((t) => ({
      item_id: t.to.id,
      leave_at: new Date(t.leaveAt).toISOString(),
      item_start_at: new Date(Date.parse(t.to.start_at)).toISOString(),
      note: `${MODE_LABEL[t.option.mode].label} from ${t.fromPlace.name}, ${minutes(t.option.minS)}–${minutes(t.option.maxS)} min`.slice(0, 160),
    }))
    .slice(0, 100)
}

const lastSent = new Map<string, string>()

/** Sends this phone's upcoming leave-by times if notifications are on and anything changed. */
export async function publishReminders(tripId: string, now = Date.now()): Promise<void> {
  const device = useDevice.getState()
  const memberId = device.trips[tripId]?.memberId
  if (!memberId || !device.push[tripId]?.prefs.leave || !navigator.onLine) return
  const alive = <T extends { deleted_at?: string | null }>(r: T) => !r.deleted_at
  const [trip, items, places, members, legs, overrides] = await Promise.all([
    db.trips.get(tripId),
    db.itinerary_items.where('trip_id').equals(tripId).filter(alive).toArray(),
    db.places.where('trip_id').equals(tripId).filter(alive).toArray(),
    db.members.where('trip_id').equals(tripId).filter(alive).toArray(),
    db.route_legs.where('trip_id').equals(tripId).filter(alive).toArray(),
    db.leg_overrides.where('trip_id').equals(tripId).filter(alive).toArray(),
  ])
  if (!trip) return
  const ctx = {
    legs, overrides,
    areaRoutes: (trip.settings?.area_routes as AreaRoute[] | undefined) ?? [],
    factorLow: Number(trip.route_factor_low ?? 1.4),
    factorHigh: Number(trip.route_factor_high ?? 2.0),
  }
  const rows = remindersFor(planTransfers(items, places, ctx, trip.timezone, members.map((m) => m.id)), memberId, now)
  const key = `${tripId}:${memberId}`
  const body = JSON.stringify(rows)
  if (lastSent.get(key) === body) return
  const { error } = await supabase.rpc('set_my_reminders', { p_trip_id: tripId, p_member_id: memberId, p_rows: rows })
  if (error) console.warn('leave-by reminders not saved', error.message)
  else lastSent.set(key, body)
}
