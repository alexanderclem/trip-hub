import { expect, test } from '@playwright/test'

// Local data, real on-phone OCR (Tesseract; English language data comes from jsDelivr), and a
// mocked /api/scan, so no live accounts or AI allowance are used.
const trip = '00000000-0000-4000-8000-000000000601'
const ana = '00000000-0000-4000-8000-000000000602'
const shots = process.env.SHOTS_DIR ?? 'test-results'

test('scan a receipt: text read on the phone, details pulled out, logged as an expense', async ({ page }) => {
  test.setTimeout(180_000)
  let scanBody: { kind: string; image: string | null; text: string } | null = null
  await page.route('**/api/scan', async (route) => {
    scanBody = route.request().postDataJSON()
    await route.fulfill({ json: { via: 'vision', details: { title: 'Dinner at Café Sky', merchant: 'Café Sky', amount: 450, currency: 'GTQ', date: '2027-03-15', confirmation_code: null, flight: null, notes: null } } })
  })
  // A stand-in anonymous session: /api/scan (mocked above) needs a bearer token.
  const user = { id: '00000000-0000-4000-8000-0000000006ff', aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: '2027-03-01T00:00:00Z' }
  await page.route('https://**/*', (route) => {
    const url = route.request().url()
    if (url.includes('cdn.jsdelivr.net/npm/@tesseract.js-data/')) return route.continue()
    if (url.includes('/auth/v1/signup')) return route.fulfill({ json: { access_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user } })
    if (url.includes('/auth/v1/user')) return route.fulfill({ json: user })
    return route.abort()
  })

  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  await page.evaluate(async ({ trip, ana }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction(['trips', 'members'], 'readwrite')
    tx.objectStore('trips').put({ id: trip, name: 'E2E TEST scan', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-16', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only', settings: { ocr_langs: ['eng'] }, deleted_at: null })
    tx.objectStore('members').put({ id: ana, trip_id: trip, display_name: 'Ana', color: null, avatar_emoji: null, home_timezone: null, deleted_at: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: ana, joinedAt: '2027-03-01T12:00:00Z' } }, quizSeen: true, moneyView: 'base' }, version: 1 }))
  }, { trip, ana })

  // A receipt photo, drawn in the browser.
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 800
    c.height = 600
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, 800, 600)
    g.fillStyle = '#000'
    g.font = 'bold 48px sans-serif'
    g.fillText('CAFE SKY', 60, 100)
    g.font = '36px sans-serif'
    ;['15/03/2027', 'Pepian 2 x 150.00', 'Horchata 150.00', 'TOTAL Q450.00'].forEach((l, i) => g.fillText(l, 60, 200 + i * 80))
    return c.toDataURL('image/png').split(',')[1]!
  })

  await page.goto(`/t/${trip}/money`)
  await page.getByRole('link', { name: 'Scan a receipt' }).first().click()
  await page.waitForURL(/\/tickets\/new\?kind=receipt&expense=1$/)
  await page.getByLabel('Choose file').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  const text = page.getByRole('textbox', { name: 'Text from the file' })
  await expect(text).toHaveValue(/TOTAL/, { timeout: 120_000 })
  await expect(text).toHaveValue(/CAFE SKY/)
  await page.getByRole('button', { name: 'Pull out details' }).click()
  await expect(page.getByText(/Found: Café Sky · Q\s?450\.00 · 2027-03-15/)).toBeVisible()
  expect(scanBody!.kind).toBe('receipt')
  expect(scanBody!.text).toContain('TOTAL')
  expect(scanBody!.image).toBeTruthy()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Dinner at Café Sky')
  await page.screenshot({ path: `${shots}/scan-receipt.png`, fullPage: true })
  await page.getByRole('button', { name: 'Save and log the expense' }).click()

  // The expense form is prefilled from the receipt.
  await page.waitForURL(/\/money\/new\?receipt=/)
  await expect(page.getByLabel('What for?')).toHaveValue('Café Sky')
  await expect(page.getByText('The receipt photo will be attached to this expense.')).toBeVisible()
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('450.00')
  await page.getByRole('button', { name: 'Save expense' }).click()
  await page.waitForURL(new RegExp(`/t/${trip}/money$`))

  // The receipt is linked and searchable on the Tickets tab.
  await page.goto(`/t/${trip}/tickets`)
  await page.getByRole('searchbox').fill('pepian')
  await expect(page.getByRole('region', { name: 'Receipts' })).toContainText('Dinner at Café Sky')
  await page.getByRole('link', { name: /Dinner at Café Sky/ }).click()
  const section = page.getByRole('region', { name: 'Text' })
  await expect(section).toContainText('CAFE SKY')
  await expect(section).toContainText(/Q\s?450\.00/)
  await expect(section.getByRole('link', { name: /Logged as an expense/ })).toBeVisible()
  await page.screenshot({ path: `${shots}/scan-viewer.png`, fullPage: true })
})
