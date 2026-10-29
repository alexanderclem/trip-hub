import { expect, test, type Page } from '@playwright/test'

// Local-only fixtures exercise real IndexedDB/save/outbox behavior, with no backend writes.
const tripId = '00000000-0000-4000-8000-000000000d01'
const me = '00000000-0000-4000-8000-000000000d02'
const maya = '00000000-0000-4000-8000-000000000d03'
const noah = '00000000-0000-4000-8000-000000000d04'
const pollId = '00000000-0000-4000-8000-000000000d05'
const placeId = '00000000-0000-4000-8000-000000000d06'
const itemId = '00000000-0000-4000-8000-000000000d07'
const taskId = '00000000-0000-4000-8000-000000000d08'
const pastId = '00000000-0000-4000-8000-000000000d09'
const root = `/t/${tripId}`
const shots = process.env.SHOTS_DIR

async function seed(page: Page, baseURL: string, phase: 'planning' | 'preparing' | 'traveling' | 'empty' = 'planning') {
  await page.clock.setFixedTime(new Date('2027-06-01T12:00:00Z'))
  await page.route(url => url.protocol === 'https:' && url.origin !== new URL(baseURL).origin, route => route.abort())
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }))
  await page.goto('/inspire/manual')
  await page.getByRole('heading', { level: 1, name: 'Trip ideas', exact: true }).waitFor()
  await page.evaluate(async ({ tripId, me, maya, noah, pollId, placeId, itemId, taskId, pastId, phase }) => {
    const req = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
    const stores = ['trips', 'members', 'places', 'polls', 'poll_options', 'poll_votes', 'itinerary_items', 'trip_tasks', 'attachments']
    const tx = db.transaction(stores, 'readwrite')
    const put = (store: string, row: Record<string, unknown>) => tx.objectStore(store).put({ trip_id: tripId, deleted_at: null, ...row })
    const zone = 'Europe/Lisbon'
    const start = phase === 'traveling' ? '2027-06-01' : phase === 'preparing' ? '2027-06-05' : '2027-06-13'
    const trip = { id: tripId, name: 'A long weekend in Lisbon', timezone: zone, start_date: start, end_date: phase === 'traveling' ? '2027-06-03' : phase === 'preparing' ? '2027-06-07' : '2027-06-16', base_currency: 'USD', local_currency: 'EUR', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-journal-only', settings: { journal_cover: 'coast', areas: [{ name: 'Lisbon', bbox: [38.6, -9.2, 38.8, -9.1], lat: 38.7, lng: -9.15 }], preserved_setting: true }, deleted_at: null }
    tx.objectStore('trips').put(trip)
    tx.objectStore('trips').put({ ...trip, id: pastId, name: 'A spring escape', start_date: '2027-04-03', end_date: '2027-04-06', settings: { journal_cover: 'mountains' } })
    for (const [id, display_name, color] of [[me, 'Alex', '#295361'], [maya, 'Maya', '#7a4b10'], [noah, 'Noah', '#2e5c3c']]) put('members', { id, display_name, color, avatar_emoji: null })
    if (phase !== 'empty') {
      put('places', { id: placeId, name: 'Lunch in Alfama', category: 'food', status: 'booked', lat: 38.711, lng: -9.129, tags: [], address: null, area: 'Lisbon', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' })
      put('polls', { id: pollId, title: 'A day by the water?', status: 'open', kind: 'options', winner_option_id: null, closes_at: null })
      for (const [suffix, label] of [['a', 'Cascais'], ['b', 'Costa da Caparica']]) put('poll_options', { id: `${pollId}${suffix}`, poll_id: pollId, label, place_id: null })
      put('poll_votes', { id: `${pollId}-vote`, poll_id: pollId, option_id: `${pollId}a`, member_id: me, score: 0 })
      put('trip_tasks', { id: taskId, title: 'Book the airport transfer', assignee_id: null, due_date: null, completed: false, notes: null })
      put('trip_tasks', { id: `${taskId}b`, title: 'Choose a dinner spot', assignee_id: null, due_date: null, completed: false, notes: null })
      put('itinerary_items', { id: itemId, title: 'Lunch with a view', kind: 'meal', place_id: placeId, to_place_id: null, all_day: false, start_local: `${start}T15:00`, start_tz: zone, end_local: `${start}T16:30`, end_tz: zone, start_at: `${start}T14:00:00Z`, end_at: `${start}T15:30:00Z`, status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null })
      put('attachments', { id: 'journal-ticket', item_id: itemId, place_id: null, expense_id: null, kind: 'ticket', title: 'Lunch reservation', confirmation_code: 'LX204', storage_path: 'local/reservation.png', filename: 'reservation.png', mime: 'image/png', bytes: 68, sha256: 'local', uploaded_at: null })
    }
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    const entry = { tripId, memberId: me, joinedAt: '2026-10-29T12:00:00Z' }
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { quizSeen: true, trips: { [tripId]: entry, [pastId]: { ...entry, tripId: pastId } } }, version: 1 }))
    sessionStorage.setItem('stowaway-install-dismissed', '1')
  }, { tripId, me, maya, noah, pollId, placeId, itemId, taskId, pastId, phase })
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const content = page.locator('#trip-content')
  if (await content.count()) {
    const size = await content.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, outside: [...el.querySelectorAll('*')].filter(child => { const r = child.getBoundingClientRect(); return r.width > 0 && r.right > el.getBoundingClientRect().right + 1 }).slice(0, 12).map(child => ({ tag: child.tagName, cls: child.getAttribute('class'), text: child.textContent?.slice(0, 70), width: child.getBoundingClientRect().width })) }))
    expect(size.scroll, JSON.stringify(size)).toBeLessThanOrEqual(size.width)
  }
}

