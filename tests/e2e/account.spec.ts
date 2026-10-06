import { expect, test } from '@playwright/test'

// Google itself can't be driven from a test, so these cover the app's side with the Supabase
// auth endpoints stubbed: no accounts are created and nothing is written.
const SETTINGS = '**/auth/v1/settings'
const settings = (google: boolean) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { google, anonymous_users: true } }) })

test('the sign-in card stays hidden while Google sign-in is switched off', async ({ page }) => {
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
