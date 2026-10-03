import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { archiveUrl, defaultTempUnit, describeCode, forecastUrl, formatTemp, locKey, parseDaily, pastYearsFor, typicalDays, yearsBefore, type DailyWeather } from './weather'

const block = (dates: string[], over: Record<string, unknown[]> = {}) => ({
  daily: {
    time: dates,
    weather_code: dates.map(() => 2),
    temperature_2m_max: dates.map(() => 25),
    temperature_2m_min: dates.map(() => 12),
    precipitation_sum: dates.map(() => 0),
    precipitation_probability_max: dates.map(() => 10),
    wind_speed_10m_max: dates.map(() => 14),
    sunrise: dates.map((d) => `${d}T06:05`),
    sunset: dates.map((d) => `${d}T18:01`),
    ...over,
  },
})

const day = (over: Partial<DailyWeather> = {}): DailyWeather => ({ code: 0, hi: 20, lo: 10, rainPct: null, rainMm: 0, windKmh: 10, sunrise: '06:00', sunset: '18:00', ...over })

describe('Open-Meteo parsing', () => {
  it('reads one location or several, keeping local sunrise and sunset clock times', () => {
    const one = parseDaily(block(['2027-03-15']))
    expect(one).toEqual([{ '2027-03-15': { code: 2, hi: 25, lo: 12, rainPct: 10, rainMm: 0, windKmh: 14, sunrise: '06:05', sunset: '18:01' } }])
    expect(parseDaily([block(['2027-03-15']), block(['2027-03-16'])]).map((d) => Object.keys(d))).toEqual([['2027-03-15'], ['2027-03-16']])
  })

  it('skips days the model has no data for', () => {
    expect(parseDaily(block(['2027-03-15', '2027-03-16'], { temperature_2m_max: [25, null] }))).toEqual([{ '2027-03-15': expect.any(Object) }])
    expect(parseDaily({})).toEqual([{}])
  })

  it('builds one request for several rounded locations', () => {
    const url = forecastUrl([{ lat: 14.5586, lng: -90.7295 }, { lat: 14.7405, lng: -91.1590 }], 'America/Guatemala')
    expect(url).toContain('latitude=14.559,14.741&longitude=-90.729,-91.159')
    expect(url).toContain('timezone=America%2FGuatemala')
    expect(archiveUrl([{ lat: 1, lng: 2 }], '2026-03-13', '2026-03-21', 'UTC')).toContain('start_date=2026-03-13&end_date=2026-03-21')
    expect(locKey({ lat: 14.5586, lng: -90.7295 })).toBe('14.6,-90.7')
  })
})

describe('typical weather', () => {
  it('averages the same dates in past years, with rain as the share of rainy years', () => {
    const past = [
      { years: 1, days: { '2026-03-15': day({ hi: 24, lo: 10, rainMm: 3, code: 61 }) } },
      { years: 2, days: { '2025-03-15': day({ hi: 26, lo: 12, rainMm: 0, code: 61 }) } },
      { years: 3, days: { '2024-03-15': day({ hi: 25, lo: 14, rainMm: 0.2, code: 1 }) } },
    ]
    expect(typicalDays(['2027-03-15', '2027-03-16'], past)).toEqual({
      '2027-03-15': { code: 61, hi: 25, lo: 12, rainPct: 33, rainMm: 1.1, windKmh: 10, sunrise: '06:00', sunset: '18:00' },
    })
  })

  it('maps leap days to 28 February', () => {
    expect(yearsBefore('2028-02-29', 1)).toBe('2027-02-28')
  })

  it('only uses past years whose dates are already in the archive', () => {
    expect(pastYearsFor(['2027-03-13', '2027-03-21'], '2026-10-02')).toEqual([1, 2, 3])
    // A trip 362 days out: last year's matching dates are still too recent.
    expect(pastYearsFor(['2027-09-29'], '2026-10-02')).toEqual([2, 3, 4])
    expect(pastYearsFor([], '2026-10-02')).toEqual([])
  })

  it('always picks past dates at least a week old', () => {
    fc.assert(fc.property(fc.integer({ min: 17, max: 900 }), fc.integer({ min: 0, max: 30 }), (ahead, span) => {
      const today = '2026-10-02'
      const start = new Date(Date.parse(today) + ahead * 864e5).toISOString().slice(0, 10)
      const end = new Date(Date.parse(start) + span * 864e5).toISOString().slice(0, 10)
      const years = pastYearsFor([start, end], today)
      expect(years.length).toBe(3)
      for (const y of years) expect(yearsBefore(end, y) <= '2026-09-25').toBe(true)
    }))
  })
})

describe('display', () => {
  it('describes WMO codes', () => {
    expect(describeCode(0)).toEqual({ label: 'Clear', icon: 'sun' })
    expect(describeCode(81).icon).toBe('rain')
    expect(describeCode(95).icon).toBe('storm')
    expect(describeCode(42).label).toBe('Mixed')
  })

  it('formats temperatures in the chosen unit', () => {
    expect(formatTemp(25, 'C')).toBe('25°')
    expect(formatTemp(25, 'F')).toBe('77°')
    expect(defaultTempUnit('en-US')).toBe('F')
    expect(defaultTempUnit('es-GT')).toBe('C')
    expect(defaultTempUnit('en')).toBe('C')
  })
})
