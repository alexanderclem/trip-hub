import { expect, test, type Page } from '@playwright/test'

// All app fixtures are local. No backend writes or real trips are involved.
const tripId = '00000000-0000-4000-8000-000000000b01'
const memberId = '00000000-0000-4000-8000-000000000b02'
const pollId = '00000000-0000-4000-8000-000000000b03'
const root = `/t/${tripId}`

async function seed(page: Page, baseURL: string, offline = true) {
  await page.route(url => url.protocol === 'https:' && url.origin !== new URL(baseURL).origin, route => route.abort())
  if (offline) await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }))
  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'Trip ideas' })).toBeVisible()
  await page.evaluate(async ({ tripId, memberId, pollId }) => {
    const req = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
    const tx = db.transaction(['trips', 'members', 'polls', 'poll_options'], 'readwrite')
    tx.objectStore('trips').put({ id: tripId, name: 'E2E TEST local polish', timezone: 'America/New_York', start_date: '2027-05-01', end_date: '2027-05-03', base_currency: 'USD', local_currency: 'USD', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-polish-only', settings: {}, deleted_at: null })
    tx.objectStore('members').put({ id: memberId, trip_id: tripId, display_name: 'Alex', color: null, avatar_emoji: null, deleted_at: null })
    tx.objectStore('polls').put({ id: pollId, trip_id: tripId, title: 'Choose a day out', status: 'open', kind: 'options', winner_option_id: null, closes_at: null, deleted_at: null })
    tx.objectStore('poll_options').put({ id: '00000000-0000-4000-8000-000000000b04', trip_id: tripId, poll_id: pollId, label: 'Central Park', place_id: null, deleted_at: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { quizSeen: true, trips: { [tripId]: { tripId, memberId, joinedAt: '2026-10-09T12:00:00Z' } } }, version: 1 }))
    sessionStorage.setItem('stowaway-install-dismissed', '1')
  }, { tripId, memberId, pollId })
}

async function rows(page: Page, store: string) {
  return page.evaluate(async store => {
    const req = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>(resolve => { req.onsuccess = () => resolve(req.result) })
    const all = db.transaction(store).objectStore(store).getAll()
    const result = await new Promise<Record<string, unknown>[]>(resolve => { all.onsuccess = () => resolve(all.result) })
    db.close()
    return result
  }, store)
}

async function failNextWrite(page: Page, store: string) {
  await page.evaluate(store => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === store) {
        IDBObjectStore.prototype.put = original
        throw new DOMException('Storage temporarily unavailable', 'QuotaExceededError')
      }
      return original.apply(this, args)
    }
  }, store)
}

async function putLocalRows(page: Page, rows: Record<string, Record<string, unknown>[]>) {
  await page.evaluate(async (rows) => {
    const request = indexedDB.open('trip-hub')
    const database = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const transaction = database.transaction(Object.keys(rows), 'readwrite')
    for (const [store, entries] of Object.entries(rows)) {
      for (const entry of entries) transaction.objectStore(store).put(entry)
    }
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error) })
    database.close()
  }, rows)
}

