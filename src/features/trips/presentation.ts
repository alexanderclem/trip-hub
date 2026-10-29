import { DateTime } from 'luxon'
import type { Trip } from '@/data/types'
import { tripPhase } from './phase'

export const TRIP_COVERS = [
  { id: 'coast', label: 'By the water' },
  { id: 'mountains', label: 'Into the mountains' },
  { id: 'city', label: 'Around the city' },
  { id: 'countryside', label: 'The scenic route' },
  { id: 'none', label: 'Just the essentials' },
] as const
export type TripCover = (typeof TRIP_COVERS)[number]['id']

export function tripCover(trip: Pick<Trip, 'id' | 'settings'>): TripCover {
  const saved = trip.settings?.journal_cover
  if (TRIP_COVERS.some((cover) => cover.id === saved)) return saved as TripCover
  // Older trips get a stable illustration, even before their group picks one.
  const hash = Array.from(trip.id).reduce((value, letter) => value + letter.charCodeAt(0), 0)
  return TRIP_COVERS[hash % 4]!.id
}

export function tripStatus(trip: Pick<Trip, 'start_date' | 'end_date' | 'timezone'>, now: number) {
  const phase = tripPhase(trip, now)
  if (phase === 'complete') return { phase, label: 'Past trip' }
  if (phase === 'traveling') return { phase, label: 'Traveling now' }
  const today = DateTime.fromMillis(now, { zone: trip.timezone }).startOf('day')
  const start = trip.start_date ? DateTime.fromISO(trip.start_date, { zone: trip.timezone }).startOf('day') : null
  const days = start?.isValid && today.isValid ? Math.round(start.diff(today, 'days').days) : null
  return { phase, label: days !== null && days > 0 ? `In ${days} ${days === 1 ? 'day' : 'days'}` : 'Dates to come' }
}
