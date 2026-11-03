import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

// Synthetic operator session and stubbed services only: no live trips, Stripe or email.
test.use({ serviceWorkers: 'block' })
const shots = process.env.SHOTS_DIR
const trip = '00000000-0000-4000-8000-000000000901'
const userId = '00000000-0000-4000-8000-000000000902'
const organizerId = '00000000-0000-4000-8000-000000000903'
const organizer = { id: organizerId, display_name: 'Ana Trips', support_email: 'ana@example.com', slug: 'ana', reviewed_at: '2026-11-01T00:00:00Z' }
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const bookings = [
  { trip_id: trip, status: 'active', price_minor: 150000, paid_minor: 30000, refunded_minor: 0 },
  { trip_id: trip, status: 'cancelled', price_minor: 150000, paid_minor: 30000, refunded_minor: 10000 },
  { trip_id: trip, status: 'refunded', price_minor: 150000, paid_minor: 30000, refunded_minor: 30000 },
  { trip_id: 'other-trip', status: 'paid', price_minor: 90000, paid_minor: 90000, refunded_minor: 0 },
]

async function stub(page: Page, signedIn = true) {
  await page.route('https://**/*', (r) => r.abort())
  await page.route('**/rest/v1/organizers*', (r) => r.fulfill(json(organizer)))
  await page.route('**/rest/v1/stripe_accounts*', (r) => r.fulfill(json({ stripe_account_id: 'acct_test', charges_enabled: true, payouts_enabled: true, details_submitted: true, requirements: {}, disabled_reason: null, disconnected_at: null, payout_schedule: { interval: 'daily', delay_days: 2 } })))
  await page.route('**/rest/v1/payouts*', (r) => r.fulfill(json([{ stripe_payout_id: 'po_test', amount_minor: 50000, arrival_date: '2026-11-02', status: 'paid', failure_code: null, failure_message: null }])))
  await page.route('**/rest/v1/disputes*', (r) => r.fulfill(json([])))
  await page.route('**/rest/v1/trip_offers*', (r) => r.fulfill(json([{ trip_id: trip, title: 'Lake week', status: 'published', capacity: 12 }])))
  await page.route('**/rest/v1/bookings*', (r) => {
    expect(new URL(r.request().url()).searchParams.get('deleted_at')).toBe('is.null')
    return r.fulfill(json(bookings))
  })
  await page.route('**/rest/v1/rpc/my_organizer', (r) => r.fulfill(json({ ...organizer, pro: true, beta: true, reviewed: true, referral_credit_minor: 0 })))
  await page.route('**/auth/v1/settings', (r) => r.fulfill(json({ external: { google: false, email: true } })))
  if (signedIn) {
    const user = { id: userId, email: 'ana@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {} }
    const expires = Math.floor(Date.now() / 1000) + 3600
    const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: expires, role: 'authenticated' })).toString('base64url')}.test`
    await page.addInitScript((session) => {
      localStorage.setItem('sb-croqjdvzbpcscdcshnet-auth-token', JSON.stringify(session))
    }, { access_token: token, refresh_token: 'test-refresh', expires_in: 3600, expires_at: expires, token_type: 'bearer', user })
  }
}

async function shoot(page: Page, name: string) {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (shots) await page.screenshot({ path: `${shots}/${name}-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
}

test('the dashboard waits for bookings, then keeps cancellation income out of occupancy and balances', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await stub(page)
  let release!: () => void
  const ready = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/rest/v1/bookings*', async (r) => { await ready; await r.fulfill(json(bookings)) })
  await page.goto('/organize')
  await expect(page.getByRole('heading', { name: 'Loading your operator dashboard…' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Lake week/ })).toHaveCount(0)
  release()
  const row = page.getByRole('button', { name: /Lake week/ })
  await expect(row).toContainText('1/12 · $500.00 in · $1,200.00 due')
  await shoot(page, 'operator-dashboard')
  await row.focus()
  await expect(row).toBeFocused()
  await expect(page.getByRole('link', { name: /Past travelers/ })).toHaveAttribute('href', '/organize/travelers')
  expect(errors).toEqual([])
})

