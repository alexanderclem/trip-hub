import { expect, test, type Page } from '@playwright/test'

// Phase 2a screens, with no live services: payment plans and refund steps on the trip and booking
// pages (stubbed RPCs), and the organizer's plan, refund sheet and dispute evidence from IndexedDB.
const shots = process.env.SHOTS_DIR ?? 'test-results'
const trip = '00000000-0000-4000-8000-000000000501'
const ana = '00000000-0000-4000-8000-000000000502'
const ola = '00000000-0000-4000-8000-000000000503'
const offerId = '00000000-0000-4000-8000-000000000504'
const bookingId = '00000000-0000-4000-8000-000000000505'
const schedule = [{ due_date: '2026-12-01', amount_minor: 60000 }, { due_date: '2027-02-01', amount_minor: 60000 }]
const tiers = [{ days_before: 60, percent: 100 }, { days_before: 30, percent: 50 }]

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
}

test('the trip page shows the payment plan and the refund steps', async ({ page }) => {
  await stub(page, { get_public_offer: {
    slug: 'lake-week', title: 'Lake Atitlán week', summary: '', price_minor: 150000, deposit_minor: 30000, balance_due_date: '2027-02-01', fee_mode: 'absorb', allow_bank: false,
    cancellation_policy: 'Tell us in writing.', policy_version: 2, schedule, refund_tiers: tiers, spots_left: 3,
    trip: { name: 'Lake week', start_date: '2027-03-13', end_date: '2027-03-19', timezone: 'America/Guatemala' }, organizer: { name: 'Ana Trips', email: 'ana@example.com' }, days: [],
  } })
  await page.goto('/go/lake-week')
  await expect(page.getByText('$300.00 deposit now, then $600.00 by Dec 1, 2026, $600.00 by Feb 1, 2027.')).toBeVisible()
  await page.getByText('Cancellation and refund policy', { exact: true }).click()
  await expect(page.getByText('100% back if you cancel 60 or more days before the trip')).toBeVisible()
  await expect(page.getByText('50% back if you cancel 30 or more days before the trip')).toBeVisible()
  await shoot(page, 'trip-page-plan')
})

