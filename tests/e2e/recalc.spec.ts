import { expect, test } from '@playwright/test'

// Live Supabase: "Recalculate now" shows that it's working and reports the result in its own card.
test('travel times: recalculate shows progress and the result in the card', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Create a trip' }).click()
  await page.getByLabel('Trip name').fill(`E2E TEST recalc ${new Date().toISOString()}`)
  await page.getByLabel('Your name').fill('Alex')
  await page.getByRole('button', { name: 'Create trip' }).click()
  await page.waitForURL(/\/more\/settings$/)

  const card = page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Travel times' }) }).last()
  await card.getByRole('button', { name: /Recalculate now/ }).click()
  await expect(card.getByRole('status')).toContainText(/Calculated \d+ travel times/, { timeout: 60_000 })
  if (process.env.SHOTS_DIR) await card.screenshot({ path: `${process.env.SHOTS_DIR}/recalc-card.png` })
})
