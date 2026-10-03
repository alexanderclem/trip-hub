import { expect, test, type Page } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// All account and data endpoints are mocked; these tests never create live accounts or trips.
test.use({ serviceWorkers: 'block' })
const userId = '11111111-1111-4111-8111-111111111111'
const clientId = '55555555-5555-4555-8555-555555555555'
const authorizationId = 'consent-test'
const callback = 'https://chatgpt.com/connector_platform_oauth_redirect'
const authUser = { id: userId, email: 'traveler@example.com', is_anonymous: false, app_metadata: { provider: 'google' }, user_metadata: {} }
const details = { authorization_id: authorizationId, client: { id: clientId, name: 'ChatGPT', uri: 'https://chatgpt.com', logo_uri: '' },
  user: { id: userId, email: authUser.email }, scope: 'openid', redirect_uri: callback }
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const token = () => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test`
const session = () => ({ access_token: token(), refresh_token: 'test-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: authUser })

async function setup(page: Page, signedIn = true) {
  await page.route('**/auth/v1/settings', (route) => route.fulfill(json({ external: { google: true } })))
  await page.route('**/auth/v1/user', (route) => route.fulfill(json(authUser)))
  await page.route('**/auth/v1/token**', (route) => route.fulfill(json(session())))
  await page.route('**/rest/v1/**', (route) => route.fulfill(json([])))
  await page.route(`**/auth/v1/oauth/authorizations/${authorizationId}`, (route) => route.fulfill(json(details)))
  await page.route('https://chatgpt.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>ChatGPT callback</h1>' }))
  if (signedIn) await page.addInitScript(({ value }) => {
    localStorage.setItem('sb-croqjdvzbpcscdcshnet-auth-token', JSON.stringify(value))
  }, { value: session() })
}

test('missing requests show recovery and cannot authorize', async ({ page }) => {
  await setup(page)
  await page.goto('/oauth/consent')
  await expect(page.getByRole('alert')).toContainText('missing or invalid')
  await expect(page.getByRole('button', { name: 'Allow connection' })).toHaveCount(0)
})

for (const action of ['approve', 'deny']) {
  test(`${action} sends an explicit consent decision and preserves callback state`, async ({ page }) => {
    await setup(page)
    await page.route(`**/auth/v1/oauth/authorizations/${authorizationId}/consent`, async (route) => {
      expect(route.request().postDataJSON()).toEqual({ action })
      await route.fulfill(json({ redirect_url: `${callback}?${action === 'approve' ? 'code=test-code' : 'error=access_denied'}&state=test-state` }))
    })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`/oauth/consent?authorization_id=${authorizationId}`)
    await expect(page.getByRole('heading', { name: 'Allow ChatGPT to read your trips?' })).toBeVisible()
    await expect(page.getByText('Signed in as traveler@example.com')).toBeVisible()
    await expect(page.getByText('This connection cannot change', { exact: false })).toBeVisible()
    if (action === 'approve') {
      await page.setViewportSize({ width: 320, height: 740 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: join(tmpdir(), 'stowaway-connector-consent-mobile.png'), fullPage: true })
    }
    await page.getByRole('button', { name: action === 'approve' ? 'Allow connection' : 'Decline', exact: true }).click()
    await page.waitForURL('https://chatgpt.com/**')
    expect(new URL(page.url()).searchParams.get('state')).toBe('test-state')
    expect(errors).toEqual([])
  })
}

test('rejects unsupported OAuth return addresses', async ({ page }) => {
  await setup(page)
  await page.route(`**/auth/v1/oauth/authorizations/${authorizationId}`, (route) => route.fulfill(json({ ...details, redirect_uri: 'https://evil.example/callback' })))
  await page.goto(`/oauth/consent?authorization_id=${authorizationId}`)
  await expect(page.getByRole('alert')).toContainText('unsupported return address')
  await expect(page.getByRole('button', { name: 'Allow connection' })).toHaveCount(0)
})

test('guest Google sign-in returns to the pending consent request', async ({ page }) => {
  await setup(page, false)
  await page.route('**/auth/v1/authorize**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Google sign-in</h1>' }))
  await page.goto(`/oauth/consent?authorization_id=${authorizationId}`)
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  await page.waitForURL('**/auth/v1/authorize**')
  await page.goto('/auth/callback?code=test-google-code')
  await page.waitForURL(`**/oauth/consent?authorization_id=${authorizationId}`)
  await expect(page.getByRole('button', { name: 'Allow connection' })).toBeVisible()
})

test('shows consent errors with a retry and does not redirect', async ({ page }) => {
  await setup(page)
  await page.route(`**/auth/v1/oauth/authorizations/${authorizationId}/consent`, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Failed"}' }))
  await page.goto(`/oauth/consent?authorization_id=${authorizationId}`)
  await page.getByRole('button', { name: 'Allow connection' }).click()
  await expect(page.getByRole('alert')).toContainText('Could not finish connecting')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  expect(page.url()).toContain('/oauth/consent')
})

test('lists and revokes connected apps without changing trips', async ({ page }) => {
  await setup(page)
  await page.route('**/auth/v1/user/oauth/grants', (route) => route.fulfill(json([{ client: details.client, scopes: ['openid'], created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-02T00:00:00Z' }])))
  await page.route(`**/auth/v1/user/oauth/grants?client_id=${clientId}`, async (route) => {
    expect(route.request().method()).toBe('DELETE')
    await route.fulfill(json({}))
  })
  await page.goto('/connections')
  await expect(page.getByRole('heading', { name: 'ChatGPT', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click()
  await expect(page.getByText('You have no connected apps.')).toBeVisible()
})
