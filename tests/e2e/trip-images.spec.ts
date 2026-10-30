import { expect, test, type Page } from '@playwright/test'

const tripId = '00000000-0000-4000-8000-000000000e01'
const me = '00000000-0000-4000-8000-000000000e02'
const root = `/t/${tripId}`
test.use({ serviceWorkers: 'block' })

async function seed(page: Page, baseURL: string) {
  await page.route(url => url.protocol === 'https:' && url.origin !== new URL(baseURL).origin, route => route.abort())
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }))
  await page.goto('/inspire/manual')
  await page.getByRole('heading', { level: 1, name: 'Trip ideas', exact: true }).waitFor()
  await page.evaluate(async ({ tripId, me }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const tx = db.transaction(['trips', 'members'], 'readwrite')
    tx.objectStore('trips').put({ id: tripId, name: 'Our Kyoto postcard', timezone: 'Asia/Tokyo', start_date: null, end_date: null, base_currency: 'USD', local_currency: 'JPY', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only', settings: { preserved_setting: true, areas: [{ name: 'Kyoto', lat: 35.01, lng: 135.77, bbox: [34.9, 135.6, 35.2, 135.9] }] }, deleted_at: null })
    tx.objectStore('members').put({ id: me, trip_id: tripId, display_name: 'Alex', color: '#295361', avatar_url: null, avatar_emoji: null, deleted_at: null })
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve() }); db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { quizSeen: true, trips: { [tripId]: { tripId, memberId: me, joinedAt: '2026-10-30T12:00:00Z' } } }, version: 1 }))
    sessionStorage.setItem('stowaway-install-dismissed', '1')
  }, { tripId, me })
}
async function row(page: Page, store = 'trips', id = tripId) {
  return page.evaluate(async ({ store, id }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const requestRow = db.transaction(store).objectStore(store).get(id)
    const result = await new Promise<any>(resolve => { requestRow.onsuccess = () => resolve(requestRow.result) }); db.close(); return result
  }, { store, id })
}
async function photo(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 600
    const ctx = canvas.getContext('2d')!
    for (const [index, color] of ['#ff0000', '#00ff00', '#0000ff'].entries()) { ctx.fillStyle = color; ctx.fillRect(index * 300, 0, 300, 600) }
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  return { name: 'postcard.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}
async function centerPixel(page: Page, selector: string) {
  return page.locator(selector).first().evaluate(async (el: HTMLImageElement) => {
    await el.decode()
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(el, el.naturalWidth / 2, el.naturalHeight / 2, 1, 1, 0, 0, 1, 1)
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
  })
}

test('automatic destination artwork, all twelve scenes, keyboard selection and reflow', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${root}/overview`)
  await page.getByRole('button', { name: 'Change trip cover' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('radio', { name: /Automatic/ })).toBeChecked()
  await expect(dialog.getByRole('radio', { name: /Quiet temples/ })).toBeVisible()
  await expect(dialog.locator('.cover-choice .trip-artwork')).toHaveCount(12)
  await dialog.locator('.cover-choice .trip-artwork').evaluateAll(async (images) => { await Promise.all(images.map(image => (image as HTMLImageElement).decode())) })
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 320, height: 900 })
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.addStyleTag({ content: 'html { font-size: 100%; }' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '/tmp/stowaway-destination-covers.png', fullPage: true })
  await dialog.getByRole('radio', { name: /Automatic/ }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(dialog.getByRole('radio', { name: /Use my own photo/ })).toBeChecked()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Change trip cover' })).toBeFocused()
  await page.getByRole('button', { name: 'Change trip cover' }).click()
  await dialog.getByRole('button', { name: 'Save cover' }).click()
  expect((await row(page)).settings.journal_cover).toBe('auto')
  // A destination change retains automatic mode and changes the resolved artwork.
  await page.evaluate(async tripId => {
    const request = indexedDB.open('trip-hub'); const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const tx = db.transaction('trips', 'readwrite'); const store = tx.objectStore('trips'); const get = store.get(tripId)
    get.onsuccess = () => store.put({ ...get.result, settings: { ...get.result.settings, areas: [{ name: 'Panajachel', lat: 14.74, lng: -91.16, bbox: [14.6, -91.3, 14.9, -91] }] } })
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve() }); db.close()
  }, tripId)
  await page.reload()
  await page.getByRole('button', { name: 'Change trip cover' }).click()
  await expect(dialog.getByText(/Inspired by Panajachel/)).toBeVisible()
  const firstChoice = dialog.locator('.cover-choice').first()
  await expect(firstChoice).toContainText('Lakeside mornings')
  await firstChoice.click()
  await dialog.getByRole('button', { name: 'Save cover' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Change trip cover' }).click()
  await expect(dialog.getByRole('radio', { name: /Lakeside mornings/ })).toBeChecked()
  expect(errors).toEqual([])
})

test('custom banner crops, failures, persistence, shared surfaces and removal', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/overview`)
  await page.getByRole('button', { name: 'Change trip cover' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: /Use my own photo/ }).check()
  await dialog.getByRole('button', { name: 'Save cover' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Choose a photo')
  await dialog.getByLabel('Trip cover photo', { exact: true }).setInputFiles(await photo(page))
  const preview = '.cover-preview img'
  await expect(dialog.locator(preview)).toBeVisible()
  await dialog.getByRole('slider', { name: 'Trip cover photo zoom' }).focus(); await page.keyboard.press('End')
  await expect(dialog.getByRole('button', { name: 'Save cover' })).toBeEnabled()
  await dialog.getByRole('slider', { name: 'Trip cover photo horizontal position' }).focus(); await page.keyboard.press('End')
  await expect(dialog.getByRole('button', { name: 'Save cover' })).toBeEnabled()
  const pixel = await centerPixel(page, preview)
  expect(pixel[2]).toBeGreaterThan(245); expect(pixel[0]).toBeLessThan(10)
  const expected = await dialog.locator(preview).getAttribute('src')
  await dialog.getByLabel('Trip cover photo', { exact: true }).setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('invalid') })
  await expect(dialog.getByRole('alert').filter({ hasText: 'Could not read' })).toBeVisible()
  await expect(dialog.locator(preview)).toHaveAttribute('src', expected!)
  await dialog.getByRole('button', { name: 'Save cover' }).click()
  const stored = await row(page)
  expect(stored.settings).toMatchObject({ journal_cover: 'custom', journal_cover_image: expected, preserved_setting: true })
  expect(expected!.length).toBeLessThanOrEqual(400000)
  await expect(page.locator('.overview-art img')).toHaveAttribute('src', expected!)
  await page.reload(); await expect(page.locator('.overview-art img')).toHaveAttribute('src', expected!)
  await page.goto('/app'); await expect(page.locator('.saved-trip-art img')).toHaveAttribute('src', expected!)
  await page.goto(`${root}/more/settings`); await expect(page.locator('.settings-trip-art img')).toHaveAttribute('src', expected!)
  await page.getByRole('button', { name: 'Change trip cover' }).click()
  await expect(dialog.getByRole('radio', { name: /Use my own photo/ })).toBeChecked()
  await page.screenshot({ path: '/tmp/stowaway-custom-cover.png', fullPage: true })
  await dialog.getByRole('button', { name: 'Remove cover photo' }).click()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  expect((await row(page)).settings.journal_cover_image).toBe(expected)
  await page.getByRole('button', { name: 'Change trip cover' }).click()
  await dialog.getByRole('button', { name: 'Remove cover photo' }).click()
  await dialog.getByRole('button', { name: 'Save cover' }).click()
  expect((await row(page)).settings.journal_cover_image).toBeUndefined()
  await expect(page.locator('.settings-trip-art img')).toHaveAttribute('src', '/images/trip-covers/flat-v2/temples.jpg')
  await expect(page.locator('.settings-trip-art img[src^="data:"]')).toHaveCount(0)
  // Both the change and photo removal use the existing sync queue, coalesced as a single row.
  const queue = await page.evaluate(async tripId => {
    const request = indexedDB.open('trip-hub'); const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const get = db.transaction('_outbox').objectStore('_outbox').getAll()
    const entries = await new Promise<any[]>(resolve => { get.onsuccess = () => resolve(get.result) }); db.close()
    return entries.filter(entry => entry.table === 'trips' && entry.rowId === tripId)
  }, tripId)
  expect(queue).toHaveLength(1); expect(queue[0].payload.settings.journal_cover).toBe('auto')
})

