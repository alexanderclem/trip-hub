import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}

test('money: quetzal + dollar expenses, equal and exact splits, settle-up, currency toggle', async ({ browser }) => {
  // ── Alex creates the trip ──
  const a = await browser.newContext()
  const pageA = await a.newPage()
  await pageA.goto('/')
  await pageA.getByRole('link', { name: 'Create a trip' }).click()
  await pageA.getByLabel('Trip name').fill(`E2E TEST money ${new Date().toISOString()}`)
  await pageA.getByLabel('Your name').fill('Alex')
  await pageA.getByRole('button', { name: 'Create trip' }).click()
  await expect(pageA.getByRole('heading', { name: 'Invite the group' })).toBeVisible()
  const link = (await pageA.locator('p.font-mono').textContent())!.trim()
  const tripPath = new URL(pageA.url()).pathname.replace(/\/more\/settings$/, '')

  // ── Sam joins ──
  const b = await browser.newContext()
  const pageB = await b.newPage()
  await pageB.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await pageB.getByPlaceholder('Your name').fill('Sam')
  await pageB.getByRole('button', { name: 'Add me' }).click()
  await pageB.waitForURL(/\/map$/)

  // ── Alex: Q450 dinner, paid by Alex, split equally, at 7.63 GTQ/USD → $58.98 ──
  await pageA.goto(`${tripPath}/money/new`)
  await expect(pageA.getByLabel('Include Sam')).toBeVisible({ timeout: 30_000 }) // Sam has synced in
  await pageA.getByLabel('What for?').fill('Dinner at Café Sky')
  await pageA.getByLabel('Amount').fill('450')
  await pageA.getByLabel('Currency').selectOption('GTQ')
  await pageA.getByLabel('Exchange rate').fill('7.63')
  await expect(pageA.getByText('≈ $58.98')).toBeVisible()
  await expect(pageA.getByText('$29.49')).toHaveCount(2) // each person's share, live
  await shot(pageA, '50-expense-form')
  await pageA.getByRole('button', { name: 'Save expense' }).click()
  await pageA.waitForURL(new RegExp(`${tripPath}/money$`))
  await expect(pageA.getByText("You're owed $29.49")).toBeVisible()

  // ── Sam: $30 shuttle, paid by Sam, exact split Alex $20 / Sam $10 ──
  await pageB.goto(`${tripPath}/money/new`)
  await expect(pageB.getByLabel('Include Alex')).toBeVisible({ timeout: 30_000 })
  await pageB.getByLabel('What for?').fill('Shuttle to Panajachel')
  await pageB.getByLabel('Amount').fill('30')
  await pageB.getByLabel('Currency').selectOption('USD')
  await pageB.getByRole('radio', { name: 'Exact' }).click()
  await pageB.getByLabel('Alex exact').fill('20')
  await expect(pageB.getByText('$10.00 left to assign')).toBeVisible()
  await pageB.getByLabel('Sam exact').fill('10')
  await expect(pageB.getByText(/left to assign/)).toHaveCount(0)
  await pageB.getByRole('button', { name: 'Save expense' }).click()
  await pageB.waitForURL(new RegExp(`${tripPath}/money$`))

  // ── Net: Alex +29.49 − 20.00 = +9.49 → Sam pays Alex $9.49 ──
  await expect(pageA.getByText("You're owed $9.49")).toBeVisible({ timeout: 75_000 })
  await expect(pageA.getByText(/Sam\s*pays\s*you/)).toBeVisible()
  await expect(pageB.getByText('You owe $9.49')).toBeVisible({ timeout: 75_000 })
  await shot(pageA, '51-money-owed')

  // Currency toggle: display only, marked approximate.
  await pageA.getByRole('radio', { name: '≈ GTQ' }).click()
  await expect(pageA.getByText(/You're owed ≈ Q\s?\d/)).toBeVisible()
  await pageA.getByRole('radio', { name: 'USD' }).click()

  // ── Record the payment → everyone square ──
  await pageA.getByRole('button', { name: /Record Sam paying Alex/ }).click()
  await expect(pageA.getByLabel('Amount paid')).toHaveValue('9.49')
  await pageA.getByRole('button', { name: 'Mark as paid' }).click()
  await expect(pageA.getByText('All settled')).toBeVisible()
  await expect(pageA.getByText('Everyone is square.')).toBeVisible()
  await expect(pageB.getByText('All settled')).toBeVisible({ timeout: 75_000 })
  await shot(pageA, '52-money-settled')

  await a.close()
  await b.close()
})