test('dialog dismissal retains modality, can be interrupted, and restores keyboard focus', async ({ page, baseURL }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await seed(page, baseURL!)
  await page.goto(`${root}/overview`)
  const trigger = page.getByRole('button', { name: 'Add', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Add to your trip' })
  await trigger.click()
  await expect(dialog).toBeVisible()
  const duringExit = await dialog.getByRole('button', { name: 'Close dialog' }).evaluate(async (button) => {
    ;(button as HTMLButtonElement).click()
    await new Promise(requestAnimationFrame)
    const modal = button.closest('dialog')!
    return { open: modal.open, modal: modal.matches(':modal') }
  })
  expect(duringExit).toEqual({ open: true, modal: true })
  // A programmatic reopen during dismissal must cancel the pending native close.
  await trigger.evaluate(button => (button as HTMLButtonElement).click())
  await page.waitForTimeout(200)
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('rapid day changes preserve the final selection, keyboard focus, and each day’s note', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/plan?day=2027-05-01`)
  const first = page.getByRole('tab', { name: /Saturday 1 May/ })
  const second = page.getByRole('tab', { name: /Sunday 2 May/ })
  const last = page.getByRole('tab', { name: /Monday 3 May/ })
  await expect(first).toHaveAttribute('aria-selected', 'true')
  await first.focus()
  await page.keyboard.press('ArrowRight')
  await expect(second).toBeFocused()
  await expect(second).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(last).toBeFocused()
  await page.keyboard.press('Home')
  await expect(first).toBeFocused()
  await page.getByText('Day notes & details', { exact: true }).click()
  await page.getByRole('button', { name: 'Add a note for this day' }).click()
  await page.getByRole('textbox', { name: 'Notes for this day' }).fill('Bring water on Saturday')
  await second.click()
  await expect(page.getByRole('textbox', { name: 'Notes for this day' })).toHaveCount(0)
  for (const tab of [last, first, second, last]) await tab.click()
  await expect(last).toHaveAttribute('aria-selected', 'true')
  await expect(last).toBeFocused()
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName(/Monday 3 May/)
  await expect(page).toHaveURL(/day=2027-05-03/)
  await first.click()
  await expect(page.getByRole('textbox', { name: 'Notes for this day' })).toHaveValue('Bring water on Saturday')
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Add to this day' })).toBeVisible()
})

test('trip tasks reflow with a long title, enlarged text, and right-to-left day navigation', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.evaluate(async (tripId) => {
    const request = indexedDB.open('trip-hub')
    const database = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const transaction = database.transaction('trips', 'readwrite')
    const store = transaction.objectStore('trips')
    const get = store.get(tripId)
    get.onsuccess = () => store.put({ ...get.result, name: 'A long-awaited adventure with the whole family, from New York to the coast and back again', settings: { journal_cover: 'coast' } })
    await new Promise<void>(resolve => { transaction.oncomplete = () => resolve() })
    database.close()
  }, tripId)
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    for (const path of ['overview', 'plan?day=2027-05-01', `more/vote/${pollId}`]) {
      await page.goto(`${root}/${path}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      for (const [width, fontSize] of [[320, '100%'], [640, '200%'], [768, '100%'], [1440, '100%']] as const) {
        await page.setViewportSize({ width, height: 900 })
        await page.evaluate(size => { document.documentElement.style.fontSize = size }, fontSize)
        const widths = await page.getByRole('main').evaluate(el => ({ available: el.clientWidth, content: el.scrollWidth }))
        expect(widths.content, `${path}, ${colorScheme}, ${width}px, ${fontSize} text`).toBeLessThanOrEqual(widths.available)
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${root}/plan?day=2027-05-01`)
  await page.evaluate(() => { document.documentElement.dir = 'rtl' })
  const first = page.getByRole('tab', { name: /Saturday 1 May/ })
  await first.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('tab', { name: /Sunday 2 May/ })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(first).toBeFocused()
  await expect(first).toHaveAttribute('aria-selected', 'true')
})

test('balances show exact values on entry and across successive changes from another tab', async ({ page, context, baseURL }) => {
  await seed(page, baseURL!)
  const friend = '00000000-0000-4000-8000-000000000b05'
  const expense = { id: 'polish-expense', trip_id: tripId, description: 'Shared dinner', category: 'food', spent_on: '2027-05-01', amount_minor: 10000, currency: 'USD', fx_rate: 1, base_currency: 'USD', base_amount_minor: 10000, payers: [{ member_id: friend, amount_minor: 10000 }], split_method: 'equal', split: [{ member_id: memberId, value: 1 }, { member_id: friend, value: 1 }], fx_source: 'same', fx_as_of: null, place_id: null, item_id: null, notes: null, deleted_at: null }
  await putLocalRows(page, { members: [{ id: friend, trip_id: tripId, display_name: 'Maya', deleted_at: null }], expenses: [expense] })
  await page.addInitScript(() => {
    const samples: string[] = []
    Object.assign(window, { balanceSamples: samples })
    new MutationObserver(() => {
      const text = document.querySelector('section[aria-label="Your balance"] em [aria-live]')?.textContent
      if (text && text !== samples.at(-1)) samples.push(text)
    }).observe(document, { subtree: true, childList: true, characterData: true })
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(`${root}/money`)
  const amount = page.locator('section[aria-label="Your balance"] em [aria-live]')
  await expect(amount).toHaveText('$50.00')
  // Exercise the actual save path: native fixture writes do not notify Dexie's live queries.
  const editor = await context.newPage()
  await editor.route(url => url.protocol === 'https:' && url.origin !== new URL(baseURL!).origin, route => route.abort())
  await editor.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }))
  await editor.goto(`${root}/money/${expense.id}`)
  await editor.getByLabel('Amount', { exact: true }).fill('120')
  await editor.getByRole('button', { name: 'Save expense', exact: true }).click()
  await expect(amount).toHaveText('$60.00')
  await editor.goto(`${root}/money/${expense.id}`)
  await editor.getByLabel('Amount', { exact: true }).fill('80')
  await editor.getByRole('button', { name: 'Save expense', exact: true }).click()
  await expect(amount).toHaveText('$40.00')
  expect(await page.evaluate(() => (window as Window & { balanceSamples: string[] }).balanceSamples)).toEqual(['$50.00', '$60.00', '$40.00'])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(() => amount.locator('span').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).isIdentity)).toBe(true)
  await editor.close()
})

test('a ticket that could not open can retry and confirms the file is saved on this phone', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  const ticketId = 'polish-retry-ticket'
  await putLocalRows(page, { attachments: [{ id: ticketId, trip_id: tripId, title: 'Museum entry', filename: 'museum.png', mime: 'image/png', kind: 'ticket', storage_path: 'local/museum.png', confirmation_code: 'MUSEUM27', uploaded_at: null, deleted_at: null }] })
  await page.goto(`${root}/tickets/${ticketId}`)
  await expect(page.getByRole('alert')).toContainText("hasn't been uploaded")
  await expect(page.getByText('MUSEUM27', { exact: true })).toBeVisible()
  // The file becomes available locally while the viewer stays open.
  await page.evaluate(async (ticketId) => {
    const request = indexedDB.open('trip-hub')
    const database = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result) })
    const transaction = database.transaction('files', 'readwrite')
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='), character => character.charCodeAt(0))
    transaction.objectStore('files').put({ name: `att:${ticketId}`, blob: new Blob([bytes], { type: 'image/png' }) })
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error) })
    database.close()
  }, ticketId)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Saved on this phone')
  await expect(page.getByRole('img', { name: 'Museum entry' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Save a copy' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a failed day-note save retains its text across day changes and can retry', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/plan?day=2027-05-01`)
  await page.getByText('Day notes & details', { exact: true }).click()
  await page.getByRole('button', { name: 'Add a note for this day' }).click()
  await page.getByRole('textbox', { name: 'Notes for this day' }).fill('Keep this note even if storage fails')
  await failNextWrite(page, 'day_notes')
  await page.getByRole('tab', { name: /Sunday 2 May/ }).click()
  await expect(page.getByRole('alert')).toContainText('Your note could not be saved')
  await page.getByRole('tab', { name: /Saturday 1 May/ }).click()
  await expect(page.getByRole('textbox', { name: 'Notes for this day' })).toHaveValue('Keep this note even if storage fails')
  await page.getByRole('button', { name: 'Retry note for Sat, 1 May' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'saved on this device' })).toBeVisible()
  await page.reload()
  await page.getByText('Day notes & details', { exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Notes for this day' })).toHaveValue('Keep this note even if storage fails')
})

test('example days update map and itinerary without requests, layout shifts or lost focus', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/')
  const figure = page.locator('.website-preview')
  await figure.scrollIntoViewIfNeeded()
  const before = await figure.boundingBox()
  const firstRoute = await page.locator('.preview-route').getAttribute('d')
  const requests: string[] = []
  page.on('request', r => requests.push(r.url()))
  const day2 = page.getByRole('button', { name: 'Day 2', exact: true })
  await day2.focus()
  await page.keyboard.press('Enter')
  await expect(day2).toBeFocused()
  await expect(day2).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'An afternoon at the Met' })).toBeVisible()
  expect(await page.locator('.preview-route').getAttribute('d')).not.toBe(firstRoute)
  await expect(page.getByRole('heading', { name: 'Coffee in the West Village' })).toHaveCount(0)
  for (const day of [3, 1, 2, 3]) await page.getByRole('button', { name: `Day ${day}`, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Walk the Brooklyn Bridge' })).toBeVisible()
  expect((await figure.boundingBox())!.height).toBeCloseTo(before!.height, 0)
  await expect(page.getByRole('status')).toContainText('Day 3')
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

test('preview reflows with long text, keyboard focus and live reduced-motion changes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Day 2', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Day 2', exact: true })).toHaveCSS('outline-style', 'solid')
  await expect(page.getByRole('button', { name: 'Day 2', exact: true })).toHaveCSS('transition-duration', '0s')
  await page.locator('#preview-day-2 h3').first().evaluate(e => { e.textContent = 'Averylongunbrokenitinerarynamethatmustremainreadable' })
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByRole('heading', { name: 'Averylongunbrokenitinerarynamethatmustremainreadable' })).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Day 3', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Walk the Brooklyn Bridge' })).toBeVisible()
})