test('failed bookings reads show a recoverable error instead of zero revenue', async ({ page }) => {
  await stub(page)
  let failed = true
  await page.route('**/rest/v1/bookings*', (r) => r.fulfill(failed ? json({ message: 'Bookings are temporarily unavailable.', code: 'TEST' }, 503) : json(bookings)))
  await page.goto('/organize')
  await expect(page.getByRole('alert')).toHaveText('Bookings are temporarily unavailable.')
  await expect(page.getByRole('button', { name: /Lake week/ })).toHaveCount(0)
  await shoot(page, 'operator-dashboard-error')
  failed = false
  await page.getByRole('button', { name: 'Try again' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /Lake week/ })).toContainText('$500.00 in')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('an offline dashboard can recover after reconnecting', async ({ page }) => {
  await stub(page)
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }))
  await page.goto('/organize')
  await expect(page.getByRole('alert')).toHaveText('Connect to the internet to see payouts.')
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true }))
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('button', { name: /Lake week/ })).toContainText('$500.00 in')
})

test('an organizer with no offers gets a useful empty state', async ({ page }) => {
  await stub(page)
  await page.route('**/rest/v1/trip_offers*', (r) => r.fulfill(json([])))
  await page.goto('/organize')
  await expect(page.getByText('No trip prices set yet.', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open your trips', exact: true })).toHaveAttribute('href', '/app')
  await shoot(page, 'operator-dashboard-empty')
})

test('signing in from the operator dashboard remembers where to return', async ({ page }) => {
  await stub(page, false)
  await page.goto('/organize')
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await page.waitForURL('**/signin')
  expect(await page.evaluate(() => sessionStorage.getItem('stowaway-signin-return'))).toBe('/organize')
})

test('report exports keep the period that was queried when the date inputs change or a new query fails', async ({ page }) => {
  await stub(page)
  let failed = false
  await page.route('**/rest/v1/rpc/organizer_report', (r) => r.fulfill(failed ? json({ message: 'Report unavailable.', code: 'TEST' }, 503) : json({
    trips: [{ trip_id: trip, title: 'Lake week', collected: 30000, stripe_fees: 900, stowaway_fees: 300, refunds: 0, net: 28800 }], payouts: 20000,
  })))
  await page.goto('/organize')
  await page.getByLabel('From', { exact: true }).fill('2026-01-01')
  await page.getByLabel('To', { exact: true }).fill('2026-01-31')
  await page.getByRole('button', { name: 'Show report' }).click()
  await expect(page.getByRole('status')).toHaveText('Report: 2026-01-01 to 2026-01-31.')
  await page.getByLabel('From', { exact: true }).fill('2026-02-01')
  await page.getByLabel('To', { exact: true }).fill('2026-02-28')
  failed = true
  await page.getByRole('button', { name: 'Show report' }).click()
  await expect(page.getByRole('alert')).toHaveText('Report unavailable.')
  await expect(page.getByRole('status')).toHaveText('Report: 2026-01-01 to 2026-01-31.')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download as CSV' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('stowaway-report-2026-01-01-to-2026-01-31.csv')
  const path = await file.path()
  expect(path).not.toBeNull()
  const csv = await readFile(path!, 'utf8')
  expect(csv).toContain('"2026-01-01","2026-01-31","Lake week","300.00"')
  expect(csv).not.toContain('2026-02')
  await shoot(page, 'operator-report')
})

test('a report shows bank payouts even in a period without traveler payments', async ({ page }) => {
  await stub(page)
  await page.route('**/rest/v1/rpc/organizer_report', (r) => r.fulfill(json({ trips: [], payouts: 20000 })))
  await page.goto('/organize')
  await page.getByRole('button', { name: 'Show report' }).click()
  await expect(page.getByText('No traveler payments or refunds in this period.')).toBeVisible()
  await expect(page.getByText('Paid out to your bank in this period: $200.00.')).toBeVisible()
})
