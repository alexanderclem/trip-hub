// Daily weather from Open-Meteo (free, keyless, CC BY 4.0: attribution required).
// Forecasts reach 16 days ahead; further out we show "typical" weather: the same calendar dates
// in each of the previous three years, averaged. Temperatures are stored in °C, wind in km/h.

import { DateTime } from 'luxon'

export const FORECAST_DAYS = 16
export const TYPICAL_YEARS = 3
export const ATTRIBUTION_URL = 'https://open-meteo.com/'

export interface DailyWeather {
  code: number
  hi: number
  lo: number
  /** Chance of rain, 0–100. For typical weather: the share of past years with ≥1 mm that day. */
  rainPct: number | null
  rainMm: number | null
  windKmh: number | null
  /** Local wall-clock time, "06:12". */
  sunrise: string | null
  sunset: string | null
}

export type WeatherDays = Record<string, DailyWeather>

export interface LatLng {
  lat: number
  lng: number
}

/**
 * Stops within the same 0.1° cell (about 11 km) share one forecast. The request itself uses a real
 * stop in that cell: snapping to the grid can land on a mountainside 800 m higher than the town.
 */
export const locKey = (p: LatLng) => `${(Math.round(p.lat * 10) / 10).toFixed(1)},${(Math.round(p.lng * 10) / 10).toFixed(1)}`

const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunrise,sunset'

const r3 = (n: number) => Math.round(n * 1000) / 1000
function coords(locs: LatLng[]) {
  return `latitude=${locs.map((p) => r3(p.lat)).join(',')}&longitude=${locs.map((p) => r3(p.lng)).join(',')}`
}

export function forecastUrl(locs: LatLng[], zone: string): string {
  return `https://api.open-meteo.com/v1/forecast?${coords(locs)}&daily=${DAILY},precipitation_probability_max&timezone=${encodeURIComponent(zone)}&forecast_days=${FORECAST_DAYS}`
}

export function archiveUrl(locs: LatLng[], start: string, end: string, zone: string): string {
  return `https://archive-api.open-meteo.com/v1/archive?${coords(locs)}&daily=${DAILY}&timezone=${encodeURIComponent(zone)}&start_date=${start}&end_date=${end}`
}

interface DailyBlock {
  time?: string[]
  weather_code?: (number | null)[]
  temperature_2m_max?: (number | null)[]
  temperature_2m_min?: (number | null)[]
  precipitation_sum?: (number | null)[]
  precipitation_probability_max?: (number | null)[]
  wind_speed_10m_max?: (number | null)[]
  sunrise?: (string | null)[]
  sunset?: (string | null)[]
}

const clock = (s: string | null | undefined) => (s && s.length >= 16 ? s.slice(11, 16) : null)

/** One response, one location or many (Open-Meteo returns an array for several), into per-location days. */
export function parseDaily(json: unknown): WeatherDays[] {
  const list = (Array.isArray(json) ? json : [json]) as { daily?: DailyBlock }[]
  return list.map((loc) => {
    const d = loc?.daily
    const out: WeatherDays = {}
    d?.time?.forEach((date, i) => {
      const hi = d.temperature_2m_max?.[i]
      const lo = d.temperature_2m_min?.[i]
      const code = d.weather_code?.[i]
      if (hi == null || lo == null || code == null) return // no data for that day
      out[date] = {
        code,
        hi,
        lo,
        rainPct: d.precipitation_probability_max?.[i] ?? null,
        rainMm: d.precipitation_sum?.[i] ?? null,
        windKmh: d.wind_speed_10m_max?.[i] ?? null,
        sunrise: clock(d.sunrise?.[i]),
        sunset: clock(d.sunset?.[i]),
      }
    })
    return out
  })
}

/** The same calendar date `years` earlier (29 Feb falls back to 28 Feb). */
export const yearsBefore = (date: string, years: number) => DateTime.fromISO(date).minus({ years }).toISODate()!

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const round1 = (n: number) => Math.round(n * 10) / 10

function mode(xs: number[]): number {
  const counts = new Map<number, number>()
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0]
}

/**
 * Which past years to average for these dates: the most recent `TYPICAL_YEARS` whose matching
 * dates are all at least a week old (the archive lags a few days behind).
 */
export function pastYearsFor(dates: string[], today: string): number[] {
  const last = [...dates].sort().at(-1)
  if (!last) return []
  const cutoff = DateTime.fromISO(today).minus({ days: 7 }).toISODate()!
  const years: number[] = []
  for (let k = 1; years.length < TYPICAL_YEARS && k <= TYPICAL_YEARS + 3; k++) if (yearsBefore(last, k) <= cutoff) years.push(k)
  return years
}

/** Averages past years into "typical" weather for each target date. */
export function typicalDays(dates: string[], past: { years: number; days: WeatherDays }[]): WeatherDays {
  const out: WeatherDays = {}
  for (const date of dates) {
    const samples = past.map((p) => p.days[yearsBefore(date, p.years)]).filter((x): x is DailyWeather => !!x)
    if (!samples.length) continue
    const mm = samples.map((s) => s.rainMm ?? 0)
    const winds = samples.flatMap((s) => (s.windKmh == null ? [] : [s.windKmh]))
    out[date] = {
      code: mode(samples.map((s) => s.code)),
      hi: round1(mean(samples.map((s) => s.hi))),
      lo: round1(mean(samples.map((s) => s.lo))),
      rainPct: Math.round((100 * mm.filter((x) => x >= 1).length) / samples.length),
      rainMm: round1(mean(mm)),
      windKmh: winds.length ? round1(mean(winds)) : null,
      sunrise: samples[0]!.sunrise,
      sunset: samples[0]!.sunset,
    }
  }
  return out
}

export type WeatherIcon = 'sun' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'

/** WMO weather interpretation codes, as Open-Meteo documents them. */
export function describeCode(code: number): { label: string; icon: WeatherIcon } {
  if (code === 0) return { label: 'Clear', icon: 'sun' }
  if (code === 1) return { label: 'Mostly clear', icon: 'sun' }
  if (code === 2) return { label: 'Partly cloudy', icon: 'partly' }
  if (code === 3) return { label: 'Cloudy', icon: 'cloud' }
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'fog' }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'drizzle' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: code >= 80 ? 'Showers' : code >= 65 ? 'Heavy rain' : 'Rain', icon: 'rain' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Snow', icon: 'snow' }
  if (code >= 95) return { label: 'Thunderstorms', icon: 'storm' }
  return { label: 'Mixed', icon: 'cloud' }
}

export type TempUnit = 'C' | 'F'

/** °F where people use it (US, Liberia, Myanmar), otherwise °C. */
export const defaultTempUnit = (locale = typeof navigator === 'undefined' ? 'en-US' : navigator.language): TempUnit =>
  ['US', 'LR', 'MM'].includes(locale.split('-')[1]?.toUpperCase() ?? '') ? 'F' : 'C'

export const toUnit = (c: number, unit: TempUnit) => Math.round(unit === 'F' ? (c * 9) / 5 + 32 : c)
export const formatTemp = (c: number, unit: TempUnit) => `${toUnit(c, unit)}°`
export const formatWind = (kmh: number, unit: TempUnit) => (unit === 'F' ? `${Math.round(kmh / 1.609)} mph` : `${Math.round(kmh)} km/h`)
