import { describe, expect, it } from 'vitest'
import type { ExpenseRow, ItineraryItem, Member, Place, PlaceRating, Poll, PollOption, PollVote, RouteLeg, Trip } from '@/data/types'
import { toInstant } from '@/lib/time'
import { computeWrapped, isRecapTime, type WrappedData } from './stats'

const GT = 'America/Guatemala'
const trip: Trip = {
  id: 't', name: 'Guatemala SB 27', timezone: GT, start_date: '2027-03-13', end_date: '2027-03-20', base_currency: 'USD', local_currency: 'GTQ',
  route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'x', settings: {},
}
const member = (id: string): Member => ({ id, trip_id: 't', display_name: id, color: null, avatar_emoji: null, home_timezone: null })
const place = (id: string, lat: number, lng: number, over: Partial<Place> = {}): Place => ({
  id, trip_id: 't', name: id, category: 'food', tags: [], lat, lng, address: null, area: null, status: 'planned', notes: null, phone: null, website: null,
  opening_hours: null, external_ids: {}, source: 'osm', ...over,
})
const item = (id: string, start: string, placeId: string | null, over: Partial<ItineraryItem> = {}): ItineraryItem => ({
  id, trip_id: 't', title: id, kind: 'activity', place_id: placeId, to_place_id: null, all_day: false, start_local: start, start_tz: GT,
  end_local: null, end_tz: null, start_at: toInstant(start, GT), end_at: null, status: 'confirmed', confirmation_code: null, attendee_ids: null,
  details: {}, notes: null, est_cost_minor: null, est_cost_currency: null, ...over,
})
const rating = (placeId: string, memberId: string, stars: number | null): PlaceRating => ({ id: `${placeId}${memberId}`, trip_id: 't', place_id: placeId, member_id: memberId, stars, note: null })
const expense = (id: string, amount: number, payer: string, category: ExpenseRow['category'], created_by: string): ExpenseRow => ({
  id, trip_id: 't', description: id, category, spent_on: '2027-03-14', amount_minor: amount, currency: 'USD', fx_rate: 1, fx_source: 'same', fx_as_of: null,
  base_currency: 'USD', base_amount_minor: amount, payers: [{ member_id: payer, amount_minor: amount }], split_method: 'equal',
  split: [{ member_id: 'ana', value: 0 }, { member_id: 'ben', value: 0 }], place_id: null, item_id: null, notes: null, created_by,
} as ExpenseRow)

function data(over: Partial<WrappedData> = {}): WrappedData {
  return {
    trip, members: [member('ana'), member('ben')], items: [], places: [], legs: [], ratings: [], polls: [], options: [], votes: [], expenses: [],
    tasks: [], packing: [], attachments: [], preferences: [], ...over,
  }
}

describe('computeWrapped', () => {
  it('handles an empty trip', () => {
    const w = computeWrapped(data(), 'ana')
    expect(w).toMatchObject({ days: 8, people: 2, km: 0, totalMinor: 0, favourite: null, closest: null, banker: null, awards: [], groupTaste: null })
    expect(w.you).toMatchObject({ shareMinor: 0, favourite: null })
  })

  it('adds up the distance between stops, preferring routed legs', () => {
    const places = [place('a', 14.556, -90.733), place('b', 14.556, -90.733 + 0.0928), place('c', 14.74, -91.16)] // a→b ≈ 10 km
    const legs: RouteLeg[] = [{ id: 'l', trip_id: 't', from_place_id: 'b', to_place_id: 'c', mode: 'drive', distance_m: 80_000, duration_s: 7200, source: 'osrm', from_lat: null, from_lng: null, to_lat: null, to_lng: null } as RouteLeg]
    const items = [item('1', '2027-03-14T09:00', 'a'), item('2', '2027-03-14T12:00', 'b'), item('3', '2027-03-15T09:00', 'c'), item('x', '2027-03-15T10:00', 'c', { status: 'cancelled' })]
    expect(computeWrapped(data({ places, legs, items }), 'ana')).toMatchObject({ km: 90, stops: 3, placesVisited: 3, topCategory: { category: 'food', count: 3 } })
  })

  it('finds the favourite and the most divisive place', () => {
    const places = [place('loved', 0, 0), place('split', 0, 0), place('once', 0, 0)]
    const ratings = [rating('loved', 'ana', 5), rating('loved', 'ben', 5), rating('split', 'ana', 5), rating('split', 'ben', 1), rating('once', 'ana', 5), rating('loved', 'cy', null)]
    const w = computeWrapped(data({ places, ratings }), 'ana')
    expect(w.favourite).toMatchObject({ place: { id: 'loved' }, average: 5, count: 2 })
    expect(w.divisive).toMatchObject({ place: { id: 'split' }, spread: 4 })
  })

  it('finds the closest vote', () => {
    const polls: Poll[] = [{ id: 'p', trip_id: 't', title: 'Volcano day', description: null, status: 'closed', winner_option_id: null }]
    const options: PollOption[] = ['Pacaya', 'Acatenango'].map((label) => ({ id: label, trip_id: 't', poll_id: 'p', label, place_id: null, url: null, description: null }))
    const votes: PollVote[] = [['Pacaya', 'ana', 3], ['Pacaya', 'ben', 2], ['Acatenango', 'ana', 2], ['Acatenango', 'ben', 2]].map(([o, m, s]) => ({ id: `${o}${m}`, trip_id: 't', poll_id: 'p', option_id: o as string, member_id: m as string, score: s as 0 | 1 | 2 | 3 }))
    expect(computeWrapped(data({ polls, options, votes }), 'ana')).toMatchObject({ pollsHeld: 1, votesCast: 4, closest: { winner: 'Pacaya', runnerUp: 'Acatenango', gap: 0.5 } })
  })

  it('totals the money, names the banker and gives awards', () => {
    const expenses = [expense('dinner', 9000, 'ana', 'food', 'ana'), expense('shuttle', 3000, 'ben', 'transport', 'ana'), expense('gone', 99_999, 'ben', 'food', 'ben')]
    expenses[2]!.deleted_at = '2027-03-15T00:00:00Z'
    const w = computeWrapped(data({ expenses }), 'ben')
    expect(w).toMatchObject({ totalMinor: 12000, biggest: { id: 'dinner' }, topSpend: { category: 'food', minor: 9000 }, dailyMinor: 1500, banker: { memberId: 'ana', paidMinor: 9000 } })
    expect(w.you?.shareMinor).toBe(6000)
    expect(w.awards).toEqual([{ title: 'The Treasurer', why: 'expenses logged', memberId: 'ana', count: 2 }])
  })
})

describe('isRecapTime', () => {
  it('opens on the last day in the trip’s time zone', () => {
    expect(isRecapTime(trip, Date.parse('2027-03-20T05:00:00Z'))).toBe(false) // still 19 March in Guatemala
    expect(isRecapTime(trip, Date.parse('2027-03-20T07:00:00Z'))).toBe(true)
    expect(isRecapTime({ ...trip, end_date: null }, Date.now())).toBe(false)
  })
})
