import { expect, test, type Page } from '@playwright/test'

// Phase 2c referrals with no live services: a booking page offers the traveler's own link, a trip page
// opened from one passes the code on.
const shots = process.env.SHOTS_DIR ?? 'test-results'
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

async function shoot(page: Page, name: string) {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${shots}/${name}-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
}

test('a traveler gets their own referral link, and a friend’s booking carries the code', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort())
  await page.route('**/rest/v1/rpc/get_booking', (r) => r.fulfill(json({
    id: 'b1', status: 'active', trip_id: 't', traveler_name: 'Ola', price_minor: 145000, deposit_minor: 30000, paid_minor: 30000, refunded_minor: 0,
    balance_due_date: '2027-02-01', fee_mode: 'absorb', processing: false, schedule: [], next_minor: 115000, next_date: '2027-02-01', credit_minor: 5000,
    referral: { code: 'AB12CD34', credit_minor: 5000 }, offer: { slug: 'lake-week', title: 'Lake Atitlán week', allow_bank: false, status: 'published', refund_tiers: [] },
    organizer: { name: 'Ana Trips', email: 'ana@example.com' },
  })))
  await page.goto('/b#t=secret-token-1234567890')
  await expect(page.getByText('Includes $50.00 off for friends you referred.')).toBeVisible()
  await expect(page.getByText(/\/go\/lake-week\?ref=AB12CD34$/)).toBeVisible()
  await shoot(page, 'referral-link')

  await page.route('**/rest/v1/rpc/get_public_offer', (r) => r.fulfill(json({
    slug: 'lake-week', title: 'Lake Atitlán week', summary: '', price_minor: 150000, deposit_minor: 30000, balance_due_date: '2027-02-01', fee_mode: 'absorb', allow_bank: false,
    cancellation_policy: 'Tell us in writing.', policy_version: 1, spots_left: 3, trip: { name: 'Lake week', start_date: '2027-03-13', end_date: null, timezone: 'America/Guatemala' },
    organizer: { name: 'Ana Trips', email: 'ana@example.com' }, days: [],
  })))
  await page.route('**/auth/v1/**', (r) => r.fulfill(json({ access_token: 'x', token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: { id: '00000000-0000-4000-8000-000000000801', aud: 'authenticated', role: 'authenticated', is_anonymous: true } })))
  let sent: { extra?: { ref?: string } } | null = null
  await page.route('**/functions/v1/checkout-create', async (r) => { sent = r.request().postDataJSON(); await r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'This trip is full' }) }) })
  await page.goto('/go/lake-week?ref=AB12CD34')
  await page.getByLabel(/Your name/).fill('Pat')
  await page.getByLabel(/Email, for your receipt/).fill('pat@example.com')
  await page.getByLabel(/I’ve read and accept/).check()
  await page.getByRole('button', { name: /and reserve/ }).click()
  await expect(page.getByRole('alert')).toHaveText('This trip is full')
  expect(sent!.extra?.ref).toBe('AB12CD34')
})
