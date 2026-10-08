import { expect, test, type Page } from '@playwright/test'

// A new person's first minutes, with Supabase stubbed: nothing is created or written.
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' })

const tripId = '11111111-1111-4111-8111-111111111111'
const pollId = '22222222-2222-4222-8222-222222222222'
const userId = '33333333-3333-4333-8333-333333333333'
const shareToken = 'stubbedInviteToken0001'
const now = '2026-10-08T12:00:00+00:00'
const trip = { id: tripId, name: 'Stubbed trip', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-20', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: shareToken, settings: {}, created_at: now, updated_at: now, deleted_at: null, created_by: null, updated_by: null }
const user = { id: userId, is_anonymous: true, app_metadata: {}, user_metadata: {} }
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', is_anonymous: true })).toString('base64url')}.test`
const session = { access_token: jwt, refresh_token: 'test-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user }

async function stub(page: Page) {
  await page.route('**/auth/v1/settings', (route) => route.fulfill(json({ external: { google: false, email: false } })))
  await page.route('**/auth/v1/signup**', (route) => route.fulfill(json(session)))
  await page.route('**/auth/v1/user', (route) => route.fulfill(json(user)))
  await page.route('**/auth/v1/token**', (route) => route.fulfill(json(session)))
  await page.route('**/rest/v1/**', (route) => route.fulfill(json([])))
  await page.route('**/rest/v1/trips**', (route) => route.fulfill(json([trip])))
  await page.route('**/rest/v1/rpc/join_trip', (route) => route.fulfill(json(tripId)))
  await page.route('**/rest/v1/rpc/create_member_and_claim', (route) => route.fulfill({ status: 204 }))
}

const addMe = async (page: Page) => {
  await page.getByPlaceholder('Your name').fill('Sam')
  await page.getByRole('button', { name: 'Add me' }).click()
}

test('joining goes to Stowie’s quiz, then a welcome on the overview, and is not asked twice', async ({ page }) => {
  await stub(page)
  await page.goto(`/join#t=${shareToken}`)
  await addMe(page)

  await page.waitForURL(/\/quiz\?next=/)
  await expect(page.getByRole('heading', { name: 'What kind of traveler are you?' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip for now' }).click()

  await page.waitForURL(/\/overview/)
  const welcome = page.getByRole('status', { name: 'Welcome from Stowie' })
  await expect(welcome).toContainText('You’re in.')
  await expect(welcome.getByRole('link', { name: 'See the votes' })).toBeVisible()
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/74-stowie-welcome.png`, fullPage: true })

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Stubbed trip' })).toBeVisible()
  await expect(page).toHaveURL(/\/overview$/)
  await expect(welcome).toHaveCount(0)
})

test('a shared vote link also starts with the quiz, then lands on the vote', async ({ page }) => {
  await stub(page)
  await page.goto(`/join?to=vote/${pollId}#t=${shareToken}`)
  await addMe(page)

  await page.waitForURL(/\/quiz\?next=/)
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.waitForURL(new RegExp(`/more/vote/${pollId}$`))
})
