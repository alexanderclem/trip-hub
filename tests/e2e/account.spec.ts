import { expect, test } from '@playwright/test'

// Google and a real inbox can't be driven from a test, so these cover the app's side with the Supabase
// auth endpoints stubbed: no accounts are created and nothing is written.
const SETTINGS = '**/auth/v1/settings'
const settings = (google: boolean, email = false) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { google, email, anonymous_users: true } }) })

// The install prompt opens over /app in a browser tab; these phones have already dismissed it.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('stowaway-install-dismissed', '1'))
})

test('the sign-in card stays hidden while every way of signing in is switched off', async ({ page }) => {
  await page.route(SETTINGS, (route) => route.fulfill(settings(false)))
  const answered = page.waitForResponse(SETTINGS)
  await page.goto('/app')
  await answered
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toHaveCount(0)
})

test('signing in sends the phone to Google and back to the callback address', async ({ page, baseURL }) => {
  await page.route(SETTINGS, (route) => route.fulfill(settings(true)))
  await page.route('**/auth/v1/authorize**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Google stub</h1>' }))
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Keep your trips if you change phones' })).toBeVisible()
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/60-account-card.png`, fullPage: true })

  const leaving = page.waitForRequest('**/auth/v1/authorize**')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  const url = new URL((await leaving).url())
  expect(url.searchParams.get('provider')).toBe('google')
  expect(url.searchParams.get('redirect_to')).toBe(`${baseURL}/auth/callback`)
  expect(url.searchParams.get('code_challenge')).toBeTruthy()
})

test('a cancelled sign-in explains itself and leaves the phone as it was', async ({ page }) => {
  await page.goto('/auth/callback?error=access_denied&error_description=The+sign-in+was+cancelled')
  await expect(page.getByRole('heading', { name: 'Sign-in didn’t finish' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveText('The sign-in was cancelled')
  await page.getByRole('link', { name: 'Back to your trips' }).click()
  await page.waitForURL(/\/app$/)
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
})

test.use({ serviceWorkers: 'block' })

const user = { id: '44444444-4444-4444-8444-444444444444', email: 'traveler@example.com', is_anonymous: false, app_metadata: { provider: 'email' }, user_metadata: {} }
const signedIn = () => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: `e30.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test`, refresh_token: 'test-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user }) })

test('email sign-in: a code by email signs the phone in', async ({ page }) => {
  await page.route(SETTINGS, (route) => route.fulfill(settings(true, true)))
  await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/auth/v1/otp**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/auth/v1/verify**', (route) => route.fulfill(signedIn()))
  await page.goto('/app')
  await page.getByRole('link', { name: 'Use email instead' }).click()
  await page.waitForURL(/\/signin$/)

  const sent = page.waitForRequest('**/auth/v1/otp**')
  await page.getByLabel('Email').fill('Traveler@Example.com')
  await page.getByRole('button', { name: 'Email me a code' }).click()
  expect((await sent).postDataJSON().email).toBe('traveler@example.com')
  await expect(page.getByText('We sent a code to')).toBeVisible()
  await expect(page.getByRole('button', { name: /Send a new code in \d+s/ })).toBeDisabled()
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/61-email-code.png`, fullPage: true })

  const checked = page.waitForRequest('**/auth/v1/verify**')
  await page.getByLabel('Code from the email').fill('123456')
  await page.getByRole('button', { name: 'Sign in' }).click()
  expect((await checked).postDataJSON()).toMatchObject({ email: 'traveler@example.com', token: '123456', type: 'email' })
  await page.waitForURL(/\/app$/)
  await expect(page.getByText('Signed in as traveler@example.com')).toBeVisible()
})

test('email sign-in: a password works, and a wrong one says what to do', async ({ page }) => {
  await page.route(SETTINGS, (route) => route.fulfill(settings(false, true)))
  await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  let attempts = 0
  await page.route('**/auth/v1/token**', (route) => (attempts++ === 0
    ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'invalid_credentials', message: 'Invalid login credentials' }) })
    : route.fulfill(signedIn())))
  await page.goto('/app')
  await page.getByRole('link', { name: 'Sign in with email' }).click()
  await page.getByLabel('Email').fill('traveler@example.com')
  await page.getByRole('button', { name: 'Use a password instead' }).click()
  await page.getByLabel('Password').fill('short')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled()
  await page.getByLabel('Password').fill('long enough password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText('don’t match an account')
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/62-email-password.png`, fullPage: true })
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/app$/)
  await expect(page.getByText('Signed in as traveler@example.com')).toBeVisible()
})
