import { describe, expect, it } from 'vitest'
import type { JoinedTrip } from './device'
import { preResetTrips } from './reset'

const trip = (tripId: string, joinedAt: string): JoinedTrip => ({ tripId, memberId: null, joinedAt })

describe('preResetTrips', () => {
  it('picks out only the trips joined before the reset', () => {
    const trips = { a: trip('a', '2026-10-01T12:00:00.000Z'), b: trip('b', '2026-10-09T00:07:00.000Z'), c: trip('c', '2026-11-02T09:00:00.000Z'), d: trip('d', '') }
    expect(preResetTrips(trips, '2026-10-09T00:07:00.000Z')).toEqual(['a', 'd'])
    expect(preResetTrips({})).toEqual([])
  })
})
