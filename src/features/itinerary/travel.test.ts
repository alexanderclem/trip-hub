import { describe, expect, it } from 'vitest'
import type { ItineraryItem, Place } from '@/data/types'
import type { LegContext } from '@/features/routing/legs'
import { needsTravelBuffer, nextItem, planTransfers } from './travel'

const zone = 'America/Guatemala'
const item = (id: string, start: string, end: string | null, place: string | null, extra: Partial<ItineraryItem> = {}): ItineraryItem => ({
  id, trip_id: 'trip', title: id, kind: 'activity', place_id: place, to_place_id: null,
  all_day: false, start_local: `2027-03-15T${start}`, start_tz: zone,
  end_local: end ? `2027-03-15T${end}` : null, end_tz: zone,
  start_at: `2027-03-15T${start}:00-06:00`, end_at: end ? `2027-03-15T${end}:00-06:00` : null,
  status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null,
  est_cost_minor: null, est_cost_currency: null, ...extra,
})
const places: Place[] = ['a', 'b', 'c'].map((id) => ({
  id, trip_id: 'trip', name: id, category: 'activity', tags: [], lat: null, lng: null,
  address: null, area: null, status: 'planned', notes: null, phone: null, website: null,
  opening_hours: null, external_ids: {}, source: 'manual',
}))
const ctx: LegContext = {
  legs: [], areaRoutes: [], factorLow: 1.4, factorHigh: 2,
  overrides: [{ id: 'route', trip_id: 'trip', place_a_id: 'a', place_b_id: 'b', mode: 'shuttle', min_s: 1200, max_s: 1800, note: null }],
}
const before = item('coffee', '09:00', '10:00', 'a')
const after = item('tour', '10:15', '11:15', 'b')

describe('travel buffers', () => {
  it('flags a short gap, deduplicates shared routes, and computes departure from the upper estimate', () => {
    const transfers = planTransfers([after, before], places, ctx, zone, ['alex', 'sam'])
    expect(transfers).toHaveLength(1)
    expect(transfers[0]?.memberIds).toEqual(['alex', 'sam'])
    expect(transfers[0]?.gapS).toBe(900)
    expect(transfers[0]?.leaveAt).toBe(Date.parse('2027-03-15T09:45:00-06:00'))
    expect(transfers.filter(needsTravelBuffer)).toHaveLength(1)
  })
  it('does not duplicate overlap warnings or assume a missing end time', () => {
    for (const end of ['10:30', null]) {
      const transfers = planTransfers([{ ...before, end_at: end ? `2027-03-15T${end}:00-06:00` : null }, after], places, ctx, zone, ['alex'])
      expect(transfers).toHaveLength(1)
      expect(transfers.filter(needsTravelBuffer)).toHaveLength(0)
    }
  })
  it('does not warn when the full upper estimate fits', () => {
    expect(planTransfers([before, item('later', '10:30', '11:30', 'b')], places, ctx, zone, ['alex']).filter(needsTravelBuffer)).toHaveLength(0)
  })
  it('follows personal itineraries through subgroup activities', () => {
    const split = item('sam-only', '10:05', '10:10', 'c', { attendee_ids: ['sam'] })
    const transfers = planTransfers([before, split, after], places, ctx, zone, ['alex', 'sam'])
    expect(transfers).toHaveLength(1)
    expect(transfers[0]?.memberIds).toEqual(['alex'])
    expect(planTransfers([{ ...before, attendee_ids: ['alex'] }, { ...after, attendee_ids: ['sam'] }], places, ctx, zone, ['alex', 'sam'])).toHaveLength(0)
  })
  it('uses a transport arrival location and actual timezone offsets', () => {
    const flight = { ...before, kind: 'flight' as const, place_id: 'c', to_place_id: 'a', end_at: '2027-03-15T12:00:00-04:00' }
    expect(planTransfers([flight, after], places, ctx, zone, ['alex'])[0]?.gapS).toBe(900)
  })
  it('does not bridge unknown locations, days, empty attendees, or removed places', () => {
    expect(planTransfers([before, item('unknown', '10:01', '10:05', null), after], places, ctx, zone, ['alex'])).toHaveLength(0)
    expect(planTransfers([before, { ...after, start_at: '2027-03-16T10:15:00-06:00' }], places, ctx, zone, ['alex'])).toHaveLength(0)
    expect(planTransfers([{ ...before, attendee_ids: [] }, after], places, ctx, zone, ['alex'])).toHaveLength(0)
    expect(planTransfers([before, after], places.map((p) => ({ ...p, deleted_at: 'removed' })), ctx, zone, ['alex'])).toHaveLength(0)
  })
  it('ignores all-day, cancelled, lodging, and deleted plans', () => {
    const excluded = [item('stay', '09:30', '10:05', 'c', { kind: 'lodging' }), item('cancelled', '09:40', '10:10', 'c', { status: 'cancelled' }), item('all-day', '09:50', null, 'c', { all_day: true }), item('deleted', '10:01', null, 'c', { deleted_at: 'removed' })]
    expect(planTransfers([before, ...excluded, after], places, ctx, zone, ['alex'])).toHaveLength(1)
  })
  it('prefers reported route evidence over a fast straight-line guess', () => {
    const located = places.map((p, i) => ({ ...p, lat: 14.5, lng: -90.5 + i * 0.001 }))
    const transfer = planTransfers([before, after], located, ctx, zone, ['alex'])[0]!
    expect(transfer.option.source).toBe('reported')
    const estimate = planTransfers([before, after], located, { ...ctx, overrides: [] }, zone, ['alex'])[0]!
    expect(estimate.option.source).toBe('estimate')
  })
})

describe('up next', () => {
  it('selects only upcoming plans for this person', () => {
    const now = Date.parse('2027-03-15T10:00:00-06:00')
    const other = item('other', '10:01', '10:10', 'a', { attendee_ids: ['sam'] })
    expect(nextItem([after, other, before], 'alex', now)?.id).toBe('tour')
    expect(nextItem([after, other, before], 'sam', now)?.id).toBe('other')
    expect(nextItem([before], 'alex', now)).toBeUndefined()
    expect(nextItem([{ ...after, attendee_ids: [] }], 'alex', now)).toBeUndefined()
  })
})
