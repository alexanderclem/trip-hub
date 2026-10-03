// Weather for each plan day. Kept only on this phone (not synced): each phone fetches its own copy
// from Open-Meteo when it has signal, and the "Ready for offline" download fills it before a trip.

import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DateTime } from 'luxon'
import { db, type TripDb } from '@/data/db'
import type { ItineraryItem, Place, Trip } from '@/data/types'
import { tripAreas } from '@/features/destinations/destinations'
import {
  archiveUrl, FORECAST_DAYS, forecastUrl, locKey, parseDaily, pastYearsFor, typicalDays,
  type DailyWeather, type LatLng, type WeatherDays,
} from '@/lib/weather'
import { layoutDay, planDays } from './layout'

export interface WeatherRow {
  id: string // `${tripId}:${kind}:${locKey}`
  trip_id: string
  kind: 'forecast' | 'typical'
  loc: string
  days: WeatherDays
  fetched_at: string
}

export interface DayWeather {
  weather: DailyWeather
  kind: 'forecast' | 'typical'
  fetched_at: string
}

const FORECAST_MAX_AGE_MS = 3 * 3600_000
const TYPICAL_MAX_AGE_MS = 30 * 24 * 3600_000
const RETRY_MS = 10 * 60_000

const rowId = (tripId: string, kind: WeatherRow['kind'], loc: string) => `${tripId}:${kind}:${loc}`
const located = (p: Place | undefined): LatLng | null => (p && p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null)

/**
 * Where each day happens: where you're staying that night, else the first stop with a location,
 * else the day before's place. Days before the first known place use the first one found, then the
 * trip's first destination area.
 */
export function dayLocations(days: string[], items: ItineraryItem[], places: Place[], trip: Pick<Trip, 'settings'>, zone: string): Record<string, LatLng | null> {
  const byId = new Map(places.map((p) => [p.id, p]))
  const out: Record<string, LatLng | null> = {}
  let prev: LatLng | null = null
  for (const day of days) {
    const l = layoutDay(items, day, zone)
    const stay = l.stays.map((s) => located(byId.get(s.place_id ?? ''))).find(Boolean)
    const stop = l.blocks.map((b) => located(byId.get(b.item.place_id ?? ''))).find(Boolean)
    out[day] = stay ?? stop ?? prev
    prev = out[day] ?? null
  }
  const area = tripAreas(trip)[0]
  const first = days.map((d) => out[d]).find(Boolean) ?? (area ? { lat: area.lat, lng: area.lng } : null)
  for (const day of days) out[day] ??= first
  return out
}

export function useWeather(tripId: string) {
  return useLiveQuery(() => db.weather.where('trip_id').equals(tripId).toArray(), [tripId])
}

/** The forecast for that day if there is one, else typical weather for the date. */
export function weatherFor(rows: WeatherRow[] | undefined, day: string, loc: LatLng | null | undefined): DayWeather | null {
  if (!rows || !loc) return null
  const key = locKey(loc)
  for (const kind of ['forecast', 'typical'] as const) {
    const row = rows.find((r) => r.kind === kind && r.loc === key)
    const weather = row?.days[day]
    if (row && weather) return { weather, kind, fetched_at: row.fetched_at }
  }
  return null
}

async function getJson(url: string, fetchFn: typeof fetch) {
  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`Weather unavailable (HTTP ${res.status})`)
  return res.json() as Promise<unknown>
}

/**
 * Fetches whatever is missing or stale for the trip's days: a forecast for the next 16 days, and
 * typical weather for days further out. Past days are left as they are. Returns how many requests ran.
 */
