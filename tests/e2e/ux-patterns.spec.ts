import { expect, test, type Page } from '@playwright/test'

// Every fixture is local. External requests are blocked: no real accounts, trips, or payments.
test.use({ serviceWorkers: 'block', storageState: { cookies: [], origins: [] } })
const tripId = '00000000-0000-4000-8000-000000000961'
const memberId = '00000000-0000-4000-8000-000000000962'
const taskId = '00000000-0000-4000-8000-000000000963'
const root = `/t/${tripId}`
const shots = process.env.SHOTS_DIR ?? 'test-results/ux-patterns'

test.beforeEach(async ({ page }) => { await page.route('https://**/*', (route) => route.abort()) })

async function seed(page: Page) {
  await page.addInitScript(({ tripId, memberId }) => {
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true })
    localStorage.setItem('trip-hub-device', JSON.stringify({ version: 1, state: {
      trips: { [tripId]: { tripId, memberId, joinedAt: '2026-11-03T12:00:00Z' } }, quizSeen: true, setupDismissed: { [tripId]: true },
    } }))
  }, { tripId, memberId })
  await page.goto('/app')
  await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).some((entry) => entry.name === 'trip-hub'))).toBe(true)
  await page.evaluate(async ({ tripId, memberId, taskId }) => {
    // Wait for the app to create its database; opening it first would make an empty one.
    while (!(await indexedDB.databases()).some((d) => d.name === 'trip-hub')) { /* not created yet */ }
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('trip-hub'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = database.transaction(['trips', 'members', 'trip_tasks'], 'readwrite')
    const base = { trip_id: tripId, created_at: '2026-11-03T12:00:00Z', updated_at: '2026-11-03T12:00:00Z', created_by: null, updated_by: null, deleted_at: null }
    tx.objectStore('trips').put({ ...base, id: tripId, name: 'E2E TEST Lake weekend', timezone: 'America/Los_Angeles', start_date: '2027-06-11', end_date: '2027-06-14', base_currency: 'USD', local_currency: 'USD', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'fixture-only', settings: {} })
    tx.objectStore('members').put({ ...base, id: memberId, display_name: 'Alex', color: null, avatar_emoji: null })
    tx.objectStore('trip_tasks').put({ ...base, id: taskId, title: 'Book the shuttle', notes: 'Meet at the station', assignee_id: memberId, due_date: null, completed: false })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    database.close()
  }, { tripId, memberId, taskId })
  await page.goto(`${root}/more/tasks`)
  await expect(page.getByRole('checkbox', { name: 'Mark Book the shuttle complete', exact: true })).toBeVisible()
}

async function storedTask(page: Page) {
  return page.evaluate(async (taskId) => {
    // Wait for the app to create its database; opening it first would make an empty one.
    while (!(await indexedDB.databases()).some((d) => d.name === 'trip-hub')) { /* not created yet */ }
    const database = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open('trip-hub'); request.onsuccess = () => resolve(request.result) })
    const request = database.transaction('trip_tasks').objectStore('trip_tasks').get(taskId)
    const result = await new Promise<{ completed: boolean; notes: string }>((resolve) => { request.onsuccess = () => resolve(request.result) })
    database.close()
    return result
  }, taskId)
}

test('public pages render useful HTML before JavaScript, with distinct metadata', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block', baseURL })
  const page = await context.newPage()
  const titles = new Set<string>()
  for (const path of ['/', '/how-it-works', '/operators', '/pricing', '/help']) {
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    titles.add(await page.title())
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://joinstowaway.app${path === '/' ? '' : path}`)
    await expect(page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Pricing', exact: true })).toBeVisible()
  }
  expect(titles.size).toBe(5)
  await context.close()
})

test('marketing navigation, availability and reflow work on phone and desktop', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('navigation', { name: 'Website pages' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Website pages' }).getByRole('link', { name: 'Pricing', exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused()
  for (const path of ['/', '/how-it-works', '/operators', '/pricing', '/help']) {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (width === 390 || width === 1440) await page.screenshot({ path: `${shots}/${path.replaceAll('/', '') || 'home'}-${width}.png`, fullPage: true })
    }
  }
  expect(errors).toEqual([])
})

