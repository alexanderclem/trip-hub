import { expect, test } from '@playwright/test'
const base = '/t/00000000-0000-4000-8000-000000000901'
test.beforeEach(async ({ page, baseURL }) => {
  await page.route(url => url.protocol === 'https:' && url.origin !== new URL(baseURL!).origin, route => route.abort())
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }))
  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  await page.evaluate(async () => {
    const tripId = '00000000-0000-4000-8000-000000000901'
    const memberId = '00000000-0000-4000-8000-000000000902'
    const request = indexedDB.open('trip-hub')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction(['trips', 'members'], 'readwrite')
    transaction.objectStore('trips').put({ id: tripId, name: 'E2E TEST local settings', timezone: 'America/Guatemala', start_date: null, end_date: null, base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only', settings: {}, deleted_at: null })
    transaction.objectStore('members').put({ id: memberId, trip_id: tripId, display_name: 'Alex', color: null, avatar_emoji: null, deleted_at: null })
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [tripId]: { tripId, memberId, joinedAt: '2026-10-08T12:00:00Z' } }, quizSeen: true }, version: 1 }))
  })
})

test('voting leads navigation, persists offline and appears in the overview', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/overview`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Trip navigation' }).filter({ visible: true })
  await nav.getByRole('link', { name: 'Vote', exact: true }).click()
  await page.getByLabel('What are we deciding?').fill('Where should we eat?')
  await page.getByRole('button', { name: 'Create and add options' }).click()
  await page.getByLabel('Option', { exact: true }).fill('Garden café')
  await page.getByRole('button', { name: 'Add “Garden café” as a text option' }).click()
  const choice = page.getByRole('group', { name: 'Your vote for Garden café' }).getByRole('button', { name: 'Must-do' })
  await choice.click()
  await expect(choice).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(choice).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('tab', { name: 'Results', exact: true }).click()
  await expect(page.getByText('3.0 avg · 1 of 1 voted')).toBeVisible()
  await page.goto(`${base}/overview`)
  await expect(page.getByText('You’re all caught up')).toBeVisible()
  // A vote you've finished no longer asks for you on Home; it is one tap away on the Vote tab.
  await nav.getByRole('link', { name: 'Vote', exact: true }).click()
  await page.getByRole('link', { name: /Where should we eat/ }).click()
  await page.getByRole('button', { name: 'Close voting and pick the winner' }).click()
  await expect(page.getByText('Decided', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reopen voting' }).click()
  await page.getByRole('tab', { name: /Vote/ }).click()
  await choice.click()
  await expect(choice).toHaveAttribute('aria-pressed', 'false')
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${base}/overview`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `/tmp/stowaway-overview-${width}.png` })
  }
  const sync = page.getByRole('button', { name: /View sync details/ }).filter({ visible: true })
  await sync.click()
  await expect(page.getByRole('dialog', { name: 'Sync & saved changes' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sync).toBeFocused()
  expect(errors).toEqual([])
})

test('overview loads when Safari member-index cursors stall', async ({ page }) => {
  await page.addInitScript(() => {
    const openCursor = IDBIndex.prototype.openCursor
    IDBIndex.prototype.openCursor = function (...args) {
      if (this.objectStore.name === 'members' && this.name === 'trip_id') {
        // Reproduce a request that never fires success/error, observed in Safari.
        return {} as IDBRequest<IDBCursorWithValue | null>
      }
      return openCursor.apply(this, args)
    }
  })
  await page.goto(`${base}/overview`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('Alex (you)', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Opening your trip…' })).toHaveCount(0)
})
