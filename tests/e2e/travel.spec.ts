import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
}

async function setStatus(page: Page, tripPath: string, name: string, status: string) {
  await page.goto(`${tripPath}/more/places`)
  await page.getByPlaceholder('Search places').fill(name)
  await page.getByRole('link', { name: new RegExp(name) }).first().click()
  const detailUrl = page.url()
  await page.getByRole('link', { name: 'Edit' }).click()
  await page.getByLabel('Status').selectOption(status)
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForURL(detailUrl)
  return detailUrl
}

test('travel times: walking in town, shuttle + padded drive between towns, lancha across the lake, reported times sync', async ({ browser }) => {
  const a = await browser.newContext()
  const page = await a.newPage()
  await page.goto('/')
  await page.getByRole('link', { name: 'Create a trip' }).click()
  await page.getByLabel('Trip name').fill(`E2E TEST travel ${new Date().toISOString()}`)
  await page.getByLabel('Your name').fill('Alex')
  await page.getByRole('button', { name: 'Create trip' }).click()
  await page.getByRole('button', { name: /Load Guatemala/ }).click()
  await expect(page.getByText(/Added 1301 places.*13 typical lancha\/shuttle times/)).toBeVisible()
  const link = (await page.locator('p.font-mono').textContent())!.trim()
  const tripPath = new URL(page.url()).pathname.replace(/\/more\/settings$/, '')

  const hotelUrl = await setStatus(page, tripPath, 'Antigua Inn', 'booked')
  await setStatus(page, tripPath, '12 Onzas', 'shortlist')
  const amarantoUrl = await setStatus(page, tripPath, 'Amaranto Panajachel', 'shortlist')
  await setStatus(page, tripPath, 'Casa Atitlan', 'shortlist')

  // Legs are computed automatically (≈8 s after the places change) and synced back.
  await page.goto(hotelUrl)
  const card = page.locator('section', { has: page.getByRole('heading', { name: 'Travel times' }) })
  await expect(card).toBeVisible()
  const row = (name: string) => card.locator('li', { has: page.getByRole('link', { name }) })
  await expect(row('12 Onzas').getByText('Walk')).toBeVisible({ timeout: 60_000 })
  await expect(row('12 Onzas').getByText('Drive')).toHaveCount(0) // a short walk: no driving suggestion
  await expect(row('Amaranto Panajachel').getByText('Shuttle')).toBeVisible()
  await expect(row('Amaranto Panajachel').getByText('2 h 30 – 3 h 30')).toBeVisible()
  const drive = row('Amaranto Panajachel').locator('li', { hasText: 'Drive' })
  await expect(drive).not.toContainText('~') // a real routed time, not the straight-line estimate
  await shot(page, '10-hotel-travel-times')

  // Across the lake the lancha comes first.
  await page.goto(amarantoUrl)
  const firstToSanPedro = card.locator('li', { has: page.getByRole('link', { name: 'Casa Atitlan' }) }).locator('li').first()
  await expect(firstToSanPedro).toContainText('Lancha')
  await expect(firstToSanPedro).toContainText('25–45 min')

  // On the map: select 12 Onzas, travel from the booked hotel, dashed line drawn.
  const onzasId = (await page.goto(`${tripPath}/more/places`), await page.getByPlaceholder('Search places').fill('12 Onzas'),
    await page.getByRole('link', { name: /12 Onzas/ }).click(), page.url().split('/').pop())
  await page.goto(`${tripPath}/map?place=${onzasId}`)
  await page.getByRole('button', { name: /From Antigua Inn/ }).click()
  await expect(page.getByText(/Walk/).first()).toBeVisible()
  await page.waitForTimeout(2000)
  await shot(page, '11-map-travel-from-hotel')

  // Report a real time; a second phone sees it.
  await page.getByRole('button', { name: 'Report the actual time' }).click()
  await page.getByRole('combobox').selectOption('walk')
  await page.getByLabel('Minimum minutes').fill('6')
  await page.getByLabel('Maximum minutes').fill('6')
  await page.getByPlaceholder(/Note/).fill('Cobblestones, took it slow')
  await page.getByRole('button', { name: 'Save for everyone' }).click()

  const b = await browser.newContext()
  const pageB = await b.newPage()
  await pageB.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await pageB.getByPlaceholder('Your name').fill('Sam')
  await pageB.getByRole('button', { name: 'Add me' }).click()
  await pageB.waitForURL(/\/map$/) // joined and named; navigating earlier would cancel the request
  await pageB.goto(hotelUrl.replace(/^https?:\/\/[^/]+/, ''))
  const rowB = pageB.locator('section', { has: pageB.getByRole('heading', { name: 'Travel times' }) }).locator('li', { has: pageB.getByRole('link', { name: '12 Onzas' }) })
  await expect(rowB).toContainText('6 min', { timeout: 30_000 })
  await a.close()
  await b.close()
})
