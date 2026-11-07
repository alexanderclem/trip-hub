import { expect, test, type Page } from '@playwright/test'

// Synthetic local storage only. Never call the live backend or create a real trip.
const tripId = '00000000-0000-4000-8000-00000000f001'
const me = '00000000-0000-4000-8000-00000000f002'
const museumId = '00000000-0000-4000-8000-00000000f003'
const lunchId = '00000000-0000-4000-8000-00000000f004'
const ticketId = '00000000-0000-4000-8000-00000000f005'
const root = `/t/${tripId}`

async function seed(page: Page, baseURL: string) {
  await page.route(url => url.protocol === 'https:' && url.origin !== new URL(baseURL).origin, route => route.abort())
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }))
  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'Trip ideas' })).toBeVisible()
  await page.evaluate(async ids => {
    // Wait for the app to create its database; opening it first would make an empty one.
    while (!(await indexedDB.databases()).some((d) => d.name === 'trip-hub')) { /* not created yet */ }
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const tx = db.transaction(['trips', 'members', 'itinerary_items', 'attachments', 'files'], 'readwrite')
    tx.objectStore('trips').put({ id: ids.tripId, name: 'Local itinerary test', timezone: 'America/New_York', start_date: '2027-05-01', end_date: '2027-05-05', base_currency: 'USD', local_currency: 'USD', route_factor_low: 1.4, route_factor_high: 2, share_token: 'local-only', settings: {}, deleted_at: null })
    tx.objectStore('members').put({ id: ids.me, trip_id: ids.tripId, display_name: 'Alex', color: null, deleted_at: null })
    const common = { trip_id: ids.tripId, kind: 'activity', place_id: null, to_place_id: null, all_day: false, start_tz: 'America/New_York', end_tz: 'America/New_York', status: 'confirmed', confirmation_code: 'MUSEUM1', attendee_ids: null, details: {}, notes: 'Meet at the entrance', est_cost_minor: null, est_cost_currency: null, created_at: '2026-11-01T12:00:00Z', created_by: ids.me, deleted_at: null }
    tx.objectStore('itinerary_items').put({ ...common, id: ids.museumId, title: 'Museum', start_local: '2027-05-01T09:00', end_local: '2027-05-01T10:00', start_at: '2027-05-01T13:00:00.000Z', end_at: '2027-05-01T14:00:00.000Z' })
    tx.objectStore('itinerary_items').put({ ...common, id: ids.lunchId, title: 'Lunch', start_local: '2027-05-01T12:00', end_local: '2027-05-01T13:00', start_at: '2027-05-01T16:00:00.000Z', end_at: '2027-05-01T17:00:00.000Z' })
    tx.objectStore('attachments').put({ id: ids.ticketId, trip_id: ids.tripId, item_id: null, kind: 'ticket', title: 'Boarding pass', confirmation_code: 'ABC123', filename: 'boarding.png', mime: 'image/png', storage_path: 'local/boarding.png', uploaded_at: '2026-11-01T12:00:00Z', created_at: '2026-11-01T12:00:00Z', deleted_at: null, details: { title: 'Flight', merchant: 'United', date: '2027-04-01', amount: null, currency: null, flight: 'UA 42', confirmation_code: 'ABC123', notes: null, start_date: '2027-05-03', start_time: '08:15', end_date: '2027-05-03', end_time: '10:15', start_timezone: 'America/New_York', end_timezone: 'America/Chicago', item_kind: 'flight' } })
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='), c => c.charCodeAt(0))
    tx.objectStore('files').put({ name: `att:${ids.ticketId}`, blob: new Blob([bytes], { type: 'image/png' }) })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { quizSeen: true, trips: { [ids.tripId]: { tripId: ids.tripId, memberId: ids.me, joinedAt: '2026-11-01T12:00:00Z' } } }, version: 1 }))
    sessionStorage.setItem('stowaway-install-dismissed', '1')
  }, { tripId, me, museumId, lunchId, ticketId })
}

async function read(page: Page, store: string) {
  return page.evaluate(async store => {
    // Wait for the app to create its database; opening it first would make an empty one.
    while (!(await indexedDB.databases()).some((d) => d.name === 'trip-hub')) { /* not created yet */ }
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const get = db.transaction(store).objectStore(store).getAll()
    const rows = await new Promise<Record<string, any>[]>(resolve => { get.onsuccess = () => resolve(get.result) })
    db.close(); return rows
  }, store)
}

