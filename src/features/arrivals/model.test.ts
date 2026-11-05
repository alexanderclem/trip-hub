import { describe, expect, it } from 'vitest'
import type { ItineraryItem, Member } from '@/data/types'
import { boardRows, journeyTime, missingTravelers, rideMatches } from './model'
const journey = (id: string, extra: Partial<ItineraryItem> = {}): ItineraryItem => ({ id, trip_id: 'trip', title: id, kind: 'flight', status: 'tentative', details: { journey_direction: 'arrival', journey_location: 'GUA' }, start_at: '2027-03-13T08:00:00Z', end_at: '2027-03-13T14:00:00Z', attendee_ids: ['alex'], ...extra } as ItineraryItem)
const members = [{ id: 'alex' }, { id: 'sam' }] as Member[]
describe('arrivals board', () => {
  it('uses actual arrival instants and does not substitute departure for an unknown arrival', () => {
    expect(journeyTime(journey('a'))).toBe('2027-03-13T14:00:00Z')
    expect(journeyTime(journey('a', { end_at: null }))).toBeNull()
    expect(journeyTime(journey('a', { details: { journey_direction: 'departure' } }))).toBe('2027-03-13T08:00:00Z')
  })
  it('sorts by absolute time across offsets and excludes cancelled, deleted and local journeys', () => {
    const rows = [journey('later', { end_at: '2027-03-13T09:00:00-06:00' }), journey('earlier'), journey('unknown', { end_at: null }), journey('cancelled', { status: 'cancelled' }), journey('deleted', { deleted_at: 'now' }), journey('local', { details: {} })]
    expect(boardRows(rows, 'arrival').map((i) => i.id)).toEqual(['earlier', 'later', 'unknown'])
  })
  it('counts missing travelers separately for each direction and honors everyone attendance', () => {
    expect(missingTravelers([journey('a')], members, 'arrival').map((m) => m.id)).toEqual(['sam'])
    expect(missingTravelers([journey('a', { attendee_ids: null })], members, 'arrival')).toEqual([])
    expect(missingTravelers([journey('a')], members, 'departure')).toHaveLength(2)
  })
  it('suggests rides only at the same known location within 90 minutes for different travelers', () => {
    const mine = journey('a')
    const match = journey('b', { attendee_ids: ['sam'], end_at: '2027-03-13T15:30:00Z' })
    const other = journey('other', { attendee_ids: ['sam'], details: { journey_direction: 'arrival', journey_location: 'JFK' } })
    expect(rideMatches(mine, [mine, match, other, journey('same-person')], []).map((i) => i.id)).toEqual(['b'])
    expect(rideMatches(journey('no-location', { details: { journey_direction: 'arrival' } }), [match], [])).toEqual([])
    expect(rideMatches(mine, [{ ...match, end_at: '2027-03-14T15:30:00Z' }], [])).toEqual([])
  })
})
