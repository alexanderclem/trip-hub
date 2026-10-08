import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}
// These phones are brand new: no trips, and the opening quiz not yet taken.
const fresh = { storageState: { cookies: [], origins: [] } }
test.use(fresh)

test('opening sequence: welcome → create → quiz → trip; a friend joins, skips, and sees the profile', async ({ page, browser }) => {
  // ── Alex: welcome screen, then create ──
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Plan it together, take it anywhere.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
  await shot(page, '70-welcome')
  await page.getByRole('link', { name: 'Create a trip' }).click()
  await page.getByLabel('Trip name').fill(`E2E TEST onboarding ${new Date().toISOString()}`)
  await page.getByLabel('Your name').fill('Alex')
  await page.getByRole('button', { name: 'Create trip' }).click()

  // ── The quiz, before the trip opens ──
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
  await page.waitForURL(/\/more\/settings$/)
  await expect(page.getByRole('heading', { name: 'Invite the group' })).toBeVisible()
  const link = (await page.locator('p.font-mono').textContent())!.trim()
  const tripPath = new URL(page.url()).pathname.replace(/\/more\/settings$/, '')

  // Not asked again, and the result is this trip's profile.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Invite the group' })).toBeVisible()
  await page.goto(`${tripPath}/more/ideas/manual`)
  await expect(page.getByRole('link', { name: 'Retake the quiz' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Alex (you)' })).toBeEnabled()

  // ── Sam: invite link → who → quiz (skipped) → map ──
  const b = await browser.newContext(fresh)
  const pageB = await b.newPage()
  await pageB.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await pageB.getByPlaceholder('Your name').fill('Sam')
  await pageB.getByRole('button', { name: 'Add me' }).click()
  await pageB.waitForURL(/\/quiz\?next=/)
  await pageB.getByRole('button', { name: 'Skip for now' }).click()
  await pageB.waitForURL(/\/map$/)
  await pageB.reload()
  await expect(pageB).toHaveURL(/\/map$/)

  // Alex's quiz reached the server: Sam's phone lists Alex as having a profile.
  await pageB.goto(`${tripPath}/more/ideas/manual`)
  await expect(pageB.getByRole('checkbox', { name: 'Alex', exact: true })).toBeEnabled({ timeout: 75_000 })
  await expect(pageB.getByRole('checkbox', { name: 'Sam (you) · Needs a profile' })).toBeDisabled()
  await expect(pageB.getByRole('link', { name: 'Take the quiz' })).toBeVisible()
  await b.close()
})
