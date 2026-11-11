import { expect, test, type Page } from '@playwright/test'

// Local fixtures and stubbed services only. Never touch the guest evaluator's live trip.
test.use({ serviceWorkers: 'block', storageState: { cookies: [], origins: [] } })
const tripId = '00000000-0000-4000-8000-000000000e01'
const me = '00000000-0000-4000-8000-000000000e02'
const placeId = '00000000-0000-4000-8000-000000000e03'
const root = `/t/${tripId}`
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

async function seed(page: Page, online = false) {
  await page.route('https://**/*', (route) => route.abort())
  await page.addInitScript((online) => Object.defineProperty(navigator, 'onLine', { get: () => online, configurable: true }), online)
  await page.addInitScript(({ tripId, me }) => {
    const saved = JSON.parse(localStorage.getItem('trip-hub-device') ?? '{"state":{},"version":1}')
    if (Object.keys(saved.state?.trips ?? {}).length) return
    localStorage.setItem('trip-hub-device', JSON.stringify({ ...saved, state: { ...saved.state, quizSeen: true,
      trips: { [tripId]: { tripId, memberId: me, joinedAt: '2027-01-01T12:00:00Z' } } } }))
  }, { tripId, me })
  await page.goto('/app')
  await expect(page.getByText('No upcoming trips', { exact: true })).toBeVisible()
  await page.evaluate(async ({ tripId, me, placeId }) => {
    // Wait for the app to create its database; opening it first would make an empty one.
    while (!(await indexedDB.databases()).some((d) => d.name === 'trip-hub')) { /* not created yet */ }
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result) })
    const tx = db.transaction(['trips', 'members', 'places'], 'readwrite')
    const base = { trip_id: tripId, created_at: '2027-01-01T12:00:00Z', updated_at: '2027-01-01T12:00:00Z', deleted_at: null, created_by: me, updated_by: me }
    tx.objectStore('trips').put({ ...base, id: tripId, name: 'Guest evaluation fixture', timezone: 'Europe/Paris', start_date: '2027-03-16', end_date: '2027-03-20', base_currency: 'USD', local_currency: 'EUR', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-guest-fixture-only', settings: { areas: [{ name: 'Paris', countryCode: 'FR', lat: 48.85, lng: 2.35, bbox: [48.8, 2.3, 48.9, 2.4] }] } })
    tx.objectStore('members').put({ ...base, id: me, display_name: 'Eval Tester', color: null, avatar_emoji: null })
    tx.objectStore('places').put({ ...base, id: placeId, name: 'Café by the river', category: 'food', status: 'shortlist', lat: null, lng: null, tags: [], address: null, area: 'Paris', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' })
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve() })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ version: 1, state: { quizSeen: true, setupDismissed: { [tripId]: true }, trips: { [tripId]: { tripId, memberId: me, joinedAt: '2027-01-01T12:00:00Z' } } } }))
  }, { tripId, me, placeId })
}

test('destination search explains its progress and distinguishes local from settle-up currency', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/photon.komoot.io/**', async (route) => {
    await gate
    await route.fulfill(json({ features: [{ geometry: { coordinates: [2.35, 48.85] }, properties: { name: 'Paris', country: 'France', countrycode: 'fr', osm_key: 'place', osm_value: 'city' } }] }))
  })
  await page.goto('/new')
  await page.getByText('Add dates and destination (optional)', { exact: true }).click()
  await page.getByLabel('Search for a destination').fill('Paris')
  await expect(page.getByRole('status').filter({ hasText: 'Searching destinations…' })).toBeVisible()
  release()
  await page.getByRole('button', { name: 'Paris, France', exact: true }).click()
  await expect(page.getByLabel('Local currency', { exact: true })).toHaveValue('EUR')
  await expect(page.getByLabel('Settle-up currency', { exact: true })).toHaveValue('USD')
  await expect(page.getByRole('combobox', { name: 'Destination time zone', exact: true })).toHaveValue('Europe/Paris')
})

test('saved country and city flow into Explore and the Plan no longer asks for a destination', async ({ page }) => {
  await seed(page)
  await page.goto(`${root}/more/explore`)
  await expect(page.getByRole('combobox', { name: 'Country', exact: true })).toHaveValue('FR')
  await expect(page.getByLabel('City', { exact: true })).toHaveValue('Paris')
  await page.goto(`${root}/plan?day=2027-03-16`)
  await expect(page.getByText('Set a destination to see local holidays')).toHaveCount(0)
  await expect(page.getByRole('radio', { name: /Paris time, GMT/ })).toBeVisible()
})

test('saving a ticket without a file produces a useful, recoverable error', async ({ page }) => {
  await seed(page)
  await page.goto(`${root}/tickets`)
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Add a ticket', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Museum booking')
  await page.getByLabel('Confirmation code').fill('PARIS123')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Choose a PDF or photo before saving')
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Museum booking')
  await expect(page.getByRole('button', { name: 'PDF or photo', exact: true })).toBeFocused()
})

test('map loading offers saved places instead of an unexplained blank canvas', async ({ page }) => {
  await seed(page)
  await page.goto(`${root}/map`)
  await expect(page.getByRole('heading', { name: 'Trip map', exact: true })).toBeAttached()
  await expect(page.getByRole('link', { name: 'Open saved places', exact: true })).toBeVisible()
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/map-loading.png` })
  await page.getByRole('link', { name: 'Open saved places', exact: true }).click()
  await expect(page).toHaveURL(`${root}/more/places`)
  await expect(page.getByText('Café by the river')).toBeVisible()
})

test('solo spending and the current traveler’s missing vote use personal wording', async ({ page }) => {
  await seed(page)
  await page.evaluate(async ({ tripId, me }) => {
    // Wait for the app to create its database; opening it first would make an empty one.
    while (!(await indexedDB.databases()).some((d) => d.name === 'trip-hub')) { /* not created yet */ }
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result) })
    const tx = db.transaction(['expenses', 'polls', 'poll_options'], 'readwrite')
    const base = { trip_id: tripId, created_at: '2027-01-01T12:00:00Z', updated_at: '2027-01-01T12:00:00Z', deleted_at: null, created_by: me }
    tx.objectStore('expenses').put({ ...base, id: 'expense', description: 'Museum ticket', category: 'activities', spent_on: '2027-03-16', amount_minor: 6000, currency: 'EUR', fx_rate: 1.116, base_currency: 'USD', base_amount_minor: 6696, fx_source: 'manual', fx_as_of: '2027-03-16', payers: [{ member_id: me, amount_minor: 6000 }], split_method: 'equal', split: [{ member_id: me, value: 1 }], place_id: null, item_id: null, notes: null })
    tx.objectStore('polls').put({ ...base, id: 'poll', title: 'Where to eat?', description: null, status: 'open', kind: 'options', closes_at: null, winner_option_id: null })
    tx.objectStore('poll_options').put({ ...base, id: 'option', poll_id: 'poll', label: 'Café by the river', place_id: null, url: null, description: null })
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve() })
    db.close()
  }, { tripId, me })
  await page.goto(`${root}/money`)
  await expect(page.getByText('No shared balance yet', { exact: true })).toBeVisible()
  await expect(page.getByText(/your share/i)).toHaveCount(0)
  await page.goto(`${root}/overview`)
  await expect(page.getByText('Your vote is still needed', { exact: true })).toBeVisible()
})

