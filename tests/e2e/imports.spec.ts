import { expect, test, type Page } from '@playwright/test'

// Phase 4 imports with no live services: a plan from CSV into a trip (offline, saved on the phone),
// and past travelers from CSV (stubbed RPC).
const shots = process.env.SHOTS_DIR ?? 'test-results'
const trip = '00000000-0000-4000-8000-000000000901'
const ana = '00000000-0000-4000-8000-000000000902'
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

async function shoot(page: Page, name: string) {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${shots}/${name}-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
}

test('a plan comes in from a spreadsheet, offline, as tentative items in the trip zone', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }))
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'Trip ideas', level: 1 })).toBeVisible()
  await page.evaluate(async ({ trip, ana }) => {
    // Wait for the app to create its database; opening it first would make an empty one.
    while (!(await indexedDB.databases()).some((d) => d.name === 'trip-hub')) { /* not created yet */ }
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction(['trips', 'members'], 'readwrite')
    tx.objectStore('trips').put({ id: trip, name: 'E2E TEST import', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-19', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local', settings: {}, created_by: ana, deleted_at: null })
    tx.objectStore('members').put({ id: ana, trip_id: trip, deleted_at: null, display_name: 'Ana', color: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: ana, joinedAt: '2026-11-01T00:00:00Z' } }, quizSeen: true, timeView: 'trip', basemap: 'offline' }, version: 1 }))
  }, { trip, ana })
  await page.goto(`/t/${trip}/more/settings`)
  await page.getByRole('link', { name: 'Import a plan from a spreadsheet' }).click()
  await page.waitForURL(`**/t/${trip}/more/import`)
  const csv = 'Date,Start time,End time,Activity,Notes\n2027-03-14,7:00 am,9:00 am,Volcano sunrise,Bring a jacket\n3/15/2027,,,Free day,\nsoon,10:00,,Nope,\n'
  await page.getByLabel('Choose a CSV file').setInputFiles({ name: 'plan.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByRole('status').filter({ hasText: 'ready to' })).toHaveText('2 ready to add; 1 skipped (a date, time or name we couldn’t read): row 4.')
  await expect(page.getByLabel('What')).toHaveValue('3')
  await shoot(page, 'import-plan')
  await page.getByRole('button', { name: 'Add 2 to the plan' }).click()
  await page.waitForURL(`**/t/${trip}/plan`)
  const items = await page.evaluate(async (trip) => {
    // Wait for the app to create its database; opening it first would make an empty one.
    while (!(await indexedDB.databases()).some((d) => d.name === 'trip-hub')) { /* not created yet */ }
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result) })
    const all = await new Promise<{ trip_id: string; title: string; start_local: string; start_at: string; status: string }[]>((resolve) => { const r = db.transaction('itinerary_items').objectStore('itinerary_items').getAll(); r.onsuccess = () => resolve(r.result) })
    db.close()
    return all.filter((i) => i.trip_id === trip).map((i) => [i.title, i.start_local, i.start_at, i.status]).sort()
  }, trip)
  expect(items).toEqual([['Free day', '2027-03-15T00:00', '2027-03-15T06:00:00.000Z', 'tentative'], ['Volcano sunrise', '2027-03-14T07:00', '2027-03-14T13:00:00.000Z', 'tentative']])
})

test('past travelers come in from another tool, without email consent', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort())
  await page.route('**/rest/v1/rpc/my_organizer', (r) => r.fulfill(json({ id: 'org', display_name: 'Ana Trips', support_email: 'ana@example.com', slug: 'ana', reviewed: true, pro: true, beta: true })))
  let sent: { p_rows: unknown[] } | null = null
  await page.route('**/rest/v1/rpc/import_contacts', (r) => { sent = r.request().postDataJSON(); return r.fulfill(json({ added: 2, updated: 0 })) })
  await page.goto('/organize/import')
  await expect(page.getByText('Nobody is signed up for emails')).toBeVisible()
  const csv = 'First Name,Last Name,E-mail,Tags\nOla,Nordmann,ola@example.com,"vip; repeat"\nPat,Lee,pat@example.com,\nBad,Row,nope,\n'
  await page.getByLabel('Choose a CSV file').setInputFiles({ name: 'wetravel-export.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByRole('status').filter({ hasText: 'ready to' })).toHaveText('2 ready to import; 1 skipped (no valid email or a repeat): row 4.')
  await shoot(page, 'import-travelers')
  await page.getByRole('button', { name: 'Import 2' }).click()
  await expect(page.getByText('Added 2 travelers.')).toBeVisible()
  expect(sent!.p_rows).toEqual([{ name: 'Ola Nordmann', email: 'ola@example.com', tags: ['vip', 'repeat'] }, { name: 'Pat Lee', email: 'pat@example.com', tags: [] }])
})
