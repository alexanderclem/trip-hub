import { expect, it } from 'vitest'
import type { Trip, ItineraryItem } from '@/data/types'
import { travelHistory } from './stats'
it('counts personal past plans, deduplicates hotel nights and excludes cancelled and other travelers’ items', () => {
  const trips = [{ id: 'past', timezone: 'UTC', end_date: '2027-03-18', settings: { destination_country: 'GT' } }, { id: 'future', timezone: 'UTC', end_date: '2028-03-18', settings: { destination_country: 'US' } }] as unknown as Trip[]
  const stay = { trip_id: 'past', kind: 'lodging', start_local: '2027-03-15T15:00', end_local: '2027-03-18T11:00', attendee_ids: null }
  const flight = { trip_id: 'past', kind: 'flight', start_at: '2027-03-15T13:00:00Z', end_at: '2027-03-15T15:00:00Z', attendee_ids: ['me'] }
  const items = [stay, { ...stay }, flight, { ...flight, attendee_ids: ['someone'] }, { ...flight, status: 'cancelled' }, { ...flight, trip_id: 'future' }] as ItineraryItem[]
  expect(travelHistory(trips, items, [], { past: 'me', future: 'me' }, Date.parse('2027-04-01T00:00:00Z'))).toEqual({ trips: 1, countries: ['GT'], nights: 3, flights: 1, flightMinutes: 120, distanceKm: 0 })
  expect(travelHistory(trips, items, [], { past: null }, Date.parse('2027-04-01T00:00:00Z')).trips).toBe(0)
})
