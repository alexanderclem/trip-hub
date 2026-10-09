import { expect, test, type Page } from '@playwright/test'

// All app fixtures are local. No backend writes or real trips are involved.
const tripId = '00000000-0000-4000-8000-000000000b01'
const memberId = '00000000-0000-4000-8000-000000000b02'
const pollId = '00000000-0000-4000-8000-000000000b03'
const root = `/t/${tripId}`

async function seed(page: Page, baseURL: string, offline = true) {
  await page.route(url => url.protocol === 'https:' && url.origin !== new URL(baseURL).origin, route => route.abort())
  if (offline) await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }))
  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  await page.evaluate(async ({ tripId, memberId, pollId }) => {
    const req = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
    const tx = db.transaction(['trips', 'members', 'polls', 'poll_options'], 'readwrite')
    tx.objectStore('trips').put({ id: tripId, name: 'E2E TEST local polish', timezone: 'America/New_York', start_date: '2027-05-01', end_date: '2027-05-03', base_currency: 'USD', local_currency: 'USD', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-polish-only', settings: {}, deleted_at: null })
    tx.objectStore('members').put({ id: memberId, trip_id: tripId, display_name: 'Alex', color: null, avatar_emoji: null, deleted_at: null })
    tx.objectStore('polls').put({ id: pollId, trip_id: tripId, title: 'Choose a day out', status: 'open', kind: 'options', winner_option_id: null, closes_at: null, deleted_at: null })
    tx.objectStore('poll_options').put({ id: '00000000-0000-4000-8000-000000000b04', trip_id: tripId, poll_id: pollId, label: 'Central Park', place_id: null, deleted_at: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { quizSeen: true, trips: { [tripId]: { tripId, memberId, joinedAt: '2026-10-09T12:00:00Z' } } }, version: 1 }))
    sessionStorage.setItem('stowaway-install-dismissed', '1')
  }, { tripId, memberId, pollId })
}

async function rows(page: Page, store: string) {
  return page.evaluate(async store => {
    const req = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>(resolve => { req.onsuccess = () => resolve(req.result) })
    const all = db.transaction(store).objectStore(store).getAll()
    const result = await new Promise<Record<string, unknown>[]>(resolve => { all.onsuccess = () => resolve(all.result) })
    db.close()
    return result
  }, store)
}

async function failNextWrite(page: Page, store: string) {
  await page.evaluate(store => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === store) {
        IDBObjectStore.prototype.put = original
        throw new DOMException('Storage temporarily unavailable', 'QuotaExceededError')
      }
      return original.apply(this, args)
    }
  }, store)
}

test('example days update map and itinerary without requests, layout shifts or lost focus', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/')
  const figure = page.getByRole('figure')
  await figure.scrollIntoViewIfNeeded()
  const before = await figure.boundingBox()
  const firstRoute = await page.locator('.preview-route').getAttribute('d')
  const requests: string[] = []
  page.on('request', r => requests.push(r.url()))
  const day2 = page.getByRole('button', { name: 'Day 2', exact: true })
  await day2.focus()
  await page.keyboard.press('Enter')
  await expect(day2).toBeFocused()
  await expect(day2).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'An afternoon at the Met' })).toBeVisible()
  expect(await page.locator('.preview-route').getAttribute('d')).not.toBe(firstRoute)
  await expect(page.getByRole('heading', { name: 'Coffee in the West Village' })).toHaveCount(0)
  for (const day of [3, 1, 2, 3]) await page.getByRole('button', { name: `Day ${day}`, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Walk the Brooklyn Bridge' })).toBeVisible()
  expect((await figure.boundingBox())!.height).toBeCloseTo(before!.height, 0)
  await expect(page.getByRole('status')).toContainText('Day 3')
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

test('preview reflows with long text, keyboard focus and live reduced-motion changes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Day 2', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Day 2', exact: true })).toHaveCSS('outline-style', 'solid')
  await expect(page.getByRole('button', { name: 'Day 2', exact: true })).toHaveCSS('transition-duration', '0s')
  await page.locator('#preview-day-2 h3').first().evaluate(e => { e.textContent = 'Averylongunbrokenitinerarynamethatmustremainreadable' })
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByRole('heading', { name: 'Averylongunbrokenitinerarynamethatmustremainreadable' })).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Day 3', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Walk the Brooklyn Bridge' })).toBeVisible()
})

test('public visits defer offline downloads; entering the app installs it for offline navigation', async ({ page, context }) => {
  await page.goto('/')
  await page.getByRole('heading', { level: 1 }).waitFor()
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0)
  await page.getByRole('link', { name: 'Create a trip', exact: true }).click()
  await expect(page.getByLabel('Trip name')).toBeVisible()
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready) && !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
  await page.goto('/')
  await page.getByRole('button', { name: 'Day 3', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Walk the Brooklyn Bridge' })).toBeVisible()
})

