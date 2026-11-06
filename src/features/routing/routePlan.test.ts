import { expect, it } from 'vitest'
import type { Place } from '@/data/types'
import { routeItems, routePreview } from './routePlan'
import type { LegContext } from './legs'
const places = ['a','b','c'].map((id) => ({ id, trip_id: '00000000-0000-4000-8000-000000000201', name: id, lat: null, lng: null })) as Place[]
const ctx = { legs: [], areaRoutes: [], factorLow: 1.4, factorHigh: 2, overrides: [
  { place_a_id: 'a', place_b_id: 'b', mode: 'boat', min_s: 1200, max_s: 1800 },
  { place_a_id: 'b', place_b_id: 'c', mode: 'walk', min_s: 300, max_s: 600 },
] } as unknown as LegContext
it('schedules each leg from the prior arrival plus time at the stop across midnight', () => {
  const preview = routePreview([{ placeId: 'a', mode: 'walk', stayMinutes: 0 }, { placeId: 'b', mode: 'boat', stayMinutes: 45 }, { placeId: 'c', mode: 'walk', stayMinutes: 0 }], places, ctx, '2027-03-15T23:30', 'America/Guatemala')
  expect(preview.map((s) => [s.departure, s.arrival])).toEqual([
    ['2027-03-16T05:30:00.000Z', '2027-03-16T06:00:00.000Z'],
    ['2027-03-16T06:45:00.000Z', '2027-03-16T06:55:00.000Z'],
  ])
  const items = routeItems(places[0]!.trip_id, 'route-id', preview, 'America/Guatemala')
  expect(items[1]?.start_local).toBe('2027-03-16T00:45')
  expect(items.every((i) => i.status === 'tentative' && i.attendee_ids === null)).toBe(true)
  expect(routeItems(places[0]!.trip_id, 'route-id', preview, 'America/Guatemala').map((i) => i.id)).toEqual(items.map((i) => i.id))
})
it('refuses to invent a missing route or bridge places from another trip', () => {
  const stops = [{ placeId: 'a', mode: 'drive' as const, stayMinutes: 0 }, { placeId: 'b', mode: 'drive' as const, stayMinutes: 0 }]
  expect(() => routePreview(stops, places, ctx, '2027-03-15T09:00', 'UTC')).toThrow(/No drive estimate/)
  expect(() => routePreview(stops, places.map((p) => p.id === 'b' ? { ...p, trip_id: 'other' } : p), ctx, '2027-03-15T09:00', 'UTC')).toThrow(/available places/)
})