test('command search supports keyboard navigation without intercepting text entry', async ({ page }) => {
  await seed(page)
  await page.keyboard.press('Control+k')
  const search = page.getByRole('combobox', { name: 'Search trip commands' })
  await expect(search).toBeFocused()
  await page.screenshot({ path: `${shots}/command-menu-390.png` })
  await search.fill('ticket')
  await expect(page.getByRole('option', { name: 'Tickets & documents' })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await page.waitForURL(`${root}/tickets`)
  await expect(page.getByRole('heading', { name: 'Tickets', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Go anywhere in your trip' })).not.toBeVisible()
  await page.getByRole('button', { name: 'Search trip commands' }).focus()
  await page.keyboard.press('/')
  await expect(search).toBeFocused()
  await search.fill('no such command')
  await expect(page.getByText('No matching commands. Try “plan” or “tickets”.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Go anywhere in your trip' })).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.outerHTML.slice(0, 300))).toBe('Search trip commands')
  await page.goto(`${root}/more/tasks/${taskId}`)
  const title = page.getByLabel('Task', { exact: true })
  await title.fill('Typing ')
  await title.press('/')
  await expect(title).toHaveValue('Typing /')
  await expect(page.getByRole('dialog', { name: 'Go anywhere in your trip' })).not.toBeVisible()
})

test('task completion rolls back on local failure and undo survives navigation', async ({ page }) => {
  await seed(page)
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'trip_tasks') { IDBObjectStore.prototype.put = original; throw new DOMException('Test storage failure', 'QuotaExceededError') }
      return original.apply(this, args)
    }
  })
  await page.getByRole('checkbox').click()
  await expect(page.getByRole('alert')).toContainText('Test storage failure')
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  expect((await storedTask(page)).completed).toBe(false)
  await page.getByRole('checkbox').click()
  await expect(page.getByRole('button', { name: 'Undo task change: Book the shuttle' })).toBeVisible()
  await page.getByRole('button', { name: 'Search trip commands' }).click()
  await page.getByRole('combobox', { name: 'Search trip commands' }).fill('day-by-day')
  await page.keyboard.press('Enter')
  await page.waitForURL(`${root}/plan`)
  await expect(page.getByRole('heading', { name: 'Plan', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Undo task change: Book the shuttle' }).click()
  await expect(page.getByText('Change undone.', { exact: true })).toBeVisible()
  expect(await storedTask(page)).toMatchObject({ completed: false, notes: 'Meet at the station' })
  await page.screenshot({ path: `${shots}/undo-toast-390.png` })
})

test('sheet gestures cancel short drags and dismiss long ones, restoring focus', async ({ page, context }) => {
  await seed(page)
  await page.goto(`${root}/overview`)
  const add = page.getByRole('button', { name: 'Add', exact: true })
  await add.click()
  const dialog = page.getByRole('dialog', { name: 'Add to your trip' })
  await expect(dialog).toBeVisible()
  const session = await context.newCDPSession(page)
  async function drag(distance: number) {
    const box = (await dialog.locator('.sheet-drag-handle').boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + distance }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  await drag(20)
  await expect(dialog).toBeVisible()
  await page.screenshot({ path: `${shots}/sheet-390.png` })
  await drag(120)
  await expect(dialog).not.toBeVisible()
  await expect(add).toBeFocused()
  await add.click()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})

test('saved destination facts stay visible while reconnecting and revalidating', async ({ page }) => {
  await seed(page)
  const user = { id: memberId, email: 'fixture@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {} }
  const expires = Math.floor(Date.now() / 1000) + 3600
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: memberId, exp: expires, role: 'authenticated' })).toString('base64url')}.fixture`
  await page.route('**/auth/v1/user', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(user) }))
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/api/travel-info?**', async (route) => {
    const country = new URL(route.request().url()).searchParams.get('action') === 'country'
    if (country) await gate
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: country ? { name: 'Fresh destination facts', currencies: ['USD'], languages: ['English'], callingCodes: ['+1'] } : [], fetchedAt: new Date().toISOString() }) })
  })
  await page.evaluate(async ({ tripId, user, token, expires }) => {
    localStorage.setItem('sb-croqjdvzbpcscdcshnet-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: expires, token_type: 'bearer', user }))
    localStorage.setItem(`stowaway-travel-v1:${JSON.stringify({ action: 'country', tripId, country: 'US' })}`, JSON.stringify({ data: { name: 'Saved destination facts', currencies: ['USD'], languages: ['English'], callingCodes: ['+1'] }, fetchedAt: new Date(Date.now() - 31 * 86400000).toISOString() }))
    // Wait for the app to create its database; opening it first would make an empty one.
    while (!(await indexedDB.databases()).some((d) => d.name === 'trip-hub')) { /* not created yet */ }
    const database = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open('trip-hub'); request.onsuccess = () => resolve(request.result) })
    const tx = database.transaction('trips', 'readwrite')
    const store = tx.objectStore('trips')
    const request = store.get(tripId)
    request.onsuccess = () => store.put({ ...request.result, settings: { destination_country: 'US', destination_city: 'Seattle' } })
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve() })
    database.close()
  }, { tripId, user, token, expires })
  await page.goto(`${root}/more/explore`)
  await expect(page.getByText('Saved destination facts', { exact: true })).toBeVisible()
  await expect(page.getByText('You’re offline. Showing saved information when available.').first()).toBeVisible()
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true }); window.dispatchEvent(new Event('online')) })
  await expect(page.getByText('Refreshing…', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Saved destination facts', { exact: true })).toBeVisible()
  release()
  await expect(page.getByText('Fresh destination facts', { exact: true })).toBeVisible()
  await expect(page.getByText('Saved destination facts', { exact: true })).toHaveCount(0)
})

test('a slow image shows its local placeholder, then reveals the decoded photo', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/images/trip-covers/flat-v2/city-small.jpg', async (route) => { await gate; await route.continue() })
  await page.goto('/operators', { waitUntil: 'domcontentloaded' })
  const image = page.locator('.operator-booking-image')
  await image.scrollIntoViewIfNeeded()
  await expect(image).toHaveAttribute('data-ready', 'false')
  await expect(image.locator('.progressive-image-placeholder')).toBeVisible()
  await page.screenshot({ path: `${shots}/image-placeholder-390.png` })
  release()
  await expect(image).toHaveAttribute('data-ready', 'true')
  await expect(image.locator('img')).toHaveJSProperty('complete', true)
})

test('public pages retain content and targets in dark mode, reduced motion and enlarged text', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  for (const path of ['/operators', '/pricing', '/help', '/how-it-works']) {
    await page.setViewportSize({ width: 640, height: 900 })
    await page.goto(path)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'stowaway-dark')
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
  await page.goto('/pricing')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${shots}/pricing-dark-390.png`, fullPage: true })
  expect(await page.getByRole('button', { name: 'Open navigation' }).evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
})