test('background refresh does not pretend uploads are pending and resolves to Up to date', async ({ page }) => {
  await seed(page, true)
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  let held = false
  await page.route('**/*.supabase.co/rest/v1/**', async (route) => {
    if (route.request().url().includes('/rpc/my_trip_access')) return route.fulfill(json({ role: 'owner', mode: 'group', epoch: 0 }))
    if (route.request().url().includes('/trips?') && !held) { held = true; await gate }
    await route.fulfill(json([]))
  })
  // Phones only print sync status when it's offline or in trouble; wider screens keep the tool.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${root}/overview`)
  const button = page.getByRole('button', { name: /^Sync: Checking for updates/ }).first()
  await button.click()
  const details = page.getByRole('dialog', { name: 'Sync & saved changes' })
  await expect(details).toContainText('There are no waiting uploads. Checking for changes from your group.')
  release()
  await expect(details.getByRole('status').filter({ hasText: 'Up to date' })).toBeVisible()
})

for (const colorScheme of ['light', 'dark'] as const) {
  test(`settings remain reachable and helper text is readable in ${colorScheme} mode`, async ({ page }) => {
    await seed(page)
    await page.emulateMedia({ colorScheme })
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`${root}/more/settings`)
    const navigation = page.getByRole('navigation', { name: 'Trip settings', exact: true })
    for (const name of ['Settings & sharing', 'Trip recap']) {
      const box = await navigation.getByRole('link', { name, exact: true }).boundingBox()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(720)
    }
    for (const path of ['more/settings', `more/places/${placeId}`]) {
      await page.goto(`${root}/${path}`)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      const failures = await page.evaluate(() => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const context = canvas.getContext('2d', { willReadFrequently: true })!
        const rgba = (value: string) => {
          context.clearRect(0, 0, 1, 1)
          context.fillStyle = value
          context.fillRect(0, 0, 1, 1)
          return [...context.getImageData(0, 0, 1, 1).data]
        }
        const over = (a: number[], b: number[]) => a.slice(0, 3).map((value, i) => value * a[3]! / 255 + b[i]! * (1 - a[3]! / 255)).concat(255)
        const luminance = (value: number[]) => value.slice(0, 3).map((channel) => { const v = channel / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i]!, 0)
        const background = (el: Element): number[] => {
          const color = rgba(getComputedStyle(el).backgroundColor)
          return color[3] === 255 ? color : over(color, el.parentElement ? background(el.parentElement) : [255, 255, 255, 255])
        }
        return [...document.querySelectorAll('.text-muted, .text-warning-ink')].filter((el) => {
          if (!el.getClientRects().length || el.closest('[aria-hidden="true"], [inert]') || ![...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) return false
          const bg = background(el)
          const a = luminance(over(rgba(getComputedStyle(el).color), bg)); const b = luminance(bg)
          const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
          return !Number.isFinite(ratio) || ratio < 4.5
        }).map((el) => el.textContent?.trim())
      })
      expect(failures).toEqual([])
      if (path === 'more/settings' && process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/settings-${colorScheme}.png` })
      await page.setViewportSize({ width: 320, height: 844 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      await page.setViewportSize({ width: 1280, height: 720 })
    }
  })
}
