import { expect, test, type Page } from '@playwright/test'

// Phase 2b screens with no live services: questions, rooms, consent and the waitlist on the trip page
// (stubbed RPCs), answers on the booking page, and the organizer's cards, rooming board and traveler list.
const shots = process.env.SHOTS_DIR ?? 'test-results'
const trip = '00000000-0000-4000-8000-000000000601'
const ana = '00000000-0000-4000-8000-000000000602'
const ola = '00000000-0000-4000-8000-000000000603'
const offerId = '00000000-0000-4000-8000-000000000604'
const questions = { dietary: true, accessibility: true, emergency_contact: false, custom: [{ id: 'tshirt', label: 'T-shirt size', required: true }] }
const rooms = [{ id: 'shared', label: 'Shared', price_delta_minor: 0, count: 8 }, { id: 'single', label: 'Single', price_delta_minor: 40000, count: 2 }]

async function shoot(page: Page, name: string) {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${shots}/${name}-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
}

async function stub(page: Page, answers: Record<string, unknown>) {
  await page.route('https://**/*', (route) => route.abort())
  for (const [fn, body] of Object.entries(answers)) {
    await page.route(`**/rest/v1/rpc/${fn}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }))
  }
  await page.route('**/auth/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'x', token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: { id: ola, aud: 'authenticated', role: 'authenticated', is_anonymous: true } }) }))
}

const offer = (over: Record<string, unknown> = {}) => ({
  slug: 'lake-week', title: 'Lake Atitlán week', summary: '', price_minor: 150000, deposit_minor: 0, balance_due_date: null, fee_mode: 'absorb', allow_bank: false,
  cancellation_policy: 'Tell us in writing.', policy_version: 2, schedule: [], refund_tiers: [], questions, rooms: rooms.map((r) => ({ ...r, left: r.id === 'single' ? 1 : 5 })),
  spots_left: 6, waitlist: true, trip: { name: 'Lake week', start_date: '2027-03-13', end_date: '2027-03-19', timezone: 'America/Guatemala' },
  organizer: { name: 'Ana Trips', email: 'ana@example.com' }, days: [], ...over,
})

test('booking asks the organizer’s questions, a room (with its price) and optional consent', async ({ page }) => {
  await stub(page, { get_public_offer: offer() })
  let sent: Record<string, unknown> | null = null
  await page.route('**/functions/v1/checkout-create', async (route) => { sent = route.request().postDataJSON(); await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'This trip is full' }) }) })
  await page.goto('/go/lake-week')
  await expect(page.getByText('Single (+$400.00): 1 left')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay $1,500.00 and reserve' })).toBeVisible()
  await page.getByRole('radio', { name: 'Single (+$400.00)' }).check()
  await expect(page.getByRole('button', { name: 'Pay $1,900.00 and reserve' })).toBeVisible()
  await page.getByLabel(/Your name/).fill('Ola')
  await page.getByLabel(/Email, for your receipt/).fill('ola@example.com')
  await page.getByLabel('Dietary needs (optional)').fill('Vegan')
  await page.getByLabel('T-shirt size', { exact: true }).fill('M')
  await page.getByLabel(/I’ve read and accept/).check()
  await expect(page.getByLabel(/Email me about future trips from Ana Trips/)).not.toBeChecked()
  await shoot(page, 'booking-questions')
  await page.getByRole('button', { name: 'Pay $1,900.00 and reserve' }).click()
  await expect(page.getByRole('alert')).toHaveText('This trip is full')
  expect(sent).toMatchObject({ slug: 'lake-week', extra: { answers: { dietary: 'Vegan', tshirt: 'M' }, consent: false, room_option: 'single' } })
})

test('a full trip offers the waitlist, and a held place greets its holder', async ({ page }) => {
  await stub(page, { get_public_offer: offer({ spots_left: 0 }), join_waitlist: 2, get_hold: { name: 'Wen', email: 'wen@example.com', hold_until: '2027-01-14T20:00:00Z' } })
  await page.goto('/go/lake-week')
  await expect(page.getByText('This trip is full.')).toBeVisible()
  await page.getByLabel('Your name').fill('Xu')
  await page.getByLabel('Email').fill('xu@example.com')
  await page.getByRole('button', { name: 'Join the waitlist' }).click()
  await expect(page.getByRole('status')).toHaveText(/You’re on the waitlist, number 2\./)
  await shoot(page, 'waitlist-joined')
  await page.goto('/go/lake-week#hold=held-token-123')
  await page.reload()
  await expect(page.getByText('Your place is held, Wen, until Thursday 14 January, 2:00 PM (Guatemala time).')).toBeVisible()
  await expect(page.getByLabel(/Your name/)).toHaveValue('Wen')
  await shoot(page, 'waitlist-hold')
})

test('the booking page lets a traveler change their answers', async ({ page }) => {
  await stub(page, {
    get_booking: { id: 'b1', status: 'active', trip_id: trip, traveler_name: 'Ola', price_minor: 190000, deposit_minor: 30000, paid_minor: 30000, refunded_minor: 0, balance_due_date: '2027-02-01', fee_mode: 'absorb', processing: false,
      schedule: [], next_minor: 160000, next_date: '2027-02-01', answers: { tshirt: 'M' }, room_option: 'single',
      offer: { slug: 'lake-week', title: 'Lake Atitlán week', allow_bank: false, status: 'published', refund_tiers: [], questions, room_options: rooms }, organizer: { name: 'Ana Trips', email: 'ana@example.com' } },
    update_booking_answers: { tshirt: 'L', dietary: 'Vegan' },
  })
  await page.goto('/b#t=secret-token-1234567890')
  await expect(page.getByRole('heading', { name: 'What Ana Trips asked' })).toBeVisible()
  await expect(page.getByLabel('T-shirt size', { exact: true })).toHaveValue('M')
  await page.getByLabel('T-shirt size', { exact: true }).fill('L')
  await page.getByRole('button', { name: 'Save answers' }).click()
  await expect(page.getByText('Saved. Your organizer sees the change.')).toBeVisible()
  await shoot(page, 'booking-answers')
})

test('the organizer sets questions and rooms, reads answers and fills the rooming board offline', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }))
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'Trip ideas', level: 1 })).toBeVisible()
  await page.evaluate(async ({ trip, ana, ola, offerId, questions, rooms }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction(['trips', 'members', 'trip_offers', 'bookings'], 'readwrite')
    tx.objectStore('trips').put({ id: trip, name: 'E2E TEST rooms', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-19', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local', settings: {}, created_by: ana, access_mode: 'hosted', access_epoch: 1 })
    for (const [id, name] of [[ana, 'Ana'], [ola, 'Ola']]) tx.objectStore('members').put({ id, trip_id: trip, deleted_at: null, display_name: name, color: null })
    tx.objectStore('trip_offers').put({ id: offerId, trip_id: trip, organizer_id: 'org', status: 'published', slug: 'lake-week', title: 'Lake Atitlán week', summary: '', currency: 'usd', price_minor: 150000, deposit_minor: 30000, balance_due_date: '2027-02-01', capacity: 2, cancellation_policy: 'Refundable until 60 days before.', policy_version: 1, fee_mode: 'absorb', allow_bank: true, published_at: '2026-11-01T00:00:00Z', deleted_at: null, schedule: [], refund_tiers: [], questions, room_options: rooms })
    const booking = (id: string, name: string, member: string | null, answers: Record<string, string>, room: string) => ({ id, trip_id: trip, offer_id: offerId, organizer_id: 'org', member_id: member, traveler_name: name, traveler_email: `${name.toLowerCase()}@example.com`, status: 'active', price_minor: 150000, deposit_minor: 30000, paid_minor: 30000, refunded_minor: 0, balance_due_date: '2027-02-01', fee_mode: 'absorb', policy_version: 1, policy_accepted_at: '2026-11-01T00:00:00Z', started_by_user: null, created_at: '2026-11-01T00:00:00Z', deleted_at: null, answers, room_option: room })
    tx.objectStore('bookings').put(booking('b1', 'Ola', ola, { dietary: 'Vegan', tshirt: 'M' }, 'single'))
    tx.objectStore('bookings').put(booking('b2', 'Pat', null, { accessibility: 'Ground floor', tshirt: 'S' }, 'shared'))
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    const access = { role: 'owner', mode: 'hosted', epoch: 1, removed: false, canRemove: true, organized: true, removedMembers: [] }
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: ana, joinedAt: '2026-11-01T00:00:00Z' } }, access: { [trip]: access }, quizSeen: true, timeView: 'trip', basemap: 'offline', moneyView: 'base' }, version: 1 }))
  }, { trip, ana, ola, offerId, questions, rooms })
  await page.goto(`/t/${trip}/more/payments`)
  await expect(page.getByRole('heading', { name: 'Questions at booking' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Dietary needs' })).toBeChecked()
  await expect(page.getByLabel('Your question 1')).toHaveValue('T-shirt size')
  await expect(page.getByLabel('Room type 2', { exact: true })).toHaveValue('Single')
  await expect(page.getByLabel('Room type 2: extra price ($)')).toHaveValue('400')
  await shoot(page, 'organizer-questions-rooms')
  await page.getByRole('button', { name: 'Travelers’ answers' }).click()
  const sheet = page.getByRole('dialog', { name: 'Travelers’ answers' })
  await expect(sheet.getByText('Ground floor')).toBeVisible()
  await shoot(page, 'answers-sheet')
  await sheet.getByRole('button', { name: /Close/ }).click()

  await page.getByRole('link', { name: 'Rooming board: who sleeps where' }).click()
  await page.waitForURL(`**/more/payments/rooming`)
  await expect(page.getByRole('heading', { name: 'Unassigned (2)' })).toBeVisible()
  await page.getByLabel('New room name').fill('Casa 1')
  await page.getByRole('button', { name: 'Add room' }).click()
  await page.getByLabel('Room for Ola').selectOption('Casa 1')
  await expect(page.getByRole('heading', { name: 'Casa 1 (1)' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Unassigned (1)' })).toBeVisible()
  await shoot(page, 'rooming-board')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Rooming list for the hotel (CSV)' }).click()
  expect((await download).suggestedFilename()).toBe('e2e-test-rooms-rooming.csv')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Casa 1 (1)' })).toBeVisible() // saved on the phone
})

test('the traveler list searches, filters by tag and edits notes', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort())
  await page.route('**/rest/v1/rpc/my_organizer', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'org', display_name: 'Ana Trips', support_email: 'ana@example.com', slug: 'ana', reviewed: true, pro: true, beta: true }) }))
  await page.route('**/rest/v1/organizer_contacts*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
    { id: 'c1', email: 'ola@example.com', name: 'Ola', trips: 2, total_paid_minor: 300000, last_trip_on: '2027-03-13', tags: ['repeat'], notes: '', marketing_consent: true, unsubscribed_at: null },
    { id: 'c2', email: 'pat@example.com', name: 'Pat', trips: 1, total_paid_minor: 150000, last_trip_on: '2027-03-13', tags: [], notes: '', marketing_consent: false, unsubscribed_at: null },
  ]) }))
  await page.route('**/rest/v1/rpc/save_contact', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'c2', tags: ['vip'], notes: 'Loves kayaks' }) }))
  await page.goto('/organize/travelers')
  await expect(page.getByRole('button', { name: /Ola ola@example\.com/ })).toContainText('2 trips · $3,000 · emails OK')
  await page.getByRole('button', { name: 'repeat', exact: true }).click()
  await expect(page.getByRole('button', { name: /Pat/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await page.getByRole('button', { name: /Pat pat@example\.com/ }).click()
  await page.getByLabel('Tags, separated by commas').fill('vip')
  await page.getByLabel('Notes (only you see these)').fill('Loves kayaks')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'vip', exact: true })).toBeVisible() // the new tag is now a filter
  await shoot(page, 'travelers')
})
