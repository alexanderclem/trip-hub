import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR // set to save screenshots for manual review

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

/** Waits until MapLibre has drawn and finished loading tiles. */
async function waitForMap(page: Page) {
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible()
  await page.waitForFunction(() => {
    const el = document.querySelector('.maplibregl-map') as HTMLElement | null
    return !!el && !document.querySelector('.maplibregl-canvas-container.maplibregl-interactive:empty')
  })
  await page.waitForTimeout(3000) // tile fetch + pin images
}

test('create a trip, load starter places, see them on the map, and sync a shortlist to a second phone', async ({ browser }) => {
  // ── Phone A: create the trip ──
  const a = await browser.newContext()
  const pageA = await a.newPage()
  await pageA.goto('/')
  await shot(pageA, '01-home')
  await pageA.getByRole('link', { name: 'Create a trip' }).click()
  await pageA.getByLabel('Trip name').fill(`E2E TEST ${new Date().toISOString()}`)
  await pageA.getByLabel('Your name').fill('Alex')
  await pageA.getByRole('button', { name: 'Create trip' }).click()
  await expect(pageA.getByRole('heading', { name: 'Invite the group' })).toBeVisible()
  await shot(pageA, '02-settings')

  // Starter places into the idea pool
  await pageA.getByRole('button', { name: /Load Guatemala/ }).click()
  await expect(pageA.getByText(/Added 1301 places/)).toBeVisible()
  const link = (await pageA.locator('p.font-mono').textContent())!.trim()
  expect(link).toMatch(/\/join#t=/)

  // Map: empty-state hint, then the idea pool
  await pageA.getByRole('link', { name: 'Map' }).click()
  await waitForMap(pageA)
  await expect(pageA.getByText(/No shortlisted places yet/)).toBeVisible()
  await shot(pageA, '03-map-empty')
  await pageA.getByRole('button', { name: /Show idea pool \(1301\)/ }).click()
  await pageA.waitForTimeout(2500)
  await shot(pageA, '04-map-pool')

  // ── Phone B: join by link as a new person ──
  const b = await browser.newContext()
  const pageB = await b.newPage()
  await pageB.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await expect(pageB.getByRole('heading', { name: 'Who are you?' })).toBeVisible()
  await expect(pageB.getByRole('button', { name: /Alex/ })).toBeVisible()
  await shot(pageB, '05-who')
  await pageB.getByPlaceholder('Your name').fill('Sam')
  await pageB.getByRole('button', { name: 'Add me' }).click()
  await waitForMap(pageB)

  // ── Phone A shortlists a real café from the pool via the places list ──
  await pageA.getByRole('link', { name: 'List' }).click()
  await pageA.getByPlaceholder('Search places').fill('12 Onzas')
  await pageA.getByRole('link', { name: /12 Onzas/ }).click()
  const placeUrl = pageA.url()
  const placeId = placeUrl.split('/').pop()!
  await pageA.getByRole('link', { name: 'Edit' }).click()
  await pageA.getByLabel('Status').selectOption('shortlist')
  await pageA.getByRole('button', { name: 'Save' }).click()
  await expect(pageA.getByText('Shortlist', { exact: true })).toBeVisible()

  // ── Phone B sees it appear on the map (realtime poke → pull), then opens its sheet ──
  await pageB.goto(`${new URL(pageB.url()).pathname}?place=${placeId}`)
  await expect(pageB.getByRole('heading', { name: '12 Onzas' })).toBeVisible({ timeout: 30_000 })
  // A's edit must actually arrive on B (it queues behind A's 1,301-place import upload).
  await expect(pageB.getByText('Food · Antigua · Shortlist')).toBeVisible({ timeout: 60_000 })
  await expect(pageB.getByRole('button', { name: /Shortlist/ })).toHaveCount(0)
  await expect(pageB.getByText(/away \(straight line\)/)).toBeVisible()
  await pageB.waitForTimeout(2500)
  await shot(pageB, '06-map-shortlisted-sheet')

  await a.close()
  await b.close()
})