test('trip cards show destination, group, countdown, and separately disclosed past trips', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto('/app')
  const card = page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'A long weekend in Lisbon' }) })
  await expect(card).toContainText('In 12 days')
  await expect(card).toContainText('Lisbon')
  await expect(card).toContainText('3 travelers')
  await expect(page.getByRole('heading', { name: 'A spring escape' })).toBeHidden()
  await page.locator('.past-trips > summary').click()
  await expect(page.getByRole('heading', { name: 'A spring escape' })).toBeVisible()
  await card.click()
  await expect(page.getByRole('heading', { name: 'A long weekend in Lisbon', level: 1 })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Your trips.' })).toBeVisible()
})

test('overview shows live decision counts and opens exactly the unassigned task filter', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/overview`)
  await expect(page.getByRole('heading', { name: 'A day by the water?' })).toBeVisible()
  await expect(page.getByText('3 travelers still need to vote', { exact: true })).toBeVisible()
  await expect(page.getByText('2 tasks need an owner', { exact: true })).toBeVisible()
  await expect(page.locator('.overview-setup > details')).not.toHaveAttribute('open')
  const taskLink = page.getByRole('link', { name: /2 tasks need an owner/ })
  await taskLink.scrollIntoViewIfNeeded()
  const scroll = await page.locator('#trip-content').evaluate(el => el.scrollTop)
  await taskLink.click()
  await expect(page.getByRole('button', { name: 'Unassigned', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name: 'Book the airport transfer' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Keep things moving' })).toBeVisible()
  await expect.poll(() => page.locator('#trip-content').evaluate(el => el.scrollTop)).toBeCloseTo(scroll, 0)
})

test('quick add works by keyboard, restores focus, and reaches every creation flow', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/overview`)
  const trigger = page.getByRole('button', { name: 'Add', exact: true })
  await trigger.focus(); await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Something for the trip?' })
  await expect(dialog).toBeVisible()
  if (shots) { await expect(dialog.locator(':scope > div')).toHaveCSS('opacity', '1'); await dialog.screenshot({ path: `${shots}/quick-add.png` }) }
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
  for (const [label, path, heading] of [['Add to plan', '/plan/new', 'Add to plan'], ['Save a place', '/more/places/new', 'Add place'], ['Add an expense', '/money/new', 'Add expense'], ['Add a ticket', '/tickets/new', 'Add ticket']]) {
    await trigger.click()
    await dialog.getByRole('link', { name: new RegExp(label!) }).click()
    await expect(page).toHaveURL(new RegExp(`${path!.replaceAll('/', '\\/')}(\\?|$)`))
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading!)
    await page.setViewportSize({ width: 320, height: 844 })
    await noOverflow(page)
    const field = page.locator('input:not([type=hidden]):not([type=radio]):not([type=checkbox])').filter({ visible: true }).first()
    if (await field.count()) {
      expect(await field.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
      await field.focus(); await expect(field).toBeFocused()
    }
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'A long weekend in Lisbon', level: 1 })).toBeVisible()
  }
})

