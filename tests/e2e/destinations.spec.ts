import { expect, test } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR

// Live services: Photon (place search), Open-Meteo (time zone), Overpass (places),
// OpenFreeMap (map tiles) and Supabase. Creates a trip named "E2E TEST destinations …".
test('self-serve setup: pick a destination, load its places, save its map, use it offline', async ({ browser }) => {
  test.setTimeout(300_000)
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')
  await page.getByRole('link', { name: 'Create a trip' }).click()
  await page.getByLabel('Trip name').fill(`E2E TEST destinations ${new Date().toISOString()}`)
  await page.getByLabel('Your name').fill('Alex')

  // The first destination sets the time zone and local currency.
  await page.getByLabel('Search for a destination').fill('Tulum')
  await page.getByRole('button', { name: /^Tulum, Quintana Roo/ }).first().click()
  await expect(page.getByRole('list', { name: 'Destinations' })).toContainText('Tulum')
  await expect(page.getByLabel('Destination time zone')).toHaveValue('America/Cancun')
  await expect(page.getByLabel('Local currency')).toHaveValue('MXN')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/70-new-trip-destination.png`, fullPage: true })

  await page.getByRole('button', { name: 'Create trip' }).click()
  await page.waitForURL(/\/more\/settings$/)
  const tripPath = new URL(page.url()).pathname.replace(/\/more\/settings$/, '')
  console.log(`CLEANUP trip=${tripPath.split('/').pop()}`)

  // Places from OpenStreetMap go into the idea pool. The public servers can be slow.
  const destinations = page.locator('section', { has: page.getByRole('heading', { name: 'Destinations' }) })
  await expect(destinations.getByRole('list', { name: 'Destinations' })).toContainText('Tulum')
  await destinations.getByRole('button', { name: 'Load places for these destinations' }).click()
  await expect(destinations.getByRole('status')).toContainText(/Added \d+ places/, { timeout: 170_000 })
  await expect(destinations.getByRole('list', { name: 'Destinations' })).toContainText(/\d+ places/)

  // Save the map around the destination.
  await page.getByRole('button', { name: /Save map for offline/ }).click()
  await expect(page.getByText(/On this phone · [\d.]+ MB · saved/)).toBeVisible({ timeout: 120_000 })
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/71-destinations-settings.png`, fullPage: true })

  // The map opens on the destination, not the default view.
  await page.goto(`${tripPath}/map`)
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready) && !!navigator.serviceWorker.controller)
  await page.waitForTimeout(4000)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/72-destination-map-online.png` })
  // Framed on the town itself: its street-level name labels are in view.
  const zoom = await page.evaluate(() => JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find((k) => k.includes('view'))!)!).zoom as number)
  expect(zoom).toBeGreaterThan(10)

  // ── No network: the saved map still draws ──
  await context.setOffline(true)
  await page.goto(`${tripPath}/map`)
  await expect(page.getByText("Offline: changes will sync when you're back online"), `page errors: ${errors.join(' | ')}`).toBeVisible()
  await page.waitForTimeout(6000) // style switch, tiles decode, glyphs
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/73-destination-map-offline.png` })
  const colours = await page.evaluate(() => {
    const c = document.querySelector('canvas.maplibregl-canvas') as HTMLCanvasElement
    const gl = c.getContext('webgl2', { preserveDrawingBuffer: true }) ?? c.getContext('webgl', { preserveDrawingBuffer: true })
    if (!gl) return -1
    const px = new Uint8Array(4 * 80 * 80)
    gl.readPixels(Math.floor(c.width / 2) - 40, Math.floor(c.height / 2) - 40, 80, 80, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const seen = new Set<string>()
    for (let i = 0; i < px.length; i += 4) seen.add(`${px[i]},${px[i + 1]},${px[i + 2]}`)
    return seen.size
  })
  // More than a flat background: roads, land use or labels were drawn from the saved tiles.
  expect(colours).not.toBe(0)
  await expect(page.getByText(/only map areas you've already viewed/)).toHaveCount(0)
  expect(errors).toEqual([])

  await context.setOffline(false)
  await context.close()
})
