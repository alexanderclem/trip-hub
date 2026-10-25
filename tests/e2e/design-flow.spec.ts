import { expect, test, type Page } from '@playwright/test'

// Disposable local fixtures only: no anonymous sign-ins or live Supabase writes.
test.use({ serviceWorkers: 'block', storageState: { cookies: [], origins: [] } })
const tripId = '00000000-0000-4000-8000-000000000981'
const memberId = '00000000-0000-4000-8000-000000000982'
const flightId = '00000000-0000-4000-8000-000000000983'
const ticketId = '00000000-0000-4000-8000-000000000984'
const root = `/t/${tripId}`
const SHOTS = process.env.SHOTS_DIR

async function localTrip(page: Page, date: string) {
  await page.clock.setFixedTime(new Date(date))
  await page.route('**/*.supabase.co/**', (route) => route.abort())
  await page.route('**/api.open-meteo.com/**', (route) => route.abort())
  await page.addInitScript(({ tripId, memberId }) => {
    localStorage.setItem('trip-hub-device', JSON.stringify({ version: 1, state: {
      trips: { [tripId]: { tripId, memberId, joinedAt: '2027-03-01T12:00:00Z' } },
      quizSeen: true, setupDismissed: { [tripId]: true },
    } }))
  }, { tripId, memberId })
  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).some((d) => d.name === 'trip-hub'))).toBe(true)
  await page.evaluate(async ({ tripId, memberId, flightId, ticketId }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('trip-hub')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const tx = database.transaction(['trips', 'members', 'itinerary_items', 'attachments', 'trip_tasks'], 'readwrite')
    const base = { trip_id: tripId, created_at: '2027-03-01T12:00:00Z', updated_at: '2027-03-01T12:00:00Z', created_by: null, updated_by: null, deleted_at: null }
    tx.objectStore('trips').put({ ...base, id: tripId, name: 'E2E TEST A week away with good company', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-20', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only', settings: {} })
    tx.objectStore('members').put({ ...base, id: memberId, display_name: 'Alex', color: null, avatar_emoji: null })
    const item = { ...base, kind: 'activity', place_id: null, to_place_id: null, start_tz: 'America/Guatemala', end_tz: 'America/Guatemala', all_day: false, attendee_ids: [memberId], status: 'confirmed', confirmation_code: null, notes: '', estimated_cost: null, cost_currency: null }
    tx.objectStore('itinerary_items').put({ ...item, id: flightId, title: 'Flight to Guatemala City', kind: 'flight', start_local: '2027-03-13T08:15', end_local: '2027-03-13T12:40', start_at: '2027-03-13T14:15:00Z', end_at: '2027-03-13T18:40:00Z' })
    tx.objectStore('itinerary_items').put({ ...item, id: crypto.randomUUID(), title: 'Dinner with the group', kind: 'meal', start_local: '2027-03-13T19:00', end_local: '2027-03-13T21:00', start_at: '2027-03-14T01:00:00Z', end_at: '2027-03-14T03:00:00Z' })
    tx.objectStore('itinerary_items').put({ ...item, id: crypto.randomUUID(), title: 'Evening walking tour', status: 'tentative', start_local: '2027-03-13T19:30', end_local: '2027-03-13T20:30', start_at: '2027-03-14T01:30:00Z', end_at: '2027-03-14T02:30:00Z' })
    tx.objectStore('itinerary_items').put({ ...item, id: crypto.randomUUID(), title: 'Hotel for the week', kind: 'lodging', start_local: '2027-03-13T15:00', end_local: '2027-03-20T11:00', start_at: '2027-03-13T21:00:00Z', end_at: '2027-03-20T17:00:00Z' })
    tx.objectStore('itinerary_items').put({ ...item, id: crypto.randomUUID(), title: 'Arrival day', all_day: true, start_local: '2027-03-13T00:00', end_local: null, start_at: '2027-03-13T06:00:00Z', end_at: null })
    tx.objectStore('attachments').put({ ...base, id: ticketId, item_id: flightId, name: 'Boarding pass', mime: 'application/pdf', size: 128, storage_path: `${tripId}/${ticketId}/pass.pdf`, text: null })
    tx.objectStore('trip_tasks').put({ ...base, id: crypto.randomUUID(), title: 'Book the shuttle', notes: '', assignee_id: memberId, due_date: '2027-03-12', completed: false })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    database.close()
  }, { tripId, memberId, flightId, ticketId })
}

async function screenshot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
}