test('public visits defer offline downloads; entering the app installs it for offline navigation', async ({ page, context }) => {
  await page.goto('/')
  await page.getByRole('heading', { level: 1 }).waitFor()
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0)
  await page.getByRole('link', { name: 'Create a trip', exact: true }).first().click()
  await expect(page.getByLabel('Trip name')).toBeVisible()
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready) && !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
  await page.goto('/')
  await page.getByRole('button', { name: 'Day 3', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Walk the Brooklyn Bridge' })).toBeVisible()
})

test('invite copying locks duplicate actions, reports failure, and permits retry', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/more/settings`)
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Invite the group' }) })
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>((resolve, reject) => {
      Object.assign(window, { finishCopy: resolve, failCopy: () => reject(new DOMException('Denied', 'NotAllowedError')), copyCalls: ((window as unknown as { copyCalls?: number }).copyCalls ?? 0) + 1 })
    }) } })
  })
  await card.getByRole('button', { name: 'Copy', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(card.getByRole('button', { name: 'Copying…' })).toBeDisabled()
  await expect(card.getByRole('button', { name: 'Share', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => (window as unknown as { copyCalls: number }).copyCalls)).toBe(1)
  await page.evaluate(() => (window as unknown as { failCopy: () => void }).failCopy())
  await expect(card.getByRole('alert')).toContainText('Could not copy')
  await card.getByRole('button', { name: 'Copy', exact: true }).click()
  await page.evaluate(() => (window as unknown as { finishCopy: () => void }).finishCopy())
  await expect(card.getByRole('button', { name: 'Copied' })).toBeEnabled()
  await expect(card.getByRole('status')).toContainText('Invite link copied')
  await expect(card.getByRole('alert')).toHaveCount(0)
})

test('vote failure preserves the choice; rapid retry saves one local revision', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/more/vote/${pollId}`)
  const group = page.getByRole('group', { name: 'Your vote for Central Park' })
  const choice = group.getByRole('button').last()
  await choice.click()
  await expect(choice).toHaveAttribute('aria-pressed', 'true')
  await failNextWrite(page, 'poll_votes')
  await group.getByRole('button').first().click()
  await expect(page.getByRole('alert')).toContainText('Your vote could not be saved')
  await expect(choice).toHaveAttribute('aria-pressed', 'true')
  await group.getByRole('button').first().evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(group.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status').filter({ hasText: 'Vote saved on this device' })).toBeVisible()
  const votes = await rows(page, 'poll_votes')
  expect(votes).toHaveLength(1)
  expect(votes[0]._lrev).toBe(2)
  await group.getByRole('button').first().click()
  await expect(group.getByRole('button').first()).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('status').filter({ hasText: 'Vote removed from this device' })).toBeVisible()
})