export async function refreshWeather(trip: Trip, opts: { database?: TripDb; fetchFn?: typeof fetch; now?: number; force?: boolean } = {}): Promise<number> {
  const { database = db, fetchFn = fetch, now = Date.now(), force = false } = opts
  const zone = trip.timezone
  const [items, places, rows] = await Promise.all([
    database.itinerary_items.where('trip_id').equals(trip.id).filter((i) => !i.deleted_at).toArray(),
    database.places.where('trip_id').equals(trip.id).filter((p) => !p.deleted_at).toArray(),
    database.weather.where('trip_id').equals(trip.id).toArray(),
  ])
  const days = planDays(trip.start_date, trip.end_date, items, zone)
  const locs = dayLocations(days, items, places, trip, zone)
  const today = DateTime.fromMillis(now, { zone }).toISODate()!
  const lastForecast = DateTime.fromISO(today).plus({ days: FORECAST_DAYS - 1 }).toISODate()!

  // Dates needed per location, split by kind.
  const need = { forecast: new Map<string, string[]>(), typical: new Map<string, string[]>() }
  const where = new Map<string, LatLng>()
  for (const day of days) {
    const loc = locs[day]
    if (!loc || day < today) continue
    const key = locKey(loc)
    if (!where.has(key)) where.set(key, loc)
    const m = day <= lastForecast ? need.forecast : need.typical
    m.set(key, [...(m.get(key) ?? []), day])
  }
  const stale = (kind: WeatherRow['kind'], key: string, dates: string[]) => {
    if (force) return true
    const row = rows.find((r) => r.id === rowId(trip.id, kind, key))
    const maxAge = kind === 'forecast' ? FORECAST_MAX_AGE_MS : TYPICAL_MAX_AGE_MS
    return !row || now - Date.parse(row.fetched_at) > maxAge || dates.some((d) => !row.days[d])
  }
  const fetchedAt = new Date(now).toISOString()
  const write = async (kind: WeatherRow['kind'], key: string, days: WeatherDays) => {
    const id = rowId(trip.id, kind, key)
    const old = await database.weather.get(id)
    await database.weather.put({ id, trip_id: trip.id, kind, loc: key, days: { ...old?.days, ...days }, fetched_at: fetchedAt })
  }
  let requests = 0

  const forecastKeys = [...need.forecast].filter(([k, d]) => stale('forecast', k, d)).map(([k]) => k)
  if (forecastKeys.length) {
    requests++
    const parsed = parseDaily(await getJson(forecastUrl(forecastKeys.map((k) => where.get(k)!), zone), fetchFn))
    for (const [i, key] of forecastKeys.entries()) await write('forecast', key, parsed[i] ?? {})
  }

  const typical = [...need.typical].filter(([k, d]) => stale('typical', k, d))
  if (typical.length) {
    const dates = [...new Set(typical.flatMap(([, d]) => d))].sort()
    const years = pastYearsFor(dates, today)
    const past: { years: number; days: WeatherDays[] }[] = []
    for (const y of years) {
      requests++
      const start = DateTime.fromISO(dates[0]!).minus({ years: y }).toISODate()!
      const end = DateTime.fromISO(dates.at(-1)!).minus({ years: y }).toISODate()!
      past.push({ years: y, days: parseDaily(await getJson(archiveUrl(typical.map(([k]) => where.get(k)!), start, end, zone), fetchFn)) })
    }
    for (const [i, [key, d]] of typical.entries()) {
      await write('typical', key, typicalDays(d, past.map((p) => ({ years: p.years, days: p.days[i] ?? {} }))))
    }
  }
  return requests
}

const lastAttempt = new Map<string, number>()
const running = new Map<string, Promise<unknown>>()

/** Keeps the weather fresh while the Plan tab is open and there's signal. */
export function useWeatherRefresh(trip: Trip | undefined, signature: string) {
  useEffect(() => {
    if (!trip || !navigator.onLine) return
    const key = `${trip.id}|${signature}`
    if (Date.now() - (lastAttempt.get(key) ?? 0) < RETRY_MS) return
    lastAttempt.set(key, Date.now())
    // One refresh per trip at a time: a later one waits, then finds the data fresh.
    const next = (running.get(trip.id) ?? Promise.resolve())
      .then(() => refreshWeather(trip))
      .catch((e) => console.warn('weather refresh failed', e))
    running.set(trip.id, next)
  }, [trip, signature])
}
