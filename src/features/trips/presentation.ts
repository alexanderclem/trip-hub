import { DateTime } from 'luxon'
import type { Trip } from '@/data/types'
import { tripPhase } from './phase'

export { TRIP_COVERS, tripCover, type TripCover } from './covers'

export function tripStatus(trip: Pick<Trip, 'start_date' | 'end_date' | 'timezone'>, now: number) {
  const phase = tripPhase(trip, now)
  if (phase === 'complete') return { phase, label: 'Past trip' }
  if (phase === 'traveling') return { phase, label: 'Traveling now' }
  const today = DateTime.fromMillis(now, { zone: trip.timezone }).startOf('day')
  const start = trip.start_date ? DateTime.fromISO(trip.start_date, { zone: trip.timezone }).startOf('day') : null
  const days = start?.isValid && today.isValid ? Math.round(start.diff(today, 'days').days) : null
  return { phase, label: days !== null && days > 0 ? `In ${days} ${days === 1 ? 'day' : 'days'}` : 'Dates to come' }
}