test('itinerary save retains input after failure and prevents duplicate submissions', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/plan/new?day=2027-05-01`)
  await page.getByLabel('Name', { exact: true }).fill('Coffee with the group')
  await failNextWrite(page, 'itinerary_items')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Storage temporarily unavailable')
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Coffee with the group')
  await page.locator('form').evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit() })
  await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: 'Coffee with the group', exact: true, level: 1 })).toBeVisible()
  expect(await rows(page, 'itinerary_items')).toHaveLength(1)
})

test('offline preparation retains real map packs, labels, and a saved ticket after reload', async ({ page, context, baseURL }) => {
  await seed(page, baseURL!, false)
  // Simulated backend boundaries; the actual offline file download/cache/render path is exercised.
  await page.route('**/rest/v1/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }))
  await page.route('https://open.er-api.com/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: 'success', rates: { USD: 1, GTQ: 7.6 } }) }))
  await page.evaluate(async ({ tripId, memberId }) => {
    const req = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>(resolve => { req.onsuccess = () => resolve(req.result) })
    const get = db.transaction('trips').objectStore('trips').get(tripId)
    const trip = await new Promise<Record<string, unknown>>(resolve => { get.onsuccess = () => resolve(get.result) })
    const tx = db.transaction(['trips', 'attachments', 'files', 'places'], 'readwrite')
    tx.objectStore('trips').put({ ...trip, start_date: null, end_date: null, offline_pack: {
      id: 'guatemala-2027', label: 'Guatemala', version: '20260930',
      overview: { name: 'guatemala-2027-overview.pmtiles', url: '/packs/guatemala-2027-overview.pmtiles', bytes: 6449250 },
      detail: { name: 'guatemala-2027-detail.pmtiles', url: '/packs/guatemala-2027-detail.pmtiles', bytes: 9197744 },
    } })
    const blob = new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9kAAAAASUVORK5CYII='), c => c.charCodeAt(0))], { type: 'image/png' })
    tx.objectStore('files').put({ name: 'att:local-ticket', blob })
    tx.objectStore('attachments').put({ id: 'local-ticket', trip_id: tripId, title: 'Saved boarding pass', kind: 'ticket', mime: 'image/png', filename: 'boarding.png', bytes: blob.size, storage_path: 'local-test/boarding.png', uploaded_at: '2026-10-08T12:00:00Z', created_by: memberId, deleted_at: null })
    tx.objectStore('places').put({ id: 'local-place', trip_id: tripId, name: 'Parque Central', lat: 14.5572, lng: -90.7334, category: 'sight', status: 'shortlist', deleted_at: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
  }, { tripId, memberId })
  await page.goto(`${root}/more/settings`)
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready) && !!navigator.serviceWorker.controller)
  await page.getByRole('button', { name: 'Download everything for offline', exact: true }).click()
  await expect(page.getByText(/Ready for offline · checked/)).toBeVisible({ timeout: 60000 })
  await context.setOffline(true)
  await page.goto(`${root}/tickets/local-ticket`)
  await expect(page.getByRole('img', { name: 'Saved boarding pass' })).toBeVisible()
  expect(await page.getByRole('img', { name: 'Saved boarding pass' }).evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(1)
  const failures: string[] = []
  page.on('requestfailed', request => { if (/map-assets|\.pmtiles|maplibre-gl-worker|\/assets\//.test(request.url())) failures.push(request.url()) })
  await page.goto(`${root}/map`)
  await expect(page.getByText('Offline map', { exact: true })).toBeVisible()
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible()
  await page.waitForTimeout(2500)
  // MapLibre exposes rendered labels in DOM-independent canvas pixels; use a screenshot for visual QA.
  await page.screenshot({ path: '.design/screenshots/polish/offline-map.png' })
  expect(failures).toEqual([])
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name))
  expect(resources.some(url => url.includes('/map-assets/fonts/'))).toBe(true)
})
