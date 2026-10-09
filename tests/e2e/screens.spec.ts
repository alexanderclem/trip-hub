import { expect, test, type Page } from '@playwright/test'

// Screenshots of every trip screen with realistic content, for reviewing the UI by eye.
// All fixtures are local: nothing reaches the backend and no real trip is touched.
// Runs only when SHOTS_DIR is set: SHOTS_DIR=<dir> npx playwright test tests/e2e/screens.spec.ts
const shots = process.env.SHOTS_DIR
const tripId = '00000000-0000-4000-8000-000000000c01'
const me = '00000000-0000-4000-8000-000000000c02'
const friend = '00000000-0000-4000-8000-000000000c03'
const pollId = '00000000-0000-4000-8000-000000000c04'
const dinner = '00000000-0000-4000-8000-000000000c10'
const cafe = '00000000-0000-4000-8000-000000000c20'
const expense = '00000000-0000-4000-8000-000000000c30'
const ticket = '00000000-0000-4000-8000-000000000c40'
const root = `/t/${tripId}`

async function seed(page: Page, baseURL: string) {
  await page.route(url => url.protocol === 'https:' && url.origin !== new URL(baseURL).origin, route => route.abort())
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }))
  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  await page.evaluate(async (ids) => {
    const { tripId, me, friend, pollId, dinner, cafe, expense, ticket } = ids
    const req = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
    const stores = ['trips', 'members', 'places', 'polls', 'poll_options', 'itinerary_items', 'expenses', 'attachments', 'trip_tasks', 'day_notes']
    const tx = db.transaction(stores, 'readwrite')
    const put = (store: string, row: Record<string, unknown>) => tx.objectStore(store).put({ trip_id: tripId, deleted_at: null, created_at: '2026-10-01T12:00:00Z', ...row })
    const zone = 'America/Guatemala'
    tx.objectStore('trips').put({ id: tripId, name: 'E2E TEST screens', timezone: zone, start_date: '2027-03-13', end_date: '2027-03-16', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-screens-only', settings: {}, deleted_at: null })
    put('members', { id: me, display_name: 'Alex', color: '#396673', avatar_emoji: null, home_timezone: null })
    put('members', { id: friend, display_name: 'Maya', color: '#b45309', avatar_emoji: null, home_timezone: null })
    const place = (id: string, name: string, category: string, status: string, lat: number, lng: number) =>
      put('places', { id, name, category, status, lat, lng, tags: [], address: null, area: 'Antigua', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' })
    place(dinner, 'Hector’s Bistro', 'food', 'booked', 14.5604, -90.7341)
    place(cafe, 'Café Sabor', 'drink', 'shortlist', 14.5572, -90.7334)
    place('00000000-0000-4000-8000-000000000c21', 'Cerro de la Cruz', 'sight', 'planned', 14.5665, -90.7305)
    const item = (id: string, title: string, kind: string, start: string, end: string | null, extra: Record<string, unknown> = {}) =>
      put('itinerary_items', { id, title, kind, place_id: null, to_place_id: null, all_day: false, start_local: start, start_tz: zone, end_local: end, end_tz: end ? zone : null, start_at: `${start}:00-06:00`, end_at: end ? `${end}:00-06:00` : null, status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null, ...extra })
    item('00000000-0000-4000-8000-000000000c11', 'Flight to Guatemala City', 'flight', '2027-03-13T08:15', '2027-03-13T12:40', { confirmation_code: 'QK7R2M' })
    item('00000000-0000-4000-8000-000000000c12', 'Shuttle to Antigua', 'transport', '2027-03-13T13:30', '2027-03-13T15:00', { status: 'tentative' })
    item(dinner.replace('c10', 'c13'), 'Dinner at Hector’s', 'meal', '2027-03-13T19:00', '2027-03-13T21:00', { place_id: dinner, est_cost_minor: 12000, est_cost_currency: 'USD', notes: 'Booked under Maya.' })
    item('00000000-0000-4000-8000-000000000c14', 'Hike Cerro de la Cruz', 'activity', '2027-03-14T07:30', '2027-03-14T09:30', { place_id: '00000000-0000-4000-8000-000000000c21' })
    put('day_notes', { id: '00000000-0000-4000-8000-000000000c15', date: '2027-03-13', title: null, notes: 'Bring cash for the shuttle.' })
    put('polls', { id: pollId, title: 'Where do we stay at the lake?', description: null, status: 'open', kind: 'options', winner_option_id: null, closes_at: null })
    for (const [n, label] of ['Casa del Mundo', 'La Iguana Perdida', 'Lush Atitlán'].entries())
      put('poll_options', { id: `00000000-0000-4000-8000-000000000c5${n}`, poll_id: pollId, label, place_id: null, url: null, description: null })
    put('expenses', { id: expense, description: 'Airport shuttle', category: 'transport', spent_on: '2027-03-13', amount_minor: 8000, currency: 'USD', fx_rate: 1, base_currency: 'USD', base_amount_minor: 8000, payers: [{ member_id: friend, amount_minor: 8000 }], split_method: 'equal', split: [{ member_id: me, value: 1 }, { member_id: friend, value: 1 }], fx_source: 'same', fx_as_of: null, place_id: null, item_id: null, notes: null })
    put('expenses', { id: expense.replace('c30', 'c31'), description: 'Groceries', category: 'groceries', spent_on: '2027-03-12', amount_minor: 4250, currency: 'USD', fx_rate: 1, base_currency: 'USD', base_amount_minor: 4250, payers: [{ member_id: me, amount_minor: 4250 }], split_method: 'equal', split: [{ member_id: me, value: 1 }, { member_id: friend, value: 1 }], fx_source: 'same', fx_as_of: null, place_id: null, item_id: null, notes: null })
    put('attachments', { id: ticket, item_id: '00000000-0000-4000-8000-000000000c11', place_id: null, expense_id: null, kind: 'ticket', title: 'Boarding pass', confirmation_code: 'QK7R2M', storage_path: 'local/boarding.pdf', filename: 'boarding.pdf', mime: 'application/pdf', bytes: 1200, sha256: 'x', uploaded_at: '2026-10-01T12:00:00Z' })
    put('trip_tasks', { id: '00000000-0000-4000-8000-000000000c60', title: 'Book the lake shuttle', assignee_id: me, due_date: '2027-03-01', completed: false, notes: null })
    put('trip_tasks', { id: '00000000-0000-4000-8000-000000000c61', title: 'Check passports', assignee_id: null, due_date: null, completed: true, notes: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { quizSeen: true, trips: { [tripId]: { tripId, memberId: me, joinedAt: '2026-10-09T12:00:00Z' } } }, version: 1 }))
    sessionStorage.setItem('stowaway-install-dismissed', '1')
  }, { tripId, me, friend, pollId, dinner, cafe, expense, ticket })
}

const screens: [name: string, path: string][] = [
  ['overview', 'overview'],
  ['plan', 'plan?day=2027-03-13'],
  ['plan-item', `plan/${dinner.replace('c10', 'c13')}`],
  ['plan-new', 'plan/new?day=2027-03-13'],
  ['map', 'map'],
  ['vote', 'more/vote'],
  ['vote-poll', `more/vote/${pollId}`],
  ['money', 'money'],
  ['money-new', 'money/new'],
  ['tickets', 'tickets'],
  ['place-new', 'more/places/new'],
  ['more', 'more'],
  ['tasks', 'more/tasks'],
  ['packing', 'more/packing'],
  ['places', 'more/places'],
  ['place', `more/places/${dinner}`],
  ['settings', 'more/settings'],
  ['emergency', 'more/emergency'],
  ['activity', 'activity'],
]

for (const width of [390, 1440]) {
  test(`trip screens at ${width}px`, async ({ page, baseURL }) => {
    test.skip(!shots, 'Set SHOTS_DIR to capture screenshots.')
    test.setTimeout(240_000)
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await seed(page, baseURL!)
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    for (const [name, path] of screens) {
      await page.goto(`${root}/${path}`)
      await (name === 'map' ? page.getByRole('button', { name: /Filters/ }) : page.getByRole('heading', { level: 1 }).first()).waitFor()
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${shots}/${name}-${width}.png` })
      // The screen itself scrolls inside the shell, so a full-page capture needs the content's own height.
      const tall = await page.locator('#trip-content').evaluate(el => el.scrollHeight)
      if (tall > 900) {
        await page.setViewportSize({ width, height: Math.min(tall + 200, 5000) })
        await page.screenshot({ path: `${shots}/${name}-${width}-full.png` })
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      }
    }
    expect(errors).toEqual([])
  })
}
