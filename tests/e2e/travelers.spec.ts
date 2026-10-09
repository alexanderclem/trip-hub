import { expect, test } from '@playwright/test'

const trip = '00000000-0000-4000-8000-000000000701'
const ana = '00000000-0000-4000-8000-000000000702'
const ben = '00000000-0000-4000-8000-000000000703'

test('traveler links, assignments, Venmo, and profile photos work offline', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/inspire')
  await expect(page.getByRole('heading', { name: 'Stowie', exact: true })).toBeVisible()
  await page.evaluate(async ({ trip, ana, ben }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction(['trips', 'members', 'itinerary_items', 'expenses', 'trip_tasks', 'packing_items'], 'readwrite')
    const common = { trip_id: trip, deleted_at: null }
    tx.objectStore('trips').put({ id: trip, name: 'Traveler test', timezone: 'UTC', start_date: null, end_date: null, base_currency: 'USD', local_currency: null, route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only', settings: {}, deleted_at: null })
    for (const [id, name] of [[ana, 'Ana Maria Rivera'], [ben, 'Ben Carter']]) tx.objectStore('members').put({ ...common, id, display_name: name, color: '#2563eb', avatar_emoji: null, home_timezone: null })
    const item = { ...common, to_place_id: null, place_id: null, all_day: false, kind: 'activity', start_local: '2027-03-14T07:00', start_at: '2027-03-14T07:00:00Z', start_tz: 'UTC', end_tz: null, end_local: null, end_at: null, status: 'confirmed', confirmation_code: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null }
    tx.objectStore('itinerary_items').put({ ...item, id: 'everyone', title: 'Group breakfast', attendee_ids: null })
    tx.objectStore('itinerary_items').put({ ...item, id: 'ben-event', title: 'Cooking class', attendee_ids: [ben] })
    tx.objectStore('expenses').put({ ...common, id: 'expense', description: 'Airport shuttle', category: 'transport', spent_on: '2027-03-13', amount_minor: 6000, currency: 'USD', fx_rate: 1, fx_source: 'same', fx_as_of: null, base_currency: 'USD', base_amount_minor: 6000, payers: [{ member_id: ana, amount_minor: 6000 }], split_method: 'equal', split: [{ member_id: ana, value: 0 }, { member_id: ben, value: 0 }], place_id: null, item_id: null, notes: null })
    tx.objectStore('trip_tasks').put({ ...common, id: 'task', title: 'Book shuttle', assignee_id: ana, completed: false, due_date: null, notes: null })
    tx.objectStore('packing_items').put({ ...common, id: 'packing', title: 'First aid kit', kind: 'group', owner_id: ana, packed: false, quantity: 1, category: null, notes: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: ana, joinedAt: '2027-03-01T12:00:00Z' } }, quizSeen: true }, version: 1 }))
  }, { trip, ana, ben })
  await page.goto(`/t/${trip}/overview`)
  await page.getByRole('link', { name: /Ana Maria Rivera/ }).first().click()
  await expect(page).toHaveURL(new RegExp(`travelers/${ana}`))
  await expect(page.getByRole('link', { name: /Group breakfast/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Airport shuttle/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Book shuttle/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /First aid kit/ })).toBeVisible()
  await page.getByLabel('Assign an existing event').selectOption('ben-event')
  await expect(page.getByRole('link', { name: /Cooking class/ })).toBeVisible()
  await page.getByText('Edit traveler profile', { exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByLabel('Venmo username or profile link').fill('https://evil.test/ana-rivera')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByLabel('Venmo username or profile link').fill('@ana-rivera')
  const photo = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#2563eb'; ctx.fillRect(0, 0, 64, 64)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  await page.getByLabel('Profile photo', { exact: true }).setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') })
  await expect(page.locator('img[src^="data:image/jpeg"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Profile saved' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Venmo · @ana-rivera' })).toHaveAttribute('href', 'https://venmo.com/u/ana-rivera')
  await expect(page.locator('img[src^="data:image/jpeg"]')).toHaveCount(2)
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('heading', { name: 'Ana Maria Rivera (you)', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/stowaway-traveler-profile.png', fullPage: true })
  expect(await page.locator('a a').count()).toBe(0)
  await page.reload()
  await expect(page.locator('img[src^="data:image/jpeg"]')).toHaveCount(2)
  await page.getByText('Edit traveler profile', { exact: true }).click()
  await page.getByRole('button', { name: 'Remove photo' }).click()
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.locator('img[src^="data:image/jpeg"]')).toHaveCount(0)
  await expect(page.getByText('AR', { exact: true }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Assign a task' }).click()
  await expect(page.getByLabel('Assigned to')).toHaveValue(ana)
  await page.goto(`/t/${trip}/travelers/${ana}`)
  await page.getByRole('link', { name: 'Add an event', exact: true }).click()
  await expect(page.getByLabel('Ana Maria Rivera')).toBeChecked()
  await page.goto(`/t/${trip}/money`)
  await expect(page.getByRole('link', { name: 'Pay Ana Maria Rivera on Venmo' })).toHaveAttribute('href', 'https://venmo.com/u/ana-rivera')
})