test('new trip starts with two fields and optional details keep their values', async ({ page }) => {
  await page.goto('/new')
  await expect(page.getByRole('heading', { name: 'Create your trip.' })).toBeVisible()
  await expect(page.getByLabel('Trip name', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Your name')).toBeVisible()
  await expect(page.getByLabel('Starts', { exact: true })).not.toBeVisible()
  await expect(page.getByLabel('Destination time zone')).not.toBeVisible()
  await screenshot(page, 'create-390')
  const optional = page.getByText('Add dates and destination (optional)', { exact: true })
  await optional.click()
  await page.getByLabel('Starts', { exact: true }).fill('2027-03-13')
  await page.getByText('Time zone & currencies', { exact: true }).click()
  await page.getByLabel('Destination time zone').selectOption('Asia/Tokyo')
  await optional.click()
  await expect(page.getByText(/2027-03-13 · Asia\/Tokyo/)).toBeVisible()
  await optional.click()
  await expect(page.getByLabel('Starts', { exact: true })).toHaveValue('2027-03-13')
  await expect(page.getByLabel('Destination time zone')).toHaveValue('Asia/Tokyo')
  await page.setViewportSize({ width: 320, height: 740 })
  await noOverflow(page)
})

test('compact agenda preserves overlaps, all-day items, stays and ticket shortcuts offline', async ({ page, context }) => {
  await localTrip(page, '2027-03-01T12:00:00Z')
  await page.goto(`${root}/plan?day=2027-03-13`)
  const agenda = page.getByRole('list', { name: 'Agenda', exact: true })
  await expect(agenda).toBeVisible()
  await expect(page.getByRole('button', { name: 'Agenda', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(agenda.getByRole('heading')).toHaveText(['Flight to Guatemala City', 'Dinner with the group', 'Evening walking tour'])
  await expect(agenda.getByText('08:15–12:40', { exact: true })).toBeVisible()
  await expect(agenda.getByText('Overlaps another item', { exact: true })).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Staying at Hotel for the week' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Arrival day All day' })).toBeVisible()
  await expect(agenda.getByRole('link', { name: 'Open ticket for Flight to Guatemala City' })).toHaveAttribute('href', `${root}/tickets/${ticketId}`)
  expect(await agenda.boundingBox().then((box) => box!.height)).toBeLessThan(650)
  await screenshot(page, 'agenda-390')
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Timeline', exact: true }).click()
  await expect(page.getByLabel('Timeline', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Flight to Guatemala City, / })).toBeVisible()
  await page.getByRole('button', { name: 'Agenda', exact: true }).click()
  await expect(agenda).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await noOverflow(page)
  await screenshot(page, 'agenda-1440')
  await page.setViewportSize({ width: 320, height: 740 })
  await noOverflow(page)
  await screenshot(page, 'agenda-320')
})

test('trip dates can be added later offline without resetting a draft during sync', async ({ page, context }) => {
  await localTrip(page, '2027-03-01T12:00:00Z')
  await page.goto(`${root}/more/settings`)
  await page.getByText('Trip details', { exact: true }).click()
  const name = page.getByLabel('Trip name', { exact: true })
  await name.fill('E2E TEST Edited trip')
  // A background local-data refresh must not replace what the person has typed.
  await page.evaluate(async (tripId) => {
    const db = await new Promise<IDBDatabase>((resolve) => { const req = indexedDB.open('trip-hub'); req.onsuccess = () => resolve(req.result) })
    const tx = db.transaction('trips', 'readwrite')
    const store = tx.objectStore('trips')
    const req = store.get(tripId)
    req.onsuccess = () => store.put({ ...req.result, name: 'Incoming group edit' })
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve() })
    db.close()
  }, tripId)
  await expect(name).toHaveValue('E2E TEST Edited trip')
  await page.getByLabel('Starts', { exact: true }).fill('2027-04-10')
  await page.getByLabel('Ends', { exact: true }).fill('2027-04-17')
  await page.getByLabel('Destination time zone').fill('Asia/Tokyo')
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Save trip details', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Trip details saved on this phone.' })).toBeVisible()
  await context.setOffline(false)
  await page.reload()
  await page.getByText('Trip details', { exact: true }).click()
  await expect(name).toHaveValue('E2E TEST Edited trip')
  await expect(page.getByLabel('Starts', { exact: true })).toHaveValue('2027-04-10')
  await expect(page.getByLabel('Destination time zone')).toHaveValue('Asia/Tokyo')
})

for (const [phase, date] of [['planning', '2027-03-01'], ['preparing', '2027-03-10'], ['traveling', '2027-03-13']] as const) {
  test(`Home prioritizes ${phase} without changing the navigation`, async ({ page }) => {
    await localTrip(page, `${date}T14:00:00Z`)
    await page.goto(`${root}/overview`)
    await expect(page.getByRole('heading', { name: 'E2E TEST A week away with good company' })).toBeVisible()
    const headings = page.locator('#trip-content h2').filter({ visible: true })
    if (phase === 'planning') {
      await expect(headings.first()).toHaveText('Needs you')
      await expect(page.getByRole('button', { name: 'Download all', exact: true })).toHaveCount(0)
    } else {
      await expect(headings.first()).toHaveText(phase === 'traveling' ? 'Up next for you' : 'Prepare for departure')
      await expect(page.getByRole('button', { name: 'Download all', exact: true })).toBeVisible()
    }
    const tabs = page.getByRole('navigation', { name: 'Trip navigation' }).filter({ visible: true }).getByRole('link')
    await expect(tabs).toHaveText(['Home', 'Plan', 'Map', 'Vote', 'More'])
    await noOverflow(page)
    await screenshot(page, `home-${phase}-390`)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await noOverflow(page)
    await screenshot(page, `home-${phase}-1440`)
  })
}
