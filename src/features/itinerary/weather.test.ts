import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TripDb } from '@/data/db'
import type { ItineraryItem, Place, Trip } from '@/data/types'
import { toInstant } from '@/lib/time'
import { dayLocations, refreshWeather, weatherFor } from './weather'

const GT = 'America/Guatemala'
const antigua = { lat: 14.5586, lng: -90.7295 }
const lake = { lat: 14.7405, lng: -91.159 }

function item(id: string, start: string, end: string | null, over: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    id, trip_id: 't', title: id, kind: 'activity', place_id: null, to_place_id: null, all_day: false,
    start_local: start, start_tz: GT, end_local: end, end_tz: end ? GT : null,
    start_at: toInstant(start, GT), end_at: end ? toInstant(end, GT) : null,
    status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null,
    est_cost_minor: null, est_cost_currency: null, ...over,
  }
}
const place = (id: string, at: { lat: number; lng: number } | null): Place => ({
  id, trip_id: 't', name: id, category: 'lodging', tags: [], lat: at?.lat ?? null, lng: at?.lng ?? null, address: null, area: null,
  status: 'booked', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual',
})
const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't', name: 'Trip', timezone: GT, start_date: '2026-10-05', end_date: '2026-10-08', base_currency: 'USD', local_currency: 'GTQ',
  route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'x',
  settings: { areas: [{ name: 'Antigua', bbox: [14.54, -90.75, 14.575, -90.715], ...antigua }] }, ...over,
})

describe('dayLocations', () => {
  const places = [place('hotel', antigua), place('casita', lake), place('kayak', lake), place('nowhere', null)]
  const items = [
    item('hotel', '2026-10-05T15:00', '2026-10-07T11:00', { kind: 'lodging', place_id: 'hotel' }),
    item('kayak', '2026-10-07T13:00', '2026-10-07T15:00', { place_id: 'kayak' }),
    item('mystery', '2026-10-08T09:00', '2026-10-08T10:00', { place_id: 'nowhere' }),
  ]
  const days = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']

  it('uses where you sleep, then the first located stop, then the day before', () => {
    const locs = dayLocations(days, items, places, trip(), GT)
    expect(locs['2026-10-05']).toEqual(antigua)
    expect(locs['2026-10-06']).toEqual(antigua)
    expect(locs['2026-10-07']).toEqual(lake) // checked out; the kayak trip is at the lake
    expect(locs['2026-10-08']).toEqual(lake) // carried forward
    expect(locs['2026-10-04']).toEqual(antigua) // before the first known place
  })

  it('falls back to the first destination area, or nothing', () => {
    expect(dayLocations(['2026-10-05'], [], [], trip(), GT)['2026-10-05']).toEqual(antigua)
    expect(dayLocations(['2026-10-05'], [], [], trip({ settings: {} }), GT)['2026-10-05']).toBeNull()
  })
})

describe('refreshWeather', () => {
  let db: TripDb
  beforeEach(() => { db = new TripDb(`weather-test-${crypto.randomUUID()}`) })
  afterEach(async () => { await db.delete() })

  const now = Date.parse('2026-10-02T12:00:00Z')
  const daily = (dates: string[], hi: number) => ({
    daily: {
      time: dates, weather_code: dates.map(() => 3), temperature_2m_max: dates.map(() => hi), temperature_2m_min: dates.map(() => 10),
      precipitation_sum: dates.map(() => 2), wind_speed_10m_max: dates.map(() => 8), sunrise: dates.map((d) => `${d}T05:55`), sunset: dates.map((d) => `${d}T17:50`),
    },
  })
  function between(start: string, end: string) {
    const out: string[] = []
    for (let t = Date.parse(start); t <= Date.parse(end); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10))
    return out
  }
  function fakeFetch(calls: string[]): typeof fetch {
    return (async (input: string | URL | Request) => {
      const url = String(input)
      calls.push(url)
      const q = new URL(url).searchParams
      const body = url.includes('archive')
        ? daily(between(q.get('start_date')!, q.get('end_date')!), Number(q.get('start_date')!.slice(2, 4)))
        : daily(between('2026-10-02', '2026-10-17'), 27)
      return new Response(JSON.stringify(body))
    }) as typeof fetch
  }

  it('fetches a forecast for near days and typical weather for far ones, then stays quiet while fresh', async () => {
    const t = trip({ start_date: '2026-10-05', end_date: '2026-10-20' })
    const calls: string[] = []
    expect(await refreshWeather(t, { database: db, fetchFn: fakeFetch(calls), now })).toBe(4) // forecast + 3 archive years
    const rows = await db.weather.toArray()
    expect(weatherFor(rows, '2026-10-05', antigua)).toMatchObject({ kind: 'forecast', weather: { hi: 27 } })
    // 18–20 Oct are beyond the 16-day forecast (2–17 Oct): averaged from 2025, 2024, 2023.
    expect(weatherFor(rows, '2026-10-19', antigua)).toMatchObject({ kind: 'typical', weather: { hi: 24, rainPct: 100 } })
    expect(weatherFor(rows, '2026-10-19', lake)).toBeNull()
    expect(await refreshWeather(t, { database: db, fetchFn: fakeFetch(calls), now: now + 3600_000 })).toBe(0)
    expect(await refreshWeather(t, { database: db, fetchFn: fakeFetch(calls), now: now + 4 * 3600_000 })).toBe(1)
  })

  it('does nothing for a trip with no place to look up', async () => {
    const calls: string[] = []
    expect(await refreshWeather(trip({ settings: {} }), { database: db, fetchFn: fakeFetch(calls), now })).toBe(0)
    expect(calls).toEqual([])
  })
})