test('profile photo crop is saved, survives reload and resets on removal', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/travelers/${me}`)
  await page.getByText('Edit traveler profile', { exact: true }).click()
  await page.getByLabel('Profile photo', { exact: true }).setInputFiles(await photo(page))
  await expect(page.locator('.profile-photo-preview img')).toBeVisible()
  await page.getByRole('slider', { name: 'Profile photo zoom' }).focus(); await page.keyboard.press('End')
  await expect(page.getByRole('button', { name: 'Save profile' })).toBeEnabled()
  await page.getByRole('slider', { name: 'Profile photo horizontal position' }).focus(); await page.keyboard.press('End')
  await expect(page.getByRole('button', { name: 'Save profile' })).toBeEnabled()
  expect((await centerPixel(page, '.profile-photo-preview img'))[2]).toBeGreaterThan(245)
  await page.getByRole('button', { name: 'Save profile' }).click()
  const stored = await row(page, 'members', me)
  expect(stored.avatar_url.length).toBeLessThanOrEqual(200000)
  await page.reload()
  await expect(page.locator('.profile-photo-preview img')).toHaveAttribute('src', stored.avatar_url)
  await page.getByText('Edit traveler profile', { exact: true }).click()
  await page.getByRole('button', { name: 'Remove photo' }).click()
  await expect(page.getByRole('slider')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save profile' }).click()
  expect((await row(page, 'members', me)).avatar_url).toBeNull()
})


test.describe('offline illustration collection', () => {
  test.use({ serviceWorkers: 'allow' })
  test('all twelve local illustrations remain available after an offline reload', async ({ page, baseURL, context }) => {
    await seed(page, baseURL!)
    await page.goto(`${root}/overview`)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    await expect.poll(() => page.evaluate(async () => !!await caches.match('/images/trip-covers/flat-v2/temples.jpg', { ignoreSearch: true }))).toBe(true)
    await context.setOffline(true)
    await page.reload()
    await expect(page.locator('.overview-art img')).toBeVisible()
    await page.locator('.overview-art img').evaluate((image: HTMLImageElement) => image.decode())
    await page.getByRole('button', { name: 'Change trip cover' }).click()
    const images = page.getByRole('dialog').locator('.cover-choice img')
    await expect(images).toHaveCount(12)
    await images.evaluateAll(async (elements) => { await Promise.all(elements.map(image => (image as HTMLImageElement).decode())) })
  })
})
