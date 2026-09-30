import { expect, test } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR

test('offline: download the map pack, cut the network, reload — app, data and map (with labels) still work', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('/')
  await page.getByRole('link', { name: 'Create a trip' }).click()
  await page.getByLabel('Trip name').fill(`E2E TEST offline ${new Date().toISOString()}`)
  await page.getByLabel('Your name').fill('Alex')
  await page.getByRole('button', { name: 'Create trip' }).click()
  await page.getByRole('button', { name: /Load Guatemala/ }).click()
  await expect(page.getByText(/Added 1301 places/)).toBeVisible()
  const tripPath = new URL(page.url()).pathname.replace(/\/more\/settings$/, '')

  // Download the offline map (≈15.6 MB from our own origin).
  await page.getByRole('button', { name: /Download offline map/ }).click()
  await expect(page.getByText(/On this phone · 15\.6 MB/)).toBeVisible({ timeout: 60_000 })

  // Shortlist a place so there's a pin to see.
  await page.goto(`${tripPath}/more/places`)
  await page.getByPlaceholder('Search places').fill('12 Onzas')
  await page.getByRole('link', { name: /12 Onzas/ }).click()
  const detailUrl = page.url()
  const placeId = detailUrl.split('/').pop()
  await page.getByRole('link', { name: 'Edit' }).click()
  await page.getByLabel('Status').selectOption('shortlist')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForURL(detailUrl) // saved; leaving earlier could drop the write

  // The service worker must be controlling the page before we cut the network.
  await page.goto(`${tripPath}/map`)
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready) && !!navigator.serviceWorker.controller)
  await page.waitForTimeout(3000) // let precaching finish

  // ── No network at all ──
  const failed: string[] = []
  page.on('requestfailed', (r) => failed.push(r.url()))
  await context.setOffline(true)
  await page.goto(`${tripPath}/map?place=${placeId}`)

  await expect(page.getByText("Offline: changes will sync when you're back online")).toBeVisible()
  await expect(page.getByText('Offline map', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('heading', { name: '12 Onzas' })).toBeVisible()
  // The local edit survives the offline reload (status badge on the place card).
  await expect(page.getByRole('dialog', { name: '12 Onzas' }).getByText('Shortlist', { exact: true })).toBeVisible()
  await page.waitForTimeout(4000) // tiles decode + glyphs
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/20-offline-map.png` })

  // The map drew real pixels (not a blank canvas).
  const painted = await page.evaluate(() => {
    const c = document.querySelector('canvas.maplibregl-canvas') as HTMLCanvasElement
    const gl = c.getContext('webgl2', { preserveDrawingBuffer: true }) ?? c.getContext('webgl', { preserveDrawingBuffer: true })
    if (!gl) return -1
    const px = new Uint8Array(4 * 50 * 50)
    gl.readPixels(Math.floor(c.width / 2) - 25, Math.floor(c.height / 2) - 25, 50, 50, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const colours = new Set<string>()
    for (let i = 0; i < px.length; i += 4) colours.add(`${px[i]},${px[i + 1]},${px[i + 2]}`)
    return colours.size
  })
  expect(painted).not.toBe(0)

  // Nothing the offline map needs was fetched from the network (fonts, sprites, packs, worker).
  const mapFailures = failed.filter((u) => /map-assets|\.pmtiles|maplibre-gl-worker|\/assets\//.test(u))
  expect(mapFailures).toEqual([])

  await context.setOffline(false)
  await context.close()
})