test('reschedule previews a day shift, saves both activities, and undoes it after navigation', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/plan/${museumId}`)
  await page.getByRole('button', { name: 'Reschedule', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Reschedule', exact: true })
  await dialog.getByLabel('Date', { exact: true }).fill('2027-05-02')
  await dialog.getByLabel(/^Start time/).fill('10:00')
  await dialog.getByLabel('Shift later activities on this day').check()
  await expect(dialog.getByRole('region', { name: 'Schedule preview' })).toContainText('Lunch')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await page.waitForURL(`**/plan?day=2027-05-02`)
  await expect.poll(async () => (await read(page, 'itinerary_items')).find(i => i.id === lunchId)!.start_local).toBe('2027-05-02T13:00')
  await page.getByRole('button', { name: /^Undo:/ }).click()
  await expect.poll(async () => (await read(page, 'itinerary_items')).find(i => i.id === museumId)!.start_local).toBe('2027-05-01T09:00')
  await expect.poll(async () => (await read(page, 'itinerary_items')).find(i => i.id === lunchId)!.start_local).toBe('2027-05-01T12:00')
  await page.reload()
  const row = (await read(page, 'itinerary_items')).find(i => i.id === museumId)!
  expect(JSON.parse(row.details.stowaway_changes_v1)).toHaveLength(2)
  await page.goto(`${root}/activity`)
  await expect(page.getByText(/moved “Museum” from 1 May 2027, 09:00 EDT to 2 May 2027, 10:00 EDT/)).toBeVisible()
})

test('duplicate reviews a separate item without copying a booking code and supports undo', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/plan/${museumId}`)
  await page.getByRole('link', { name: 'Duplicate', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Duplicate item', exact: true })).toBeVisible()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Museum')
  await page.getByLabel('Name', { exact: true }).fill('Museum again')
  await page.getByLabel('Start date', { exact: true }).fill('2027-05-03')
  await page.getByRole('button', { name: 'Add copy', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Museum again', exact: true })).toBeVisible()
  const rows = await read(page, 'itinerary_items')
  const copy = rows.find(i => i.title === 'Museum again')!
  expect(copy.id).not.toBe(museumId)
  expect(copy.confirmation_code).toBeNull()
  expect(copy.status).toBe('tentative')
  expect(rows.find(i => i.id === museumId)!.start_local).toBe('2027-05-01T09:00')
  await page.getByRole('button', { name: /^Undo:/ }).click()
  await expect.poll(async () => (await read(page, 'itinerary_items')).filter(i => !i.deleted_at).length).toBe(2)
})

test('ticket review retains extracted fields after a failed link, retries once, and prevents duplicate imports', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/tickets/${ticketId}`)
  await page.getByRole('link', { name: 'Add to itinerary', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review itinerary item', exact: true })).toBeVisible()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('United UA 42')
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('2027-05-03')
  await expect(page.getByLabel('Start time', { exact: true })).toHaveValue('08:15')
  await expect(page.getByLabel('End time zone', { exact: true })).toHaveValue('America/Chicago')
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'attachments') { IDBObjectStore.prototype.put = original; throw new DOMException('Storage temporarily unavailable', 'QuotaExceededError') }
      return original.apply(this, args)
    }
  })
  await page.getByRole('button', { name: 'Add to itinerary', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect((await read(page, 'itinerary_items')).filter(i => i.title === 'United UA 42')).toHaveLength(0)
  expect((await read(page, 'attachments'))[0]!.item_id).toBeNull()
  await expect(page.getByLabel('Start time', { exact: true })).toHaveValue('08:15')
  await page.getByRole('button', { name: 'Add to itinerary', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'United UA 42', exact: true })).toBeVisible()
  const imported = (await read(page, 'itinerary_items')).filter(i => i.title === 'United UA 42')
  expect(imported).toHaveLength(1)
  expect(imported[0]!.confirmation_code).toBe('ABC123')
  expect((await read(page, 'attachments'))[0]!.item_id).toBe(imported[0]!.id)
  await page.goto(`${root}/plan/new?ticket=${ticketId}`)
  await expect(page.getByText('Already linked to United UA 42.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'View itinerary item' })).toBeVisible()
  expect((await read(page, 'itinerary_items')).filter(i => i.title === 'United UA 42')).toHaveLength(1)
})

test('the landing page uses labels without demo instructions', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Plan a tripwith friends.')
  await expect(page.locator('.tag-stop-head .tag-lede')).toHaveCount(0)
  await expect(page.getByText(/Score the ideas|Cast your vote\.|Download before you go|Open the invite\. Pick/)).toHaveCount(0)
})

test('another traveler’s specific changes appear on the overview and in the new changes section', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.evaluate(async ({ tripId, museumId }) => {
    // Wait for the app to create its database; opening it first would make an empty one.
    while (!(await indexedDB.databases()).some((d) => d.name === 'trip-hub')) { /* not created yet */ }
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const tx = db.transaction(['itinerary_items', 'members'], 'readwrite')
    tx.objectStore('members').put({ id: 'maya', trip_id: tripId, display_name: 'Maya', color: null, deleted_at: null })
    const get = tx.objectStore('itinerary_items').get(museumId)
    get.onsuccess = () => tx.objectStore('itinerary_items').put({ ...get.result, details: { stowaway_changes_v1: JSON.stringify([{ id: 'from-maya', at: new Date().toISOString(), by: 'maya', title: 'Museum', text: 'moved “Museum” from 09:00 to 10:00' }]) } })
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve() })
    db.close()
  }, { tripId, museumId })
  await page.goto(`${root}/overview`)
  await expect(page.getByRole('heading', { name: 'Since your last visit', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Since your last visit' }).getByRole('link').filter({ hasText: 'moved “Museum” from 09:00 to 10:00' })).toBeVisible()
  // Make it unread again so the full Changes page can exercise its new/earlier grouping.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('trip-hub-device')!)
    saved.state.activitySeen = {}
    localStorage.setItem('trip-hub-device', JSON.stringify(saved))
  })
  await page.goto(`${root}/activity`)
  await expect(page.getByRole('heading', { name: 'Since your last visit', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Earlier', exact: true })).toBeVisible()
  await page.getByRole('link').filter({ hasText: 'moved “Museum” from 09:00 to 10:00' }).click()
  await expect(page.getByRole('heading', { name: 'Museum', exact: true })).toBeVisible()
})

test('a new file can be saved straight into itinerary review, with unknown times left blank', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/tickets/new`)
  await page.getByLabel('Choose file').setInputFiles({ name: 'shuttle.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') })
  await page.getByLabel('Name', { exact: true }).fill('Shuttle ticket')
  await page.getByLabel('Confirmation code', { exact: true }).fill('BUS123')
  await page.getByRole('button', { name: 'Save and add to itinerary', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review itinerary item', exact: true })).toBeVisible()
  await expect(page.getByLabel('Start time', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Shuttle ticket')
  await page.getByLabel('Start time', { exact: true }).fill('10:30')
  await page.getByText('Activity · Type and locations', { exact: true }).click()
  await page.getByRole('radio', { name: 'Transport', exact: true }).click()
  await page.getByRole('button', { name: 'Add to itinerary', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Shuttle ticket', exact: true })).toBeVisible()
  const row = (await read(page, 'itinerary_items')).find(i => i.title === 'Shuttle ticket')!
  const att = (await read(page, 'attachments')).find(a => a.title === 'Shuttle ticket')!
  expect(row.kind).toBe('transport')
  expect(row.confirmation_code).toBe('BUS123')
  expect(att.item_id).toBe(row.id)
  expect((await read(page, 'files')).some(file => file.name === `att:${att.id}`)).toBe(true)
})

test('hosted travelers cannot reschedule, duplicate or import tickets into the shared plan', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.evaluate(tripId => {
    const saved = JSON.parse(localStorage.getItem('trip-hub-device')!)
    saved.state.access = { [tripId]: { role: 'traveler', mode: 'hosted', epoch: 0, removed: false, organized: true, canRemove: false, removedMembers: [] } }
    localStorage.setItem('trip-hub-device', JSON.stringify(saved))
  }, tripId)
  await page.goto(`${root}/plan/${museumId}`)
  await expect(page.getByRole('heading', { name: 'Museum', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reschedule', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Duplicate', exact: true })).toHaveCount(0)
  await page.goto(`${root}/tickets/${ticketId}`)
  await expect(page.getByRole('link', { name: 'Add to itinerary', exact: true })).toHaveCount(0)
  await page.goto(`${root}/plan/new?ticket=${ticketId}`)
  await expect(page.getByText('You do not have permission to edit this itinerary.')).toBeVisible()
  expect((await read(page, 'itinerary_items')).filter(i => !i.deleted_at)).toHaveLength(2)
})