test('invite copying locks duplicate actions, reports failure, and permits retry', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/more/settings`)
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Invite the group' }) })
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>((resolve, reject) => {
      Object.assign(window, { finishCopy: resolve, failCopy: () => reject(new DOMException('Denied', 'NotAllowedError')), copyCalls: ((window as unknown as { copyCalls?: number }).copyCalls ?? 0) + 1 })
    }) } })
  })
  await card.getByRole('button', { name: 'Copy', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(card.getByRole('button', { name: 'Copying…' })).toBeDisabled()
  await expect(card.getByRole('button', { name: 'Share', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => (window as unknown as { copyCalls: number }).copyCalls)).toBe(1)
  await page.evaluate(() => (window as unknown as { failCopy: () => void }).failCopy())
  await expect(card.getByRole('alert')).toContainText('Could not copy')
  await card.getByRole('button', { name: 'Copy', exact: true }).click()
  await page.evaluate(() => (window as unknown as { finishCopy: () => void }).finishCopy())
  await expect(card.getByRole('button', { name: 'Copied' })).toBeEnabled()
  await expect(card.getByRole('status')).toContainText('Invite copied')
  await expect(card.getByRole('alert')).toHaveCount(0)
})

test('vote failure preserves the choice; rapid retry saves one local revision', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/more/vote/${pollId}`)
  const group = page.getByRole('group', { name: 'Your vote for Central Park' })
  const choice = group.getByRole('button').last()
  await choice.click()
  await expect(choice).toHaveAttribute('aria-pressed', 'true')
  await failNextWrite(page, 'poll_votes')
  await group.getByRole('button').first().click()
  await expect(page.getByRole('alert')).toContainText('Your vote could not be saved')
  await expect(choice).toHaveAttribute('aria-pressed', 'true')
  await group.getByRole('button').first().evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(group.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status').filter({ hasText: 'Vote saved on this device' })).toBeVisible()
  const votes = await rows(page, 'poll_votes')
  expect(votes).toHaveLength(1)
  expect(votes[0]._lrev).toBe(2)
  await group.getByRole('button').first().click()
  await expect(group.getByRole('button').first()).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('status').filter({ hasText: 'Vote removed from this device' })).toBeVisible()
})

test('itinerary save retains input after failure and prevents duplicate submissions', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/plan/new?day=2027-05-01`)
  await page.getByLabel('Name', { exact: true }).fill('Coffee with the group')
  await failNextWrite(page, 'itinerary_items')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Storage temporarily unavailable')
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Coffee with the group')
  await page.locator('form').evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit() })
  await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: 'Coffee with the group', exact: true, level: 1 })).toBeVisible()
  expect(await rows(page, 'itinerary_items')).toHaveLength(1)
})

test('offline preparation retains real map packs, labels, and a saved ticket after reload', async ({ page, context, baseURL }) => {
  await seed(page, baseURL!, false)
  // Simulated backend boundaries; the actual offline file download/cache/render path is exercised.
  await page.route('**/rest/v1/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }))
  await page.route('https://open.er-api.com/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: 'success', rates: { USD: 1, GTQ: 7.6 } }) }))
  await page.evaluate(async ({ tripId, memberId }) => {
    const req = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>(resolve => { req.onsuccess = () => resolve(req.result) })
    const get = db.transaction('trips').objectStore('trips').get(tripId)
    const trip = await new Promise<Record<string, unknown>>(resolve => { get.onsuccess = () => resolve(get.result) })
    const tx = db.transaction(['trips', 'attachments', 'files', 'places'], 'readwrite')
    tx.objectStore('trips').put({ ...trip, start_date: null, end_date: null, offline_pack: {
      id: 'guatemala-2027', label: 'Guatemala', version: '20260930',
      overview: { name: 'guatemala-2027-overview.pmtiles', url: '/packs/guatemala-2027-overview.pmtiles', bytes: 6449250 },
      detail: { name: 'guatemala-2027-detail.pmtiles', url: '/packs/guatemala-2027-detail.pmtiles', bytes: 9197744 },
    } })
    const blob = new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9kAAAAASUVORK5CYII='), c => c.charCodeAt(0))], { type: 'image/png' })
    tx.objectStore('files').put({ name: 'att:local-ticket', blob })
    tx.objectStore('attachments').put({ id: 'local-ticket', trip_id: tripId, title: 'Saved boarding pass', kind: 'ticket', mime: 'image/png', filename: 'boarding.png', bytes: blob.size, storage_path: 'local-test/boarding.png', uploaded_at: '2026-10-08T12:00:00Z', created_by: memberId, deleted_at: null })
    tx.objectStore('places').put({ id: 'local-place', trip_id: tripId, name: 'Parque Central', lat: 14.5572, lng: -90.7334, category: 'sight', status: 'shortlist', deleted_at: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
  }, { tripId, memberId })
  await page.goto(`${root}/more/settings`)
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready) && !!navigator.serviceWorker.controller)
  await page.getByRole('button', { name: 'Download everything for offline', exact: true }).click()
  await expect(page.getByText(/Ready for offline · checked/)).toBeVisible({ timeout: 60000 })
  await context.setOffline(true)
  await page.goto(`${root}/tickets/local-ticket`)
  await expect(page.getByRole('img', { name: 'Saved boarding pass' })).toBeVisible()
  expect(await page.getByRole('img', { name: 'Saved boarding pass' }).evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(1)
  const failures: string[] = []
  page.on('requestfailed', request => { if (/map-assets|\.pmtiles|maplibre-gl-worker|\/assets\//.test(request.url())) failures.push(request.url()) })
  await page.goto(`${root}/map`)
  await expect(page.getByText('Offline map', { exact: true })).toBeVisible()
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible()
  await page.waitForTimeout(2500)
  // MapLibre exposes rendered labels in DOM-independent canvas pixels; use a screenshot for visual QA.
  await page.screenshot({ path: '.design/screenshots/polish/offline-map.png' })
  expect(failures).toEqual([])
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name))
  expect(resources.some(url => url.includes('/map-assets/fonts/'))).toBe(true)
})
