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
  const steps = page.getByRole('list').filter({ has: page.getByRole('heading', { name: 'Save an idea', exact: true }) })
  await expect(steps.getByRole('heading')).toHaveText(['Invite friends', 'Save an idea', 'Start a vote'])
  await expect(steps.getByRole('link', { name: /Save an idea/ })).toHaveAttribute('href', `/t/${tripId}/more/places/new`)
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/74-stowie-welcome.png`, fullPage: true })

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Stubbed trip' })).toBeVisible()
  await expect(page).toHaveURL(/\/overview$/)
  await expect(welcome).toHaveCount(0)
  await expect(page.getByText('0 of 3 first steps complete')).toBeVisible()
  await steps.getByRole('link', { name: /Save an idea/ }).click()
  await page.waitForURL(`**/t/${tripId}/more/places/new`)
  await page.getByLabel('Name', { exact: true }).fill('The dinner spot from the group chat')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForURL(new RegExp(`/t/${tripId}/more/places/[0-9a-f-]+$`))
  await page.goto(`/t/${tripId}/overview`)
  await expect(page.getByText('1 of 3 first steps complete')).toBeVisible()
  const setup = page.getByRole('region', { name: 'Make it happen' })
  if (process.env.SHOTS_DIR) await setup.screenshot({ path: `${process.env.SHOTS_DIR}/first-steps.png` })
})

test('a shared vote link also starts with the quiz, then lands on the vote', async ({ page }) => {
  await stub(page)
  await page.goto(`/join?to=vote/${pollId}#t=${shareToken}`)
  await addMe(page)

  await page.waitForURL(/\/quiz\?next=/)
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.waitForURL(new RegExp(`/more/vote/${pollId}$`))
})

test('an invitation introduces the real trip and group before choosing a name', async ({ page }) => {
  await stub(page)
  await page.route('**/rest/v1/trips**', (route) => route.fulfill(json([{ ...trip, name: 'Alex’s Croatia trip', settings: {
    areas: [{ name: 'Split, Croatia', bbox: [43.4, 16.3, 43.6, 16.5], lat: 43.5, lng: 16.4 }],
  } }])))
  await page.route('**/rest/v1/members**', (route) => route.fulfill(json([
    { id: userId, trip_id: tripId, display_name: 'Alex', color: '#295361', avatar_url: null, deleted_at: null, updated_at: now },
    { id: pollId, trip_id: tripId, display_name: 'averylongtravelernamewithoutanyspaces', color: null, avatar_url: null, deleted_at: null, updated_at: now },
  ])))
  await page.goto(`/join#t=${shareToken}`)
  await expect(page.getByRole('heading', { name: 'Alex’s Croatia trip', exact: true })).toBeVisible()
  await expect(page.getByText('Split, Croatia', { exact: true })).toBeVisible()
  await expect(page.getByText(/Mar 13, 2027.*Mar 20, 2027/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Alex/ })).toBeVisible()
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    const sizes = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width)
    if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/invitation-${width}.png`, fullPage: true })
  }
  const alex = page.getByRole('button', { name: /Alex/ })
  await alex.focus()
  await expect(alex).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: /averylongtraveler/ })).toBeFocused()
  await addMe(page)
  await page.waitForURL(/\/quiz\?next=/)
})

test('an undecided invitation welcomes the first traveler without inventing details', async ({ page }) => {
  await stub(page)
  await page.route('**/rest/v1/trips**', (route) => route.fulfill(json([{ ...trip, name: 'Our someday trip', start_date: null, end_date: null }])))
  await page.goto(`/join#t=${shareToken}`)
  await expect(page.getByRole('heading', { name: 'Our someday trip' })).toBeVisible()
  await expect(page.getByText('Dates to be decided together')).toBeVisible()
  await expect(page.getByText(/Be the first to add your name/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What should we call you?' })).toBeVisible()
  await addMe(page)
  await page.waitForURL(/\/quiz\?next=/)
})
