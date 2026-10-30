import { expect, test, type Page } from '@playwright/test'

// No live services: every request to the internet is refused, except the few Supabase answers each
// test stubs. The organizer screen reads its trip, offer and bookings from IndexedDB.
const shots = process.env.SHOTS_DIR ?? 'test-results'
const trip = '00000000-0000-4000-8000-000000000401'
const ana = '00000000-0000-4000-8000-000000000402'
const ola = '00000000-0000-4000-8000-000000000403'
const offerId = '00000000-0000-4000-8000-000000000404'

async function shoot(page: Page, name: string) {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${shots}/${name}-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
}

const publicOffer = {
  slug: 'lake-week', title: 'Lake Atitlán week', summary: 'Six nights by the lake.\nKayaks, a coffee farm and a volcano sunrise.',
  price_minor: 150000, deposit_minor: 30000, balance_due_date: '2027-02-01', fee_mode: 'absorb', allow_bank: true,
  cancellation_policy: 'Deposit refundable until 60 days before departure.', policy_version: 3, spots_left: 4,
  trip: { name: 'Lake week', start_date: '2027-03-13', end_date: '2027-03-19', timezone: 'America/Guatemala' },
  organizer: { name: 'Ana Trips', email: 'ana@example.com' },
  days: [{ date: '2027-03-13', items: ['Shuttle from Antigua', 'Welcome dinner'] }, { date: '2027-03-14', items: ['Kayak to San Juan'] }],
}
const booking = (over: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-000000000405', status: 'active', trip_id: trip, traveler_name: 'Ola', price_minor: 150000, deposit_minor: 30000,
  paid_minor: 30000, refunded_minor: 0, balance_due_date: '2027-02-01', fee_mode: 'absorb', processing: false,
  offer: { slug: 'lake-week', title: 'Lake Atitlán week', allow_bank: true, status: 'published' }, organizer: { name: 'Ana Trips', email: 'ana@example.com' }, ...over,
})

