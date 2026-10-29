import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}
// These phones are brand new: no trips or saved travel preferences.
const fresh = { storageState: { cookies: [], origins: [] } }
test.use(fresh)

test('opening sequence: create → trip → optional quiz; a friend joins directly and sees the profile', async ({ page, browser }) => {
  // ── Alex: welcome screen, then create ──
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Your next trip starts here.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
  await shot(page, '70-welcome')
  await page.getByRole('link', { name: 'Create a trip' }).click()
  await page.getByLabel('Trip name').fill(`E2E TEST onboarding ${new Date().toISOString()}`)
  await page.getByLabel('Your name').fill('Alex')
  await page.getByRole('button', { name: 'Create trip' }).click()

  // The trip opens immediately; preferences are offered in context.
  await page.waitForURL(/\/overview/)
  await expect(page.getByRole('status', { name: 'Welcome from Stowie' })).toContainText('Your trip is ready.')
  await shot(page, '74-stowie-welcome-created')
  await page.getByRole('link', { name: /Set your travel preferences/ }).click()
  await page.waitForURL(/\/quiz\?next=/)
  await expect(page.getByRole('heading', { name: 'What kind of traveler are you?' })).toBeVisible()
  await shot(page, '71-quiz-intro')
  await page.getByRole('button', { name: 'Start the quiz' }).click()
  const progress = page.getByRole('progressbar', { name: 'Quiz progress' })
  await expect(progress).toHaveAttribute('aria-valuenow', '1')
  const total = Number(await progress.getAttribute('aria-valuemax'))
  expect(total).toBeGreaterThanOrEqual(8)
  await shot(page, '72-quiz-question')
  // Answer one, go back, and the answer is still marked.
  await page.getByRole('radio').first().click()
  await expect(progress).toHaveAttribute('aria-valuenow', '2')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true')
  for (let i = 0; i < total; i++) {
    await expect(progress).toHaveAttribute('aria-valuenow', String(i + 1))
    await page.getByRole('radio').first().click()
  }
  await expect(page.getByRole('img', { name: /Your travel style/ })).toBeVisible()
  await shot(page, '73-quiz-result')
  await page.getByRole('button', { name: 'Open the trip' }).click()
  await page.waitForURL(/\/overview/)
  await expect(page.getByRole('heading', { name: 'What kind of traveler are you?' })).toHaveCount(0)
  await page.getByText('Invite the group', { exact: true }).click()
  const link = (await page.locator('p.font-mono').textContent())!.trim()
  const tripPath = new URL(page.url()).pathname.replace(/\/overview$/, '')

  // Not asked again, and the result is this trip's profile.
  await page.reload()
  await expect(page).toHaveURL(/\/overview$/)
  await page.getByText('Invite the group', { exact: true }).click()
  await expect(page.locator('p.font-mono')).toBeVisible()
  await page.goto(`${tripPath}/more/ideas/manual`)
  await expect(page.getByRole('link', { name: 'Retake the quiz' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Alex (you)' })).toBeEnabled()

  // ── Sam: invite link → who → overview, without an intervening quiz ──
  const b = await browser.newContext(fresh)
  const pageB = await b.newPage()
  await pageB.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await pageB.getByPlaceholder('Your name').fill('Sam')
  await pageB.getByRole('button', { name: 'Add me' }).click()
  await pageB.waitForURL(/\/overview/)
  await expect(pageB.getByRole('heading', { name: 'What kind of traveler are you?' })).toHaveCount(0)
  await expect(pageB.getByRole('status', { name: 'Welcome from Stowie' })).toContainText('You’re in.')
  await pageB.reload()
  await expect(pageB).toHaveURL(/\/overview$/)

  // Alex's quiz reached the server: Sam's phone lists Alex as having a profile.
  await pageB.goto(`${tripPath}/more/ideas/manual`)
  await expect(pageB.getByRole('checkbox', { name: 'Alex', exact: true })).toBeEnabled({ timeout: 75_000 })
  await expect(pageB.getByRole('checkbox', { name: 'Sam (you) · Needs a profile' })).toBeDisabled()
  await expect(pageB.getByRole('link', { name: 'Take the quiz' })).toBeVisible()
  await b.close()
})
