import { DateTime } from 'luxon'
import type { Trip } from '@/data/types'

export type TripPhase = 'planning' | 'preparing' | 'traveling' | 'complete'

/** Calendar-day priorities in the destination zone, independent of the phone/display zone. */
export function tripPhase(trip: Pick<Trip, 'start_date' | 'end_date' | 'timezone'>, now: number): TripPhase {
  if (!trip.start_date) return 'planning'
  const today = DateTime.fromMillis(now, { zone: trip.timezone }).startOf('day')
  const start = DateTime.fromISO(trip.start_date, { zone: trip.timezone }).startOf('day')
  const end = DateTime.fromISO(trip.end_date ?? trip.start_date, { zone: trip.timezone }).startOf('day')
  if (!today.isValid || !start.isValid || !end.isValid || end < start) return 'planning'
  if (today > end) return 'complete'
  if (today >= start) return 'traveling'
  return today >= start.minus({ days: 7 }) ? 'preparing' : 'planning'
}
