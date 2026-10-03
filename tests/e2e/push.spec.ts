import { expect, test, type Page } from '@playwright/test'

// Local-only: seeds IndexedDB and blocks the network. Real delivery needs a real phone; the
// server path (trigger → queue → pg_cron → push-dispatch) is checked against Supabase directly.
const trip = '00000000-0000-4000-8000-000000000301'
const alex = '00000000-0000-4000-8000-000000000302'
const shots = process.env.SHOTS_DIR ?? 'test-results'

async function seed(page: Page) {
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/inspire')
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  await page.evaluate(async ({ trip, alex }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction(['trips', 'members'], 'readwrite')
    tx.objectStore('trips').put({ id: trip, name: 'E2E TEST push', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-16', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only', settings: {}, deleted_at: null })
    tx.objectStore('members').put({ id: alex, trip_id: trip, display_name: 'Alex', color: null, avatar_emoji: null, home_timezone: null, deleted_at: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: alex, joinedAt: '2027-03-01T12:00:00Z' } }, quizSeen: true }, version: 1 }))
  }, { trip, alex })
}

test('on an iPhone in Safari, notifications explain the Home Screen step', async ({ page }) => {
  await seed(page)
  await page.goto(`/t/${trip}/more/settings`)
  const card = page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Notifications' }) }).last()
  await expect(card.getByText(/only work in the Home Screen app/)).toBeVisible()
  await card.screenshot({ path: `${shots}/push-card-iphone-safari.png` })
})

test.describe('desktop browser', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', isMobile: false, hasTouch: false, viewport: { width: 420, height: 900 } })
  test('offers to turn notifications on, with the four kinds explained', async ({ page }) => {
    // Headless Chromium always reports "denied"; a real browser starts at "default" (not asked yet).
    await page.addInitScript(() => Object.defineProperty(Notification, 'permission', { get: () => 'default' }))
    await seed(page)
    await page.goto(`/t/${trip}/more/settings`)
    const button = page.getByRole('button', { name: 'Turn on notifications' })
    await expect(button).toBeEnabled()
    await expect(page.getByText(/nudge when it’s time to leave/)).toBeVisible()
    await page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Notifications' }) }).last().screenshot({ path: `${shots}/push-card-off.png` })
  })
})
