import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Local-only fixtures: no anonymous accounts, production rows, or live network writes.
const trip = '00000000-0000-4000-8000-000000000101'
const alex = '00000000-0000-4000-8000-000000000102'
const sam = '00000000-0000-4000-8000-000000000103'
const cafe = '00000000-0000-4000-8000-000000000104'
const tour = '00000000-0000-4000-8000-000000000105'
const base = `/t/${trip}`

async function seed(page: Page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }))
  await page.route('https://**/*', (route) => route.abort())
  await page.clock.install({ time: new Date('2027-03-15T15:30:00Z') })
  await page.goto('/inspire/manual') // opens the local database, so the stores below exist
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  await page.evaluate(async ({ trip, alex, sam, cafe, tour }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const stores = ['trips', 'members', 'places', 'itinerary_items', 'leg_overrides', 'attachments', 'files']
    const tx = db.transaction(stores, 'readwrite')
    const common = { trip_id: trip, deleted_at: null }
    tx.objectStore('trips').put({ id: trip, name: 'E2E TEST local planning features', timezone: 'America/Guatemala', start_date: '2027-03-15', end_date: '2027-03-16', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only', settings: {} })
    for (const [id, name] of [[alex, 'Alex'], [sam, 'Sam']]) tx.objectStore('members').put({ ...common, id, display_name: name, color: null, avatar_emoji: null, home_timezone: null })
    for (const [id, name] of [[cafe, 'Garden café'], [tour, 'Coffee farm']]) tx.objectStore('places').put({ ...common, id, name, category: 'activity', tags: [], lat: null, lng: null, address: null, area: null, status: 'planned', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' })
    const item = { ...common, kind: 'activity', to_place_id: null, all_day: false, start_tz: 'America/Guatemala', end_tz: 'America/Guatemala', status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null }
    tx.objectStore('itinerary_items').put({ ...item, id: 'breakfast', title: 'Breakfast at the garden café', place_id: cafe, start_local: '2027-03-15T09:00', end_local: '2027-03-15T10:00', start_at: '2027-03-15T15:00:00Z', end_at: '2027-03-15T16:00:00Z' })
    tx.objectStore('itinerary_items').put({ ...item, id: 'tour', title: 'Coffee farm tour', place_id: tour, start_local: '2027-03-15T10:15', end_local: '2027-03-15T11:30', start_at: '2027-03-15T16:15:00Z', end_at: '2027-03-15T17:30:00Z' })
    tx.objectStore('leg_overrides').put({ ...common, id: 'leg', place_a_id: cafe, place_b_id: tour, mode: 'shuttle', min_s: 1200, max_s: 1800, note: null })
    tx.objectStore('attachments').put({ ...common, id: 'ticket', item_id: 'tour', place_id: null, expense_id: null, kind: 'ticket', title: 'Coffee tour ticket', confirmation_code: 'TEST123', storage_path: `${trip}/ticket/test.svg`, filename: 'ticket.svg', mime: 'image/svg+xml', bytes: 200, sha256: 'test', uploaded_at: '2027-03-14T12:00:00Z' })
    tx.objectStore('files').put({ name: 'att:ticket', blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#ccfbf1"/><text x="30" y="100">Coffee tour · TEST123</text></svg>'], { type: 'image/svg+xml' }) })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: alex, joinedAt: '2027-03-14T12:00:00Z' } }, quizSeen: true, timeView: 'trip', basemap: 'offline', moneyView: 'base' }, version: 1 }))
  }, { trip, alex, sam, cafe, tour })
}

test('up next and travel warnings render offline, link to tickets, and update with the clock', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await seed(page)
  await page.goto(`${base}/plan`)
  await expect(page.getByRole('heading', { name: 'Up next for you' })).toBeVisible()
  await expect(page.getByText('Leave by 09:45')).toBeVisible()
  await expect(page.getByText('From Garden café · Shuttle 20–30 min (reported by the group).')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Allow more travel time' })).toBeVisible()
  await expect(page.getByText('15 min between plans; allow 20–30 min by shuttle.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'View on map' })).toHaveAttribute('href', `${base}/map?place=${tour}`)
  for (const width of [390, 320, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/features-plan-${width}.png` })
  }
  await page.setViewportSize({ width: 320, height: 844 })
  await page.getByRole('region', { name: 'Allow more travel time' }).screenshot({ path: 'test-results/features-travel-warning-320.png' })
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/features-plan-200-percent.png' })
  await page.evaluate(() => { document.documentElement.style.zoom = '' })
  // Calendar export is built on the phone, so it works with no network.
  const whole = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Add my plan to calendar' }).click()
  const plan = await whole
  expect(plan.suggestedFilename()).toBe('e2e-test-local-planning-features.ics')
  const ics = readFileSync(await plan.path(), 'utf8')
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
  expect(ics).toContain('SUMMARY:Coffee farm tour')
  expect(ics).toContain('DTSTART:20270315T161500Z')
  expect(ics).toContain('DTEND:20270315T173000Z')
  expect(ics).toContain('LOCATION:Coffee farm')
  await page.getByRole('link', { name: 'Coffee farm tour', exact: true }).click()
  await page.waitForURL(`${base}/plan/tour`)
  const single = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Add to calendar' }).click()
  expect(readFileSync(await (await single).path(), 'utf8').match(/BEGIN:VEVENT/g)).toHaveLength(1)
  await page.goto(`${base}/plan`)
  await page.getByRole('link', { name: 'Open ticket' }).click()
  await page.waitForURL(`${base}/tickets/ticket`)
  await expect(page.getByRole('heading', { name: 'Coffee tour ticket' })).toBeVisible()
  await page.goto(`${base}/plan`)
  await page.getByRole('radio', { name: /My phone/ }).click()
  await expect(page.getByText('Leave by 11:45')).toBeVisible()
  await page.getByRole('radio', { name: /Guatemala time/ }).click()
  await page.clock.fastForward(20 * 60_000)
  await expect(page.getByText('Suggested departure was 09:45')).toBeVisible()
  await page.clock.fastForward(30 * 60_000)
  await expect(page.getByRole('heading', { name: 'Up next for you' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('shared tasks create, assign, edit, filter, complete, reopen and remove while offline', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await seed(page)
  await page.goto(`${base}/more`)
  await page.getByRole('link', { name: 'Tasks', exact: true }).click()
  await page.waitForURL(`${base}/more/tasks`)
  await expect(page.getByRole('heading', { name: 'What needs doing?' })).toBeVisible()
  await page.getByRole('link', { name: 'Add task', exact: true }).click()
  await page.waitForURL(`${base}/more/tasks/new`)
  await page.getByLabel('Task', { exact: true }).fill('Book the airport shuttle for all eight friends')
  await page.getByLabel('Assigned to').selectOption(alex)
  await page.getByLabel('Due date').fill('2027-03-14')
  await page.getByLabel('Notes').fill('Eight seats, room for backpacks, pickup outside the hotel.')
  await page.setViewportSize({ width: 320, height: 844 })
  await page.screenshot({ path: 'test-results/features-task-form-320.png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Save task' }).click()
  await page.waitForURL(`${base}/more/tasks`)
  await expect(page.getByText('Overdue · 14 Mar 2027')).toBeVisible()
  await expect(page.getByText('Alex (you)')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: /Book the airport shuttle/ })).toBeVisible()
  await page.getByRole('button', { name: 'Assigned to me', exact: true }).click()
  await expect(page.getByRole('link', { name: /Book the airport shuttle/ })).toBeVisible()
  // The row moves to another section after the IndexedDB transaction completes.
  await page.getByRole('checkbox', { name: /Mark Book.*complete/ }).click()
  await expect(page.getByRole('heading', { name: 'Completed · 1' })).toBeVisible()
  await page.getByRole('checkbox', { name: /incomplete$/ }).click()
  await expect(page.getByRole('heading', { name: 'To do · 1' })).toBeVisible()
  await page.getByRole('link', { name: /Book the airport shuttle/ }).click()
  await page.waitForURL(/\/more\/tasks\/[0-9a-f-]+$/)
  await page.getByLabel('Task', { exact: true }).fill('Confirm the shuttle reservation')
  await page.getByLabel('Assigned to').selectOption(sam)
  await page.getByRole('button', { name: 'Save task' }).click()
  await page.waitForURL(`${base}/more/tasks`)
  await expect(page.getByText('Sam', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Assigned to me', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No tasks here' })).toBeVisible()
  await page.getByRole('button', { name: 'Everyone', exact: true }).click()
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await page.screenshot({ path: `test-results/features-tasks-${width}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/features-tasks-200-percent.png' })
  await page.evaluate(() => { document.documentElement.style.zoom = '' })
  await page.getByRole('checkbox').focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('heading', { name: 'Completed · 1' })).toBeVisible()
  await page.getByRole('link', { name: /Confirm the shuttle/ }).click()
  await page.waitForURL(/\/more\/tasks\/[0-9a-f-]+$/)
  await page.getByRole('button', { name: 'Remove task' }).click()
  await page.getByRole('button', { name: 'Confirm change' }).click()
  await page.waitForURL(`${base}/more/tasks`)
  await expect(page.getByRole('heading', { name: 'What needs doing?' })).toBeVisible()
  const queued = await page.evaluate(async () => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result) })
    const get = db.transaction('_outbox').objectStore('_outbox').getAll()
    return await new Promise<Record<string, unknown>[]>((resolve) => { get.onsuccess = () => { db.close(); resolve(get.result) } })
  })
  expect(queued).toHaveLength(1)
  expect(queued[0]).toMatchObject({ table: 'trip_tasks', payload: { title: 'Confirm the shuttle reservation', assignee_id: sam, completed: true, notes: 'Eight seats, room for backpacks, pickup outside the hotel.' } })
  expect((queued[0]?.payload as Record<string, unknown>).deleted_at).toBeTruthy()
  await page.goto(`${base}/more/tasks/missing-task`)
  await expect(page.getByText('This task is no longer available.')).toBeVisible()
  expect(errors).toEqual([])
})

test.use({ timezoneId: 'America/New_York', serviceWorkers: 'block' })
