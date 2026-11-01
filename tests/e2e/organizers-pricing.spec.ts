import { expect, test, type Page } from '@playwright/test'

// Local-only: every network request is refused. The pricing math runs on the page; the organize form
// is checked as far as the server (which isn't reached here).
const shots = process.env.SHOTS_DIR ?? 'test-results'

async function shoot(page: Page, name: string) {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${shots}/${name}-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
}

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort())
})

test('pricing shows what an organizer keeps, and updates as the trip changes', async ({ page }) => {
  await page.goto('/pricing')
  await expect(page.getByRole('heading', { level: 1, name: 'Plan for free. Pay 1% only when you collect money.' })).toBeVisible()
  // The plan's worked example: $1,500 for 20 travelers, $300 deposit, cards, organizer pays the fees.
  await expect(page.locator('.calc-keep')).toHaveText('$28,818.00')
  const table = page.getByRole('table', { name: 'Each traveler’s payments and fees' })
  await expect(table.getByRole('row', { name: /^Stripe/ })).toContainText('$9.00')
  await shoot(page, 'pricing')
  await page.getByRole('radio', { name: 'Bank' }).check()
  await expect(page.locator('.calc-keep')).toHaveText('$29,552.00')
  await page.getByRole('radio', { name: 'Travelers' }).check()
  await expect(page.locator('.calc-keep')).toHaveText(/^\$30,0\d\d\.\d\d$/)
  await expect(table.getByRole('row', { name: /^Booking fee/ })).toBeVisible()
  await page.getByRole('textbox', { name: 'Travelers', exact: true }).fill('8')
  await expect(page.getByRole('heading', { name: 'For 8 travelers, you keep' })).toBeVisible()
})

test('the organizers page says what changes for them and offers early access', async ({ page }) => {
  await page.goto('/operators')
  await expect(page.getByRole('heading', { level: 1, name: 'Run the trip with your group, not around it.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your money isn’t held' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'See pricing' })).toHaveAttribute('href', '/pricing')
  await shoot(page, 'operators')
  // Offline here, so the request fails with a message rather than silently.
  await page.getByLabel('Email').fill('organizer@example.com')
  await page.getByRole('button', { name: 'Get early access' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
})

test('the landing page links to both', async ({ page }) => {
  await page.goto('/')
  const footer = page.getByRole('navigation', { name: 'Footer navigation' })
  await expect(footer.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing')
  await expect(footer.getByRole('link', { name: 'For organizers' })).toHaveAttribute('href', '/operators')
})
