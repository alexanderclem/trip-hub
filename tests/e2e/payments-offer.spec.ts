import { expect, test, type Page } from '@playwright/test'

// Local-only fixtures: offline, every network request refused, the trip written straight into
// IndexedDB. Nothing reaches Supabase; the events stay queued on the phone.
const trip = '00000000-0000-4000-8000-000000000301'
const people = Array.from({ length: 10 }, (_, i) => `00000000-0000-4000-8000-0000000003${String(10 + i)}`)
const [ana, ben] = people as [string, string]
const base = `/t/${trip}`
const shots = process.env.SHOTS_DIR ?? 'test-results'

async function seed(page: Page, me: string) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }))
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/inspire/manual') // opens the local database, so the stores below exist
  await expect(page.getByRole('heading', { name: 'Trip ideas', level: 1 })).toBeVisible()
  await page.evaluate(async ({ trip, people, ana, me }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction(['trips', 'members'], 'readwrite')
    tx.objectStore('trips').put({ id: trip, name: 'E2E TEST payments offer', timezone: 'America/Guatemala', start_date: '2027-03-15', end_date: '2027-03-18', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only-token', settings: {}, created_by: ana })
    people.forEach((id, i) => tx.objectStore('members').put({ id, trip_id: trip, deleted_at: null, display_name: `Person ${i + 1}`, color: null, avatar_emoji: null, home_timezone: null }))
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: me, joinedAt: '2027-03-01T12:00:00Z' } }, quizSeen: true, timeView: 'trip', basemap: 'offline', moneyView: 'base' }, version: 1 }))
  }, { trip, people, ana, me })
}

const queued = (page: Page) => page.evaluate(async () => {
  const request = indexedDB.open('trip-hub')
  const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
  const rows = await new Promise<{ kind: string }[]>((resolve) => { const r = db.transaction('_events').objectStore('_events').getAll(); r.onsuccess = () => resolve(r.result as { kind: string }[]) })
  db.close()
  return rows.map((r) => r.kind)
})

test('the creator of a 10-person trip is offered payments, honestly, and can say not now', async ({ page }) => {
  await seed(page, ana)
  await page.goto(`${base}/money`)
  const row = page.getByRole('button', { name: /Collect payments for this trip/ })
  await expect(row).toBeVisible()
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await row.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${shots}/payments-offer-row-${width}.png` })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await row.click()
  const sheet = page.getByRole('dialog', { name: 'Collect payments for this trip' })
  await expect(sheet.getByText('Stowaway never holds it.')).toBeVisible()
  await expect(sheet.getByLabel('Email for early access')).toBeVisible()
  await page.screenshot({ path: `${shots}/payments-offer-sheet-390.png` })
  // Escape closes the sheet without deciding anything.
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(row).toBeVisible()
  // Offline, the early-access request explains what it needs.
  await row.click()
  await sheet.getByLabel('Email for early access').fill('ana@example.com')
  await sheet.getByRole('button', { name: 'Get early access' }).click()
  await expect(sheet.getByText('Connect to the internet to join the early-access list.')).toBeVisible()
  await sheet.getByRole('button', { name: 'Not now' }).click()
  await expect(row).toBeHidden()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'See who owes what' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Collect payments for this trip/ })).toHaveCount(0)
  expect(await queued(page)).toEqual(['money_moment_shown', 'money_moment_clicked', 'money_moment_clicked', 'money_moment_dismissed'])
})

test('nobody else on the trip is offered payments', async ({ page }) => {
  await seed(page, ben)
  await page.goto(`${base}/money`)
  await expect(page.getByRole('heading', { name: 'See who owes what' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Collect payments for this trip/ })).toHaveCount(0)
  expect(await queued(page)).toEqual([])
})
