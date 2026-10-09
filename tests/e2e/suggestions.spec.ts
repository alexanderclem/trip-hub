import { expect, test, type Page } from '@playwright/test'

// Local-only fixtures: no anonymous accounts, production rows, or live network writes.
const trip = '00000000-0000-4000-8000-000000000201'
const alex = '00000000-0000-4000-8000-000000000202'
const sam = '00000000-0000-4000-8000-000000000203'
const inn = '00000000-0000-4000-8000-000000000204'
const base = `/t/${trip}`
const SHOTS = process.env.SHOTS_DIR
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

async function seed(page: Page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }))
  await page.route('https://**/*', (route) => route.abort())
  await page.clock.install({ time: new Date('2027-03-15T15:30:00Z') })
  await page.goto('/inspire/manual') // opens the local database, so the stores below exist
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  // The app creates its stores a moment after the screen appears; opening the database before then would find none.
  await page.waitForFunction(async () => (await indexedDB.databases()).some((d) => d.name === 'trip-hub' && (d.version ?? 0) > 1))
  await page.evaluate(async ({ trip, alex, sam, inn }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction(['trips', 'members', 'places', 'itinerary_items', 'trip_tasks', 'settlements', 'place_ratings'], 'readwrite')
    const made = '2027-03-14T12:00:00Z'
    const common = { trip_id: trip, deleted_at: null, created_at: made, updated_at: made, created_by: alex, updated_by: alex }
    tx.objectStore('trips').put({ id: trip, name: 'E2E TEST local suggestions', timezone: 'America/Guatemala', start_date: '2027-03-15', end_date: '2027-03-17', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only', settings: {} })
    for (const [id, name] of [[alex, 'Alex'], [sam, 'Sam']]) tx.objectStore('members').put({ ...common, created_by: null, id, display_name: name, color: null, avatar_emoji: null, home_timezone: null })
    // Antigua. Each 0.001° of latitude is about 110 m.
    const place = (id: string, name: string, category: string, north: number, over = {}) => tx.objectStore('places').put({ ...common, id, name, category, tags: [], lat: 14.5586 + north, lng: -90.7295, address: null, area: 'Antigua', status: 'catalog', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'osm', ...over })
    place(inn, 'Antigua Inn', 'lodging', 0, { status: 'booked' })
    place('near', 'Café Sabor', 'food', 0.002)
    place('listed', 'Rincón Típico', 'food', 0.003, { status: 'shortlist' })
    place('third', 'Fonda de la Calle', 'food', 0.004)
    place('far', 'Lakeside Grill', 'food', 0.5)
    place('museum', 'Museo del Jade', 'sight', 0.003, { tags: ['museum'] })
    tx.objectStore('itinerary_items').put({ ...common, id: 'stay', title: 'Antigua Inn', kind: 'lodging', place_id: inn, to_place_id: null, all_day: false, start_tz: 'America/Guatemala', end_tz: 'America/Guatemala', start_local: '2027-03-15T15:00', end_local: '2027-03-17T11:00', start_at: '2027-03-15T21:00:00Z', end_at: '2027-03-17T17:00:00Z', status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null })
    // Things that happened after they were added, for What's new.
    tx.objectStore('trip_tasks').put({ ...common, id: 'task', title: 'Book the shuttle', assignee_id: sam, due_date: null, completed: true, notes: null, updated_at: '2027-03-15T14:00:00Z', updated_by: sam })
    tx.objectStore('settlements').put({ ...common, id: 'paid', created_at: '2027-03-15T14:30:00Z', updated_at: '2027-03-15T14:30:00Z', created_by: sam, from_member_id: sam, to_member_id: alex, base_amount_minor: 2500, amount_minor: 2500, currency: 'USD', fx_rate: 1, paid_on: '2027-03-15', method: 'cash', note: null })
    tx.objectStore('place_ratings').put({ ...common, id: 'rating', place_id: 'near', member_id: sam, stars: 5, note: null, updated_at: '2027-03-15T15:00:00Z', updated_by: sam })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: alex, joinedAt: '2027-03-14T12:00:00Z' } }, quizSeen: true, timeView: 'trip', basemap: 'offline', moneyView: 'base' }, version: 1 }))
  }, { trip, alex, sam, inn })
}

test('ideas for a free day come from the pool, offline, and lead into the plan form', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await seed(page)
  await page.goto(`${base}/plan?day=2027-03-16`)
  const ideas = page.locator('section.ui-card', { has: page.getByRole('heading', { name: 'Ideas for this day' }) })
  await ideas.getByRole('button', { name: /Ideas for this day/ }).click()
  const breakfast = ideas.getByRole('region', { name: 'Breakfast' })
  // The well-rated one first, then the shortlisted one; the place 55 km away is never offered.
  await expect(breakfast.getByRole('listitem')).toHaveCount(2)
  await expect(breakfast.getByRole('listitem').first()).toContainText('Café Sabor')
  await expect(breakfast.getByRole('listitem').first()).toContainText('About 4 min walk from where you’re staying · The group rated it 5.0 ★')
  await expect(breakfast.getByRole('listitem').nth(1)).toContainText('Rincón Típico')
  await expect(ideas.getByRole('region', { name: 'Free time' })).toContainText('Museo del Jade')
  await expect(ideas).not.toContainText('Lakeside Grill')
  await expect(ideas).not.toContainText('Antigua Inn')
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await shot(page, `ideas-${width}`)
  }
  await page.setViewportSize({ width: 390, height: 844 })

  // Shortlisting keeps it on the card; turning it down removes it for good.
  await ideas.getByRole('button', { name: 'Shortlist: Café Sabor' }).click()
  await expect(ideas.getByRole('button', { name: 'Shortlist: Café Sabor' })).toHaveCount(0)
  await ideas.getByRole('button', { name: 'Not for us: Rincón Típico' }).click()
  await expect(ideas).not.toContainText('Rincón Típico')

  await ideas.getByRole('link', { name: 'Add to plan: Café Sabor' }).click()
  await page.waitForURL(/\/plan\/new\?day=2027-03-16&place=near&time=08:30$/)
  await expect(page.getByLabel('Name')).toHaveValue('Café Sabor')
  await expect(page.getByLabel('Start time', { exact: true })).toHaveValue('08:30')
  expect(errors).toEqual([])
})

test('what’s new reports completions, payments and ratings, and narrows by kind', async ({ page }) => {
  await seed(page)
  await page.goto(`${base}/activity`)
  const list = page.getByRole('list')
  await expect(list).toContainText('rated Café Sabor: 5 ★')
  await expect(list).toContainText('paid Alex $25.00')
  await expect(list).toContainText('completed a task: Book the shuttle')
  await shot(page, 'activity-all')
  const show = page.getByRole('group', { name: 'Show' })
  await expect(show.getByRole('button')).toHaveText(['All', 'Plan', 'Places', 'Money', 'Tasks'])
  await show.getByRole('button', { name: 'Money' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list).toContainText('paid Alex $25.00')
  await show.getByRole('button', { name: 'Tasks' }).click()
  await expect(list.getByRole('listitem')).toHaveText([/completed a task: Book the shuttle/, /added a task: Book the shuttle/])
  await shot(page, 'activity-tasks')
  await show.getByRole('button', { name: 'All' }).click()
  await expect(list).toContainText('joined the trip')
})
