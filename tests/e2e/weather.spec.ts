import { expect, test, type Page, type Route } from '@playwright/test'

// Local-only: seeds IndexedDB directly and mocks Open-Meteo, so no live accounts or rows are created.
const trip = '00000000-0000-4000-8000-000000000201'
const alex = '00000000-0000-4000-8000-000000000202'
const hotel = '00000000-0000-4000-8000-000000000203'
const base = `/t/${trip}`
const shots = process.env.SHOTS_DIR ?? 'test-results'

function between(start: string, end: string) {
  const out: string[] = []
  for (let t = Date.parse(start); t <= Date.parse(end); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}

function daily(dates: string[], code: number, hi: number, rain: number) {
  return {
    daily: {
      time: dates, weather_code: dates.map(() => code), temperature_2m_max: dates.map(() => hi), temperature_2m_min: dates.map(() => 12),
      precipitation_sum: dates.map(() => rain), precipitation_probability_max: dates.map(() => 40), wind_speed_10m_max: dates.map(() => 18),
      sunrise: dates.map((d) => `${d}T06:11`), sunset: dates.map((d) => `${d}T18:13`),
    },
  }
}

async function seed(page: Page, now: string) {
  const requests: string[] = []
  await page.route('https://**/*', async (route: Route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'api.open-meteo.com') {
      requests.push('forecast')
      const first = now.slice(0, 10)
      return route.fulfill({ json: daily(between(first, new Date(Date.parse(first) + 15 * 864e5).toISOString().slice(0, 10)), 80, 26, 3) })
    }
    if (url.hostname === 'archive-api.open-meteo.com') {
      requests.push('archive')
      return route.fulfill({ json: daily(between(url.searchParams.get('start_date')!, url.searchParams.get('end_date')!), 1, 24, 0) })
    }
    return route.abort()
  })
  await page.clock.install({ time: new Date(now) })
  await page.goto('/inspire/manual') // opens the local database, so the stores below exist
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  await page.evaluate(async ({ trip, alex, hotel }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction(['trips', 'members', 'places', 'itinerary_items'], 'readwrite')
    const common = { trip_id: trip, deleted_at: null }
    tx.objectStore('trips').put({ id: trip, name: 'E2E TEST weather', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-16', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only', settings: {} })
    tx.objectStore('members').put({ ...common, id: alex, display_name: 'Alex', color: null, avatar_emoji: null, home_timezone: null })
    tx.objectStore('places').put({ ...common, id: hotel, name: 'Casa Antigua', category: 'lodging', tags: [], lat: 14.5586, lng: -90.7295, address: null, area: null, status: 'booked', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' })
    tx.objectStore('itinerary_items').put({ ...common, id: 'stay', title: 'Casa Antigua', kind: 'lodging', place_id: hotel, to_place_id: null, all_day: false, start_local: '2027-03-13T15:00', start_tz: 'America/Guatemala', end_local: '2027-03-16T11:00', end_tz: 'America/Guatemala', start_at: '2027-03-13T21:00:00Z', end_at: '2027-03-16T17:00:00Z', status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: alex, joinedAt: '2027-03-01T12:00:00Z' } }, quizSeen: true, timeView: 'trip', basemap: 'offline', moneyView: 'base', tempUnit: 'F' }, version: 1 }))
  }, { trip, alex, hotel })
  return requests
}

test('plan days show the forecast, and it stays after going offline', async ({ page, context }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const requests = await seed(page, '2027-03-10T15:00:00Z')
  await page.goto(`${base}/plan?day=2027-03-14`)
  const weather = page.getByRole('region', { name: 'Weather' })
  await expect(weather.getByText('Showers')).toBeVisible()
  await expect(weather.getByText('79°')).toBeVisible() // 26 °C
  await expect(weather.getByText('40% rain')).toBeVisible()
  await expect(weather.getByText('18:13')).toBeVisible()
  await expect(weather.getByRole('link', { name: /Open-Meteo/ })).toHaveAttribute('href', 'https://open-meteo.com/')
  await expect(page.getByRole('tab', { name: /Sunday 14 March.*Showers, high 79°/ })).toBeVisible()
  expect(requests).toEqual(['forecast'])
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${shots}/weather-plan-${width}.png` })
  }

  // Offline: a reload reads the stored copy and asks for nothing.
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('region', { name: 'Weather' }).getByText('Showers')).toBeVisible()
  expect(requests).toEqual(['forecast'])
  expect(errors).toEqual([])
})

test('days beyond the forecast show typical weather, clearly labelled', async ({ page }) => {
  const requests = await seed(page, '2027-01-20T15:00:00Z')
  await page.goto(`${base}/plan?day=2027-03-14`)
  const weather = page.getByRole('region', { name: 'Weather' })
  await expect(weather.getByText('Mostly clear')).toBeVisible()
  await expect(weather.getByText('Typical for these dates (last few years), not a forecast')).toBeVisible()
  await expect(weather.getByText('Rained 0% of years')).toBeVisible()
  expect(requests).toEqual(['archive', 'archive', 'archive'])
  await page.screenshot({ path: `${shots}/weather-typical-390.png` })
})