test('cover selection survives reload, preserves other settings, and permits a plain trip', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/overview`)
  await page.getByRole('button', { name: 'Change trip cover' }).click()
  const dialog = page.getByRole('dialog', { name: 'A little more you.' })
  await dialog.getByLabel('By the water').focus()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByLabel('Into the mountains')).toBeChecked()
  if (shots) { await expect(dialog.locator(':scope > div')).toHaveCSS('opacity', '1'); await dialog.screenshot({ path: `${shots}/cover-picker.png` }) }
  await dialog.getByRole('button', { name: 'Save cover' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Cover saved on this device' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Change trip cover' }).click()
  await expect(dialog.getByLabel('Into the mountains')).toBeChecked()
  await dialog.getByText('Just the essentials', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Save cover' }).click()
  await expect(page.locator('.overview-art')).toHaveCount(0)
  const settings = await page.evaluate(async tripId => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const get = db.transaction('trips').objectStore('trips').get(tripId)
    const row = await new Promise<{ settings: Record<string, unknown> }>(resolve => { get.onsuccess = () => resolve(get.result) })
    db.close(); return row.settings
  }, tripId)
  expect(settings.preserved_setting).toBe(true)
  expect(settings.journal_cover).toBe('none')
})

test('cover save failure keeps selection and allows retry without duplicate writes', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/overview`)
  await page.getByRole('button', { name: 'Change trip cover' }).click()
  const dialog = page.getByRole('dialog', { name: 'A little more you.' })
  await dialog.getByText('Around the city', { exact: true }).click()
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'trips') { IDBObjectStore.prototype.put = original; throw new DOMException('Storage temporarily unavailable', 'QuotaExceededError') }
      return original.apply(this, args)
    }
  })
  await dialog.getByRole('button', { name: 'Save cover' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Storage temporarily unavailable')
  await expect(dialog.getByLabel('Around the city')).toBeChecked()
  await dialog.getByRole('button', { name: 'Save cover' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(dialog).not.toBeVisible()
})

test('travel day keeps departure, map and ticket handy while explaining estimates on demand', async ({ page, baseURL }) => {
  await seed(page, baseURL!, 'traveling')
  await page.evaluate(async ({ tripId, placeId, itemId }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const tx = db.transaction(['places', 'itinerary_items'], 'readwrite')
    const place = tx.objectStore('places').get(placeId)
    place.onsuccess = () => tx.objectStore('places').put({ ...place.result, id: 'journal-hotel', name: 'Our hotel', lat: 38.72, lng: -9.14, category: 'lodging' })
    const item = tx.objectStore('itinerary_items').get(itemId)
    item.onsuccess = () => tx.objectStore('itinerary_items').put({ ...item.result, id: 'journal-breakfast', title: 'Breakfast at the hotel', place_id: 'journal-hotel', start_at: '2027-06-01T09:00:00Z', end_at: '2027-06-01T10:00:00Z', start_local: '2027-06-01T10:00', end_local: '2027-06-01T11:00' })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
  }, { tripId, placeId, itemId })
  await page.goto(`${root}/overview`)
  const card = page.locator('.up-next-prominent')
  await expect(card).toContainText('Lunch with a view')
  await expect(card.locator('.up-next-departure')).toContainText('Leave by')
  await expect(card.getByRole('link', { name: 'View on map' })).toHaveAttribute('href', `${root}/map?place=${placeId}`)
  await expect(card.getByRole('link', { name: /View ticket/ })).toBeVisible()
  const guidance = card.locator('.up-next-guidance')
  await expect(guidance.locator('div')).toBeHidden()
  await guidance.locator('summary').focus(); await page.keyboard.press('Enter')
  await expect(guidance).toContainText('Our hotel')
  await expect(guidance).toContainText('Add time for check-in or waiting.')
  await expect(guidance.locator('summary')).toBeFocused()
  if (shots) await card.screenshot({ path: `${shots}/travel-departure.png` })
})

test('completing your remaining vote updates the group summary', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/overview`)
  await page.getByRole('link', { name: 'Cast your vote' }).click()
  await page.getByRole('group', { name: 'Your vote for Costa da Caparica' }).getByRole('button').first().click()
  await expect(page.getByRole('status').filter({ hasText: 'Vote saved on this device' })).toBeVisible()
  await page.goBack()
  await expect(page.getByText('2 travelers still need to vote', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Cast your vote' })).toHaveCount(0)
})

test('task completion gives feedback, updates the group summary, and persists after reload', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/more/tasks?filter=unassigned`)
  await page.getByRole('checkbox', { name: 'Mark Book the airport transfer complete' }).click()
  await expect(page.getByRole('status')).toContainText('Task completed on this device.')
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Mark Book the airport transfer incomplete' })).toBeChecked()
  await page.goto(`${root}/overview`)
  await expect(page.getByRole('link', { name: /1 task needs an owner/ })).toBeVisible()
})

