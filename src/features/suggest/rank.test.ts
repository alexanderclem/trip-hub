import { describe, expect, it } from 'vitest'
import type { ItineraryItem, Place } from '@/data/types'
import { NEUTRAL, type Scores } from '@/features/discovery/model'
import { layoutDay } from '@/features/itinerary/layout'
import { toInstant } from '@/lib/time'
import { freeSlots, suggestForDay, type SuggestInput } from './rank'

const GT = 'America/Guatemala'
const DAY = '2027-03-15'
const HOME = { lat: 14.5586, lng: -90.7295 } // Antigua

function item(id: string, start: string, end: string, kind: ItineraryItem['kind'] = 'activity'): ItineraryItem {
  return {
    id, trip_id: 't', title: id, kind, place_id: null, to_place_id: null, all_day: false,
    start_local: `${DAY}T${start}`, start_tz: GT, end_local: `${DAY}T${end}`, end_tz: GT,
    start_at: toInstant(`${DAY}T${start}`, GT), end_at: toInstant(`${DAY}T${end}`, GT),
    status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null,
  }
}
/** A place `north` metres north of home. */
function place(id: string, category: Place['category'], north: number | null, over: Partial<Place> = {}): Place {
  return {
    id, trip_id: 't', name: id, category, tags: [], lat: north === null ? null : HOME.lat + north / 111_320, lng: north === null ? null : HOME.lng,
    address: null, area: 'Antigua', status: 'catalog', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'osm', ...over,
  }
}
const day = (...items: ItineraryItem[]) => layoutDay(items, DAY, GT)
const input = (over: Partial<SuggestInput>): SuggestInput => ({
  day: DAY, places: [], layout: day(), anchor: HOME, staying: true, group: null, ratings: new Map(), rainy: false, plannedPlaceIds: new Set(), ...over,
})
const group = (over: Partial<Scores>): Scores => ({ ...NEUTRAL, ...over })
const names = (list: { place: Place }[]) => list.map((s) => s.place.id)

describe('freeSlots', () => {
  it('offers every meal and the afternoon on an empty day, and the evening only to night owls', () => {
    expect(freeSlots(day())).toEqual(['breakfast', 'lunch', 'afternoon', 'dinner'])
    expect(freeSlots(day(), group({ nightlife: 80 }))).toEqual(['breakfast', 'lunch', 'afternoon', 'dinner', 'evening'])
  })

  it('leaves out a meal that is planned, or whose time something else fills', () => {
    expect(freeSlots(day(item('lunch', '12:30', '13:30', 'meal')))).toEqual(['breakfast', 'afternoon', 'dinner'])
    expect(freeSlots(day(item('hike', '06:00', '14:30')))).toEqual(['afternoon', 'dinner'])
  })

  it('needs two clear hours to call the afternoon free', () => {
    const packed = day(item('a', '09:00', '10:30'), item('b', '11:00', '12:45'), item('c', '13:30', '15:00'), item('d', '16:00', '18:00'))
    expect(freeSlots(packed)).not.toContain('afternoon')
    expect(freeSlots(day(item('a', '09:00', '13:00')))).toContain('afternoon')
  })
})

describe('suggestForDay', () => {
  it('prefers the nearer of two places that are otherwise alike', () => {
    const got = suggestForDay(input({ places: [place('far', 'food', 2500), place('near', 'food', 300)], layout: day(item('b', '08:00', '09:00', 'meal'), item('d', '19:00', '20:00', 'meal')) }))
    expect(got.filter((s) => s.slot === 'lunch').map((s) => s.place.id)).toEqual(['near', 'far'])
    expect(got[0]!.reasons[0]).toBe('About 5 min walk from where you’re staying')
    expect(got[0]!.startTime).toBe('12:30')
  })

  it('leans towards what the group likes', () => {
    const places = [place('museum', 'sight', 600, { tags: ['museum'] }), place('reserve', 'activity', 600, { tags: ['nature_reserve'] })]
    const afternoon = (scores: Partial<Scores>) => suggestForDay(input({ places, group: group(scores) })).filter((s) => s.slot === 'afternoon')
    expect(names(afternoon({ culture: 90, nature: 20, adventure: 20 }))).toEqual(['museum', 'reserve'])
    expect(names(afternoon({ culture: 20, nature: 90 }))).toEqual(['reserve', 'museum'])
    expect(afternoon({ culture: 90 })[0]!.reasons).toContain('Your group is big on culture')
  })

  it('never offers what is planned, turned down, removed or already picked for another meal', () => {
    const places = [
      place('planned', 'food', 100), place('nope', 'food', 100, { status: 'rejected' }), place('booked', 'food', 100, { status: 'booked' }),
      place('gone', 'food', 100, { deleted_at: '2027-01-01T00:00:00Z' }), place('one', 'food', 200), place('two', 'food', 300),
    ]
    const got = suggestForDay(input({ places, plannedPlaceIds: new Set(['planned']) }), 1)
    expect(names(got).sort()).toEqual(['one', 'two'])
    expect(new Set(names(got)).size).toBe(got.length)
  })

  it('puts a museum ahead of a park when rain is likely', () => {
    const places = [place('park', 'activity', 200, { tags: ['park'] }), place('museum', 'sight', 900, { tags: ['museum'] })]
    const afternoon = (rainy: boolean) => suggestForDay(input({ places, rainy })).filter((s) => s.slot === 'afternoon')
    expect(names(afternoon(false))).toEqual(['park', 'museum'])
    expect(names(afternoon(true))).toEqual(['museum', 'park'])
    expect(afternoon(true)[0]!.reasons).toContain('Indoors, and rain is likely')
  })

  it('counts a shortlisted or well-rated place for more', () => {
    const places = [place('plain', 'food', 300), place('listed', 'food', 300, { status: 'shortlist' }), place('loved', 'food', 300)]
    const got = suggestForDay(input({ places, ratings: new Map([['loved', 5], ['plain', 2]]) }), 3).filter((s) => s.slot === 'breakfast')
    expect(names(got)).toEqual(['loved', 'listed', 'plain'])
    expect(got[0]!.reasons).toContain('The group rated it 5.0 ★')
    expect(got[1]!.reasons).toContain('On your shortlist')
  })

  it('keeps far places back unless nothing is near, and skips places with no pin', () => {
    const far = place('far', 'food', 30_000)
    expect(names(suggestForDay(input({ places: [far, place('near', 'food', 500), place('unpinned', 'food', null)] }), 3))).toEqual(['near'])
    expect(names(suggestForDay(input({ places: [far] }), 1))).toEqual(['far'])
  })

  it('still suggests when it does not know where the day happens', () => {
    const got = suggestForDay(input({ places: [place('a', 'food', 500), place('unpinned', 'food', null)], anchor: null }), 2)
    expect(names(got).sort()).toEqual(['a', 'unpinned'])
    expect(got.every((s) => s.distanceM === null)).toBe(true)
  })

  it('gives the same answer every time, and starts an afternoon idea when the gap opens', () => {
    const places = Array.from({ length: 12 }, (_, i) => place(`p${i}`, i % 2 ? 'food' : 'sight', 400))
    const args = input({ places, layout: day(item('tour', '09:00', '13:00')) })
    expect(suggestForDay(args)).toEqual(suggestForDay(args))
    expect(suggestForDay(args).find((s) => s.slot === 'afternoon')!.startTime).toBe('13:00')
  })
})