test('the booking page offers the next installment or everything left', async ({ page }) => {
  await stub(page, { get_booking: {
    id: bookingId, status: 'active', trip_id: trip, traveler_name: 'Ola', price_minor: 150000, deposit_minor: 30000, paid_minor: 30000, refunded_minor: 0,
    balance_due_date: '2027-02-01', fee_mode: 'absorb', processing: false, schedule, next_minor: 60000, next_date: '2026-12-01',
    offer: { slug: 'lake-week', title: 'Lake Atitlán week', allow_bank: false, status: 'published', refund_tiers: tiers }, organizer: { name: 'Ana Trips', email: 'ana@example.com' },
  } })
  let asked: unknown = null
  await page.route('**/functions/v1/checkout-create', async (route) => { asked = route.request().postDataJSON(); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: '/go/lake-week' }) }) })
  await page.goto('/b#t=secret-token-1234567890')
  await expect(page.getByText('Next: $600.00 by Dec 1, 2026. $1,200.00 left in all.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay $600.00 now' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay everything left ($1,200.00)' })).toBeVisible()
  await shoot(page, 'manage-booking-plan')
  await page.route('**/auth/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'x', token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: { id: ola, aud: 'authenticated', role: 'authenticated', is_anonymous: true } }) }))
  await page.getByRole('button', { name: 'Pay everything left ($1,200.00)' }).click()
  await expect.poll(() => asked).toEqual({ token: 'secret-token-1234567890', all: true })
})

test('the organizer plans payments, opens a refund with the policy’s suggestion, and prints evidence', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }))
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'Trip ideas', level: 1 })).toBeVisible()
  await page.evaluate(async ({ trip, ana, ola, offerId, bookingId, schedule, tiers }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction(['trips', 'members', 'trip_offers', 'bookings', 'booking_payments', 'itinerary_items'], 'readwrite')
    tx.objectStore('trips').put({ id: trip, name: 'E2E TEST lake week 2027', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-19', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local', settings: {}, created_by: ana, access_mode: 'hosted', access_epoch: 1 })
    for (const [id, name] of [[ana, 'Ana'], [ola, 'Ola']]) tx.objectStore('members').put({ id, trip_id: trip, deleted_at: null, display_name: name, color: null, created_at: '2026-11-01T10:05:00Z' })
    tx.objectStore('trip_offers').put({ id: offerId, trip_id: trip, organizer_id: 'org', status: 'published', slug: 'lake-week', title: 'Lake Atitlán week', summary: '', currency: 'usd', price_minor: 150000, deposit_minor: 30000, balance_due_date: '2027-02-01', capacity: 12, cancellation_policy: 'Deposit refundable until 60 days before.', policy_version: 1, fee_mode: 'absorb', allow_bank: true, published_at: '2026-11-01T00:00:00Z', deleted_at: null, schedule, refund_tiers: tiers })
    tx.objectStore('bookings').put({ id: bookingId, trip_id: trip, offer_id: offerId, organizer_id: 'org', member_id: ola, traveler_name: 'Ola', traveler_email: 'ola@example.com', status: 'active', price_minor: 150000, deposit_minor: 30000, paid_minor: 90000, refunded_minor: 0, balance_due_date: '2027-02-01', fee_mode: 'absorb', policy_version: 1, policy_accepted_at: '2026-11-01T10:00:00Z', started_by_user: null, created_at: '2026-11-01T10:00:00Z', deleted_at: null, schedule })
    tx.objectStore('booking_payments').put({ id: 'p1', trip_id: trip, booking_id: bookingId, kind: 'deposit', base_minor: 30000, charged_minor: 30000, application_fee_minor: 300, status: 'succeeded', paid_at: '2026-11-01T10:01:00Z', refunded_minor: 0 })
    tx.objectStore('booking_payments').put({ id: 'p2', trip_id: trip, booking_id: bookingId, kind: 'installment', base_minor: 60000, charged_minor: 60000, application_fee_minor: 600, status: 'succeeded', paid_at: '2026-12-01T09:00:00Z', refunded_minor: 0 })
    tx.objectStore('itinerary_items').put({ id: 'i1', trip_id: trip, title: 'Welcome dinner', kind: 'meal', status: 'confirmed', start_local: '2027-03-13T19:00', start_tz: 'America/Guatemala', end_local: '2027-03-13T21:00', end_tz: 'America/Guatemala', all_day: false, deleted_at: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    const access = { role: 'owner', mode: 'hosted', epoch: 1, removed: false, canRemove: true, organized: true, removedMembers: [] }
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: ana, joinedAt: '2026-11-01T00:00:00Z' } }, access: { [trip]: access }, quizSeen: true, timeView: 'trip', basemap: 'offline', moneyView: 'base' }, version: 1 }))
  }, { trip, ana, ola, offerId, bookingId, schedule, tiers })
  await page.goto(`/t/${trip}/more/payments`)
  await expect(page.getByRole('heading', { name: 'Payment plan and refunds' })).toBeVisible()
  await expect(page.getByLabel('Payment 2 amount ($)')).toHaveValue('600')
  await expect(page.getByText('Adds up.')).toBeVisible()
  await page.getByLabel('Payment 2 amount ($)').fill('500')
  await expect(page.getByText('$1,100.00 of $1,200.00 planned.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save plan' })).toBeDisabled()
  await page.getByLabel('Payment 2 amount ($)').fill('600')
  await expect(page.getByRole('heading', { name: /Run this trip again/ })).toBeVisible()
  await shoot(page, 'organizer-plan')

  await page.getByRole('button', { name: 'Ola: refund, cancel or dispute evidence' }).click()
  const sheet = page.getByRole('dialog', { name: 'Ola’s booking' })
  await expect(sheet.getByText(/days before the trip, your policy gives back 100%: \$900\.00\./)).toBeVisible()
  await expect(sheet.getByLabel('Refund ($)')).toHaveValue('900')
  await shoot(page, 'refund-sheet')
  await sheet.getByRole('link', { name: 'Evidence for a dispute' }).click()
  await page.waitForURL(`**/more/payments/evidence/${bookingId}`)
  await expect(page.getByRole('heading', { name: 'Lake Atitlán week: booking record' })).toBeVisible()
  await expect(page.getByText('Connect to the internet to include the exact policy text.')).toBeVisible()
  await expect(page.getByText(/\$600\.00 \(installment\)/)).toBeVisible()
  await expect(page.getByText(/Welcome dinner/)).toBeVisible()
  await shoot(page, 'evidence')
})