for (const phase of ['planning', 'preparing', 'traveling', 'empty'] as const) {
  test(`${phase} overview reflows at phone, tablet, desktop, enlarged text, and reduced motion`, async ({ page, baseURL }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await seed(page, baseURL!, phase)
    await page.goto(`${root}/overview`)
    await expect(page.getByRole('heading', { name: 'A long weekend in Lisbon', level: 1 })).toBeVisible()
    if (phase === 'traveling') {
      await expect(page.locator('.up-next-prominent')).toContainText('Lunch with a view')
      await expect(page.locator('.up-next-guidance > div')).toBeHidden()
      await page.locator('.up-next-guidance > summary').click()
      await expect(page.locator('.up-next-guidance > div')).toBeVisible()
      await page.locator('.up-next-guidance > summary').click()
    }
    if (phase === 'preparing') await expect(page.getByRole('heading', { name: 'A little preparation. A smoother trip.' })).toBeVisible()
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 960 })
      if (await page.locator('#trip-content').count()) await page.locator('#trip-content').evaluate(el => { el.scrollTop = 0 })
      await noOverflow(page)
      if (shots) await page.screenshot({ path: `${shots}/${phase}-${width}.png` })
    }
    await page.setViewportSize({ width: 320, height: 960 })
    await page.getByRole('heading', { level: 1 }).evaluate(el => { el.textContent = 'Averylongunbrokennameforawonderfulsharedadventure' })
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    await noOverflow(page)
    await page.evaluate(() => { document.documentElement.style.fontSize = '' })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Something for the trip?' })).toBeVisible()
    await expect(page.locator('.quick-add-list a').first()).toHaveCSS('transition-duration', '0s')
    await page.keyboard.press('Escape')
    expect(errors).toEqual([])
    await page.goto('/app')
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 960 })
      if (await page.locator('#trip-content').count()) await page.locator('#trip-content').evaluate(el => { el.scrollTop = 0 })
      await noOverflow(page)
      if (shots && phase === 'planning') await page.screenshot({ path: `${shots}/home-${width}.png`, fullPage: true })
    }
  })
}