async function stub(page: Page, answers: Record<string, unknown>) {
  await page.route('https://**/*', (route) => route.abort())
  for (const [fn, body] of Object.entries(answers)) {
    await page.route(`**/rest/v1/rpc/${fn}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }))
  }
}

test('the trip page shows the price, plan and policy, and asks for name, email and consent', async ({ page }) => {
  await stub(page, { get_public_offer: publicOffer })
  await page.goto('/go/lake-week')
  await expect(page.getByRole('heading', { level: 1, name: 'Lake Atitlán week' })).toBeVisible()
  await expect(page.getByText('$300.00 deposit now, the remaining $1,200.00 by Feb 1, 2027.')).toBeVisible()
  await expect(page.getByText('4 places left.')).toBeVisible()
  await expect(page.getByText('Shuttle from Antigua · Welcome dinner')).toBeVisible()
  await page.getByText('Cancellation and refund policy', { exact: true }).click()
  await expect(page.getByText('Deposit refundable until 60 days before departure.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay $300.00 and reserve' })).toBeVisible()
  await shoot(page, 'trip-page')
  // The browser refuses to submit without consent.
  await page.getByLabel(/Your name/).fill('Ola')
  await page.getByLabel(/Email, for your receipt/).fill('ola@example.com')
  await page.getByRole('button', { name: 'Pay $300.00 and reserve' }).click()
  expect(await page.getByRole('checkbox').evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true)
})

test('a page that isn’t published says so', async ({ page }) => {
  await stub(page, { get_public_offer: null })
  await page.goto('/go/nothing-here')
  await expect(page.getByRole('heading', { level: 1, name: 'This trip page isn’t available' })).toBeVisible()
})

test('after paying, the traveler is told they’re in and gets their booking link', async ({ page }) => {
  await stub(page, { get_booking: booking() })
  await page.goto('/go/lake-week/booked#t=secret-token-1234567890')
  await expect(page.getByRole('heading', { level: 1, name: 'You’re in, Ola' })).toBeVisible()
  await expect(page.getByText('Ana Trips received $300.00. The remaining $1,200.00 is due by Feb 1, 2027.')).toBeVisible()
  await expect(page.getByText(/\/b#t=secret-token-1234567890$/)).toBeVisible()
  await shoot(page, 'booked')
})

test('a bank payment on its way is explained', async ({ page }) => {
  await stub(page, { get_booking: booking({ status: 'pending', paid_minor: 0, processing: true }) })
  await page.goto('/go/lake-week/booked#t=secret-token-1234567890')
  await expect(page.getByRole('heading', { level: 1, name: 'Your bank payment is on its way' })).toBeVisible()
})

test('the booking page shows what’s paid and offers the balance', async ({ page }) => {
  await stub(page, { get_booking: booking() })
  await page.goto('/b#t=secret-token-1234567890')
  await expect(page.getByRole('heading', { level: 1, name: 'Lake Atitlán week' })).toBeVisible()
  await expect(page.getByText('$1,200.00 is due by Feb 1, 2027.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay the balance' })).toBeVisible()
  await shoot(page, 'manage-booking')
})

test('the organizer prices the trip, sees bookings offline, and downloads them', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }))
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'Trip ideas', level: 1 })).toBeVisible()
  await page.evaluate(async ({ trip, ana, ola, offerId }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction(['trips', 'members', 'trip_offers', 'bookings'], 'readwrite')
    tx.objectStore('trips').put({ id: trip, name: 'E2E TEST lake week', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-19', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local', settings: {}, created_by: ana, access_mode: 'hosted', access_epoch: 1 })
    for (const [id, name] of [[ana, 'Ana'], [ola, 'Ola']]) tx.objectStore('members').put({ id, trip_id: trip, deleted_at: null, display_name: name, color: null })
    tx.objectStore('trip_offers').put({ id: offerId, trip_id: trip, organizer_id: 'org', status: 'published', slug: 'lake-week', title: 'Lake Atitlán week', summary: '', currency: 'usd', price_minor: 150000, deposit_minor: 30000, balance_due_date: '2027-02-01', capacity: 12, cancellation_policy: 'Deposit refundable until 60 days before.', policy_version: 1, fee_mode: 'absorb', allow_bank: true, published_at: '2026-11-01T00:00:00Z', deleted_at: null })
    tx.objectStore('bookings').put({ id: 'b1', trip_id: trip, offer_id: offerId, organizer_id: 'org', member_id: ola, traveler_name: 'Ola', traveler_email: 'ola@example.com', status: 'active', price_minor: 150000, deposit_minor: 30000, paid_minor: 30000, refunded_minor: 0, balance_due_date: '2027-02-01', fee_mode: 'absorb', policy_version: 1, policy_accepted_at: '2026-11-01T00:00:00Z', started_by_user: null, created_at: '2026-11-01T00:00:00Z', deleted_at: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    const access = { role: 'owner', mode: 'hosted', epoch: 1, removed: false, canRemove: true, organized: true, removedMembers: [] }
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: ana, joinedAt: '2026-11-01T00:00:00Z' } }, access: { [trip]: access }, quizSeen: true, timeView: 'trip', basemap: 'offline', moneyView: 'base' }, version: 1 }))
  }, { trip, ana, ola, offerId })
  await page.goto(`/t/${trip}/more`)
  await page.getByRole('link', { name: 'Payments' }).click()
  await page.waitForURL(`**/t/${trip}/more/payments`)
  await expect(page.getByText('Connect to the internet to see payouts.')).toBeVisible()
  await expect(page.getByLabel('Price per person ($)')).toHaveValue('1500')
  await expect(page.getByText(/Each traveler pays \$1,500\.00 \(\$300\.00 deposit, then \$1,200\.00 balance\)\. By card you keep about/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bookings (1 of 12)' })).toBeVisible()
  await expect(page.getByText('Collected $300.00 · still due $1,200.00')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download as CSV' }).click()
  expect((await download).suggestedFilename()).toBe('e2e-test-lake-week-bookings.csv')
  await shoot(page, 'organizer-payments')
})
