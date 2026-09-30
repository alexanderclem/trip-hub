import { describe, expect, it } from 'vitest'
import type { LegOverride, Place, RouteLeg } from '@/data/types'
import { formatRange, isStale, travelOptions, type LegContext } from './legs'

const place = (id: string, lat: number, lng: number, area: string): Place => ({
  id, trip_id: 't', name: id, category: 'other', tags: [], lat, lng, address: null, area,
  status: 'shortlist', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual',
})
const hotel = place('hotel', 14.5581, -90.7352, 'Antigua')
const cafe = place('cafe', 14.557255, -90.73164, 'Antigua')
const pana = place('pana', 14.7404, -91.159, 'Panajachel')
const sanPedro = place('sp', 14.6933, -91.2718, 'San Pedro La Laguna')

const leg = (from: Place, to: Place, mode: 'drive' | 'walk', duration_s: number, distance_m: number): RouteLeg => ({
  id: `${from.id}-${to.id}-${mode}`, trip_id: 't', from_place_id: from.id, to_place_id: to.id, mode, duration_s, distance_m,
  source: 'ors', from_lat: from.lat, from_lng: from.lng, to_lat: to.lat, to_lng: to.lng, computed_at: '2027-01-01',
})

const ctx = (over: Partial<LegContext> = {}): LegContext => ({
  legs: [], overrides: [], areaRoutes: [], factorLow: 1.4, factorHigh: 2.0, ...over,
})

describe('travelOptions', () => {
  it('widens routed drive times by the trip correction range', () => {
    const opts = travelOptions(hotel, pana, ctx({ legs: [leg(hotel, pana, 'drive', 80 * 60, 77_000)] }))
    const drive = opts.find((o) => o.mode === 'drive')!
    expect(drive.source).toBe('routed')
    expect(formatRange(drive.minS, drive.maxS)).toBe('1 h 50 – 2 h 40') // 80 min × 1.4–2.0
  })

  it('uses the reverse-direction leg when only that one exists', () => {
    const opts = travelOptions(pana, hotel, ctx({ legs: [leg(hotel, pana, 'drive', 80 * 60, 77_000)] }))
    expect(opts.find((o) => o.mode === 'drive')?.source).toBe('routed')
  })

  it('for a short walk, shows walking and leaves out driving', () => {
    const opts = travelOptions(hotel, cafe, ctx({ legs: [leg(hotel, cafe, 'walk', 7 * 60, 500), leg(hotel, cafe, 'drive', 3 * 60, 900)] }))
    expect(opts).toHaveLength(1)
    expect(opts[0]).toMatchObject({ mode: 'walk', source: 'routed' })
    expect(formatRange(opts[0]!.minS, opts[0]!.maxS)).toBe('7–8 min')
  })

  it('keeps short ranges tight (whole minutes under 20 min)', () => {
    const opts = travelOptions(hotel, cafe, ctx({ legs: [leg(hotel, cafe, 'walk', 9 * 60, 670)] }))
    expect(formatRange(opts[0]!.minS, opts[0]!.maxS)).toBe('9–11 min')
  })

  it('for a long walk, shows both', () => {
    const far = place('far', 14.53, -90.76, 'Antigua')
    const opts = travelOptions(hotel, far, ctx({ legs: [leg(hotel, far, 'walk', 50 * 60, 4000), leg(hotel, far, 'drive', 10 * 60, 5000)] }))
    expect(opts.map((o) => o.mode)).toEqual(['drive', 'walk'])
  })

  it('adds typical lancha/shuttle routes between towns, in either direction', () => {
    const areaRoutes = [{ a: 'San Pedro La Laguna', b: 'Panajachel', mode: 'boat' as const, min_min: 25, max_min: 45, note: 'Public lancha' }]
    const opts = travelOptions(pana, sanPedro, ctx({ areaRoutes }))
    const boat = opts.find((o) => o.mode === 'boat')!
    expect(boat).toMatchObject({ source: 'typical', minS: 1500, maxS: 2700, note: 'Public lancha' })
    expect(opts[0]!.mode).toBe('boat') // fastest first; the road goes all the way round the lake
  })

  it('a time reported by the group beats everything else for that mode', () => {
    const override: LegOverride = { id: 'o', trip_id: 't', place_a_id: 'hotel', place_b_id: 'pana', mode: 'drive', min_s: 2.5 * 3600, max_s: 3 * 3600, note: 'Took the shuttle' }
    const opts = travelOptions(pana, hotel, ctx({ legs: [leg(hotel, pana, 'drive', 4800, 77_000)], overrides: [override] }))
    const drives = opts.filter((o) => o.mode === 'drive')
    expect(drives).toHaveLength(1)
    expect(drives[0]).toMatchObject({ source: 'reported', note: 'Took the shuttle' })
    expect(formatRange(drives[0]!.minS, drives[0]!.maxS)).toBe('2 h 30 – 3 h')
  })

  it('ignores legs computed before a pin moved, and falls back to an estimate', () => {
    const moved = { ...pana, lat: 14.75 }
    const l = leg(hotel, pana, 'drive', 4800, 77_000)
    expect(isStale(l, hotel, moved)).toBe(true)
    const opts = travelOptions(hotel, moved, ctx({ legs: [l] }))
    expect(opts.find((o) => o.mode === 'drive')?.source).toBe('estimate')
  })

  it('estimates from straight-line distance when nothing is computed (e.g. offline)', () => {
    const opts = travelOptions(hotel, cafe, ctx())
    expect(opts.map((o) => `${o.mode}:${o.source}`)).toEqual(['walk:estimate'])
    const far = travelOptions(hotel, pana, ctx())
    expect(far.map((o) => o.mode)).toEqual(['drive'])
  })

  it('returns nothing for the same place', () => {
    expect(travelOptions(hotel, hotel, ctx())).toEqual([])
  })
})

describe('formatRange', () => {
  it.each([
    [7 * 60, 7 * 60, '7 min'],
    [25 * 60, 40 * 60, '25–40 min'],
    [3 * 3600, 4 * 3600, '3–4 h'],
    [110 * 60, 160 * 60, '1 h 50 – 2 h 40'],
    [45 * 60, 75 * 60, '45 min – 1 h 15'],
  ])('%i–%i s → %s', (lo, hi, text) => {
    expect(formatRange(lo, hi)).toBe(text)
  })
})
