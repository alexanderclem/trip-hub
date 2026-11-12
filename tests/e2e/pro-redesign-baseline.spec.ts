import { expect, test, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

// Reusable baseline and migration regression journeys. Every record is synthetic.
// Browser traffic is intercepted; no hosted trip or service is changed.
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' })
const shots = process.env.SHOTS_DIR
const id = (n: number) => `00000000-0000-4000-8000-00000000ee${n.toString(16).padStart(2, '0')}`
const tripId = id(1), me = id(2), pollId = id(20), closedPollId = id(21)
const root = `/t/${tripId}`
const created = '2026-11-01T12:00:00Z'
// Windows WebKit's ephemeral context rejects IndexedDB Blob writes. Its UI-only
// runs omit the synthetic file; actual cold file/cache verification uses Chromium.
const storesFixtureFiles = !(process.platform === 'win32' && process.env.E2E_BROWSER === 'webkit')
type Phase = 'planning' | 'preparing' | 'traveling' | 'complete' | 'empty' | 'long' | 'hosted'

async function isolate(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue()
    if (url.pathname.endsWith('/auth/v1/settings')) return route.fulfill({ json: { external: { google: false, email: false } } })
    return route.abort()
  })
  await page.routeWebSocket(/.*/, socket => socket.close())
  await page.emulateMedia({ reducedMotion: 'reduce' })
}

async function identity(page: Page) {
  const expires = Math.floor(Date.parse('2030-01-01T00:00:00Z') / 1000)
  const user = { id: id(110), is_anonymous: true, app_metadata: {}, user_metadata: {} }
  const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires, role: 'authenticated', is_anonymous: true })).toString('base64url')}.synthetic`
  const session = { access_token: jwt, refresh_token: 'synthetic-local-only', expires_in: 86400, expires_at: expires, token_type: 'bearer', user }
  await page.route('**/auth/v1/signup**', route => route.fulfill({ json: session }))
  await page.route('**/auth/v1/token**', route => route.fulfill({ json: session }))
  await page.route('**/auth/v1/user', route => route.fulfill({ json: user }))
}

async function seed(page: Page, baseURL: string, phase: Phase = 'planning', online: boolean | null = false) {
  await isolate(page, baseURL)
  const clock = phase === 'traveling' ? '2027-03-16T08:00:00Z' : phase === 'preparing' ? '2027-03-12T10:00:00Z'
    : phase === 'complete' ? '2027-03-24T10:00:00Z' : '2027-02-15T10:00:00Z'
  await page.clock.setFixedTime(new Date(clock))
  if (online !== null) await page.addInitScript(online => Object.defineProperty(navigator, 'onLine', { get: () => online }), online)
  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'Trip ideas', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).some(db => db.name === 'trip-hub'))).toBe(true)
  await page.evaluate(async ({ tripId, me, pollId, closedPollId, created, phase, storesFixtureFiles }) => {
    const key = (n: number) => `00000000-0000-4000-8000-00000000ee${n.toString(16).padStart(2, '0')}`
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const canvas = document.createElement('canvas')
    canvas.width = 700; canvas.height = 450
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#f1f4f5'; ctx.fillRect(0, 0, 700, 450); ctx.fillStyle = '#17343f'; ctx.font = 'bold 35px sans-serif'
    ctx.fillText('EXAMPLE — Paris with friends', 35, 70); ctx.font = '25px sans-serif'
    ctx.fillText('Musée d’Orsay · March 16, 2027 · 10:00', 35, 145)
    ctx.fillText('Synthetic ticket · not valid for admission', 35, 220)
    ctx.fillText('Example confirmation: EXAMPLE-27', 35, 290)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'))
    const stores = ['trips', 'members', 'places', 'polls', 'poll_options', 'poll_votes', 'itinerary_items', 'trip_tasks', 'attachments', 'expenses', 'fx_snapshots', 'day_notes', 'files']
    const tx = db.transaction(stores, 'readwrite')
    const put = (store: string, row: Record<string, unknown>) => tx.objectStore(store).put({ trip_id: tripId, created_at: created, updated_at: created, created_by: me, updated_by: me, deleted_at: null, ...row })
    const zone = 'Europe/Paris'
    put('trips', { id: tripId, name: 'Example · Paris with friends', timezone: zone, start_date: '2027-03-16', end_date: phase === 'long' ? '2027-03-30' : '2027-03-20', base_currency: 'EUR', local_currency: 'EUR', route_factor_low: 1.4, route_factor_high: 2, bbox: [48.80, 2.25, 48.91, 2.43], offline_pack: null, share_token: 'synthetic-local-invite-only', access_mode: phase === 'hosted' ? 'hosted' : 'group', settings: { journal_cover: 'none', areas: [{ name: 'Paris', countryCode: 'FR', lat: 48.8566, lng: 2.3522, bbox: [48.80, 2.25, 48.91, 2.43] }] } })
    const names = ['Alex Example', 'Maya Example', 'Noah Example', 'Sam Example', 'Riley Example', 'Jamie Example', 'Taylor Example', 'Casey Example']
    names.forEach((display_name, i) => put('members', { id: key(i + 2), display_name, color: null, avatar_emoji: null, home_timezone: null }))
    if (phase !== 'empty') {
      const places = [[30, 'Musée d’Orsay', 'sight', 'booked', 48.8599, 2.3266], [31, 'Le Marais', 'sight', 'shortlist', 48.859, 2.363], [32, 'Canal Saint-Martin', 'sight', 'shortlist', 48.872, 2.364], [33, 'Lunch near the Seine', 'food', 'planned', 48.856, 2.34], [34, 'Versailles', 'sight', 'shortlist', 48.8049, 2.1204]]
      places.forEach(([n, name, category, status, lat, lng]) => put('places', { id: key(n as number), name, category, status, lat, lng, tags: [], address: null, area: 'Paris', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' }))
      put('polls', { id: pollId, title: 'Which neighborhood should we explore?', description: 'Example group decision', status: 'open', kind: 'options', winner_option_id: null, closes_at: null })
      put('polls', { id: closedPollId, title: 'Where should we spend Friday?', description: null, status: 'closed', kind: 'options', winner_option_id: key(24), closes_at: null })
      ;[[22, pollId, 'Le Marais', 31], [23, pollId, 'Canal Saint-Martin', 32], [24, closedPollId, 'Versailles', 34]].forEach(([n, poll, label, place]) => put('poll_options', { id: key(n as number), poll_id: poll, label, place_id: key(place as number), url: null, description: null }))
      for (let i = 1; i < 8; i++) put('poll_votes', { id: key(80 + i), poll_id: pollId, option_id: key(22), member_id: key(i + 2), score: i % 4 })
      for (let i = 0; i < 8; i++) put('poll_votes', { id: key(90 + i), poll_id: closedPollId, option_id: key(24), member_id: key(i + 2), score: 3 })
      const item = (n: number, title: string, day: string, start: string, end: string, place: number, status: string, extra: Record<string, unknown> = {}) => put('itinerary_items', { id: key(n), title, kind: 'activity', place_id: key(place), to_place_id: null, all_day: false, start_local: `${day}T${start}`, end_local: `${day}T${end}`, start_tz: zone, end_tz: zone, start_at: `${day}T${start}:00+01:00`, end_at: `${day}T${end}:00+01:00`, status, confirmation_code: null, attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null, ...extra })
      item(40, 'Musée d’Orsay visit', '2027-03-16', '10:00', '12:00', 30, 'confirmed', { confirmation_code: 'EXAMPLE-27' })
      item(41, 'Lunch near the Seine', '2027-03-16', '12:30', '14:00', 33, 'tentative', { kind: 'meal' })
      item(42, 'Walk in Le Marais', '2027-03-16', '13:30', '15:00', 31, 'tentative')
      item(43, 'Morning at Canal Saint-Martin', '2027-03-17', '10:00', '11:30', 32, 'tentative')
      put('day_notes', { id: key(44), date: '2027-03-16', title: null, notes: 'Example meeting point: museum entrance, 09:45.' })
      put('trip_tasks', { id: key(50), title: 'Confirm our airport meeting point', assignee_id: me, due_date: '2027-02-14', completed: false, notes: 'Synthetic overdue task.' })
      put('trip_tasks', { id: key(51), title: 'Download train tickets', assignee_id: key(3), due_date: '2027-03-15', completed: false, notes: null })
      const ticket = { item_id: key(40), place_id: null, expense_id: null, kind: 'ticket', confirmation_code: 'EXAMPLE-27', storage_path: 'synthetic/orsay.png', filename: 'example-orsay.png', mime: 'image/png', bytes: blob.size, sha256: 'synthetic', uploaded_at: created, owner_member_id: me, visibility: 'trip' }
      put('attachments', { ...ticket, id: key(60), title: 'Example · Musée d’Orsay ticket' })
      put('attachments', { ...ticket, id: key(61), item_id: null, title: 'Example · Train ticket not downloaded', storage_path: 'synthetic/train.png' })
      if (storesFixtureFiles) tx.objectStore('files').put({ name: `att:${key(60)}`, blob })
      put('expenses', { id: key(70), description: 'Example · Airport train', category: 'transport', spent_on: '2027-03-16', amount_minor: 8000, currency: 'EUR', fx_rate: 1, base_currency: 'EUR', base_amount_minor: 8000, payers: [{ member_id: key(3), amount_minor: 8000 }], split_method: 'equal', split: names.map((_, i) => ({ member_id: key(i + 2), value: 1 })), fx_source: 'same', fx_as_of: null, place_id: null, item_id: null, notes: null })
      put('fx_snapshots', { id: key(71), base: 'USD', rates: { USD: 1, EUR: .92 }, as_of: '2027-02-15', fetched_at: '2027-02-15T10:00:00Z', source: 'synthetic example' })
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = event => reject(new Error(`Fixture write: ${(event.target as IDBRequest).error?.message ?? tx.error?.message ?? 'unknown request error'}`))
      tx.onabort = () => reject(new Error(`Fixture transaction aborted: ${tx.error?.message ?? 'unknown error'}`))
    })
    db.close()
    const access = { role: 'viewer', mode: 'hosted', epoch: 1, removed: false, canRemove: false, organized: true, removedMembers: [] }
    localStorage.setItem('trip-hub-device', JSON.stringify({ version: 1, state: { quizSeen: true, setupDismissed: { [tripId]: true }, trips: { [tripId]: { tripId, memberId: me, joinedAt: created } }, access: phase === 'hosted' ? { [tripId]: access } : {} } }))
    sessionStorage.setItem('stowaway-install-dismissed', '1')
  }, { tripId, me, pollId, closedPollId, created, phase, storesFixtureFiles })
}

async function capture(page: Page, name: string, animations: 'disabled' | 'allow' = 'disabled') {
  if (!shots) return
  await page.evaluate(() => document.fonts.ready)
  await expect(page.getByText('Checking the next steps…', { exact: true })).toHaveCount(0)
  await page.waitForTimeout(200) // Let local live queries and the first paint settle before evidence.
  await page.screenshot({ path: `${shots}/${name}.png`, animations, scale: 'css' })
}

async function open(page: Page, path: string) {
  await page.goto(`${root}/${path}`)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached()
  await expect(page.locator('#trip-content')).toBeVisible()
}

const metrics: Record<string, unknown>[] = []
for (const width of [390, 1440]) {
  test(`Paris baseline, real routes and record states at ${width}px`, async ({ page, baseURL }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await seed(page, baseURL!)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const routes = [['home-planning', 'overview'], ['plan', 'plan?day=2027-03-16'], ['item', `plan/${id(40)}`], ['places', 'more/places'], ['place', `more/places/${id(30)}`], ['map-unprepared', `map?place=${id(30)}`], ['votes', 'more/vote'], ['poll-open', `more/vote/${pollId}`], ['poll-closed', `more/vote/${closedPollId}`], ['money', 'money'], ['tickets', 'tickets'], ['ticket-local', `tickets/${id(60)}`], ['ticket-missing', `tickets/${id(61)}`], ['more', 'more'], ['settings-offline', 'more/settings']]
    for (const [name, path] of routes) {
      await open(page, path!)
      if (name === 'home-planning') await expect(page.getByRole('heading', { name: 'Confirm our airport meeting point' })).toBeVisible()
      if (name === 'ticket-local') await expect(page.locator('img').filter({ visible: true }).last()).toBeVisible()
      if (name === 'ticket-missing') await expect(page.getByRole('alert')).toBeVisible()
      await capture(page, `${name}-${width}`)
      const observation = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, title: document.querySelector('h1')?.textContent, contentScrollHeight: document.querySelector('#trip-content')?.scrollHeight, primaryButtons: [...document.querySelectorAll('.ui-button-primary')].filter(el => el.getClientRects().length).length }))
      metrics.push({ name, width, ...observation })
      if (name === 'home-planning') metrics.push({ name: 'home-priority-color', width, ...await page.locator('.overview-focus').evaluate(el => ({ headingColor: getComputedStyle(el.querySelector('h2')!).color, detailColor: getComputedStyle(el.querySelector('p')!).color, background: getComputedStyle(el).backgroundColor, headingTop: el.querySelector('h2')!.getBoundingClientRect().top, firstPlanItemTop: document.querySelector('.preview-stops li')?.getBoundingClientRect().top })) })
      expect(observation.overflow, name).toBe(false)
    }
    expect(errors).toEqual([])
    if (shots) await writeFile(`${shots}/metrics-${width}.json`, JSON.stringify(metrics.filter(row => row.width === width), null, 2))
  })
}

for (const phase of ['preparing', 'traveling', 'complete', 'empty', 'long', 'hosted'] as const) {
  test(`Paris ${phase} state and navigation`, async ({ page, baseURL }) => {
    await seed(page, baseURL!, phase)
    await page.setViewportSize({ width: 390, height: 844 })
    await open(page, phase === 'long' ? 'plan?day=2027-03-30' : 'overview')
    if (phase !== 'long') await expect(page.locator('[data-phase]')).toHaveAttribute('data-phase', phase === 'hosted' || phase === 'empty' ? 'planning' : phase)
    if (phase === 'traveling') await expect(page.locator('.up-next-prominent')).toContainText('Musée d’Orsay visit')
    if (phase === 'hosted') {
      await expect(page.getByRole('button', { name: 'Add', exact: true })).toHaveCount(0)
      await open(page, 'plan/new')
      await expect(page.getByText('You do not have permission to edit this itinerary.')).toBeVisible()
    }
    await capture(page, `state-${phase}-390`)
  })
}

test('phone adaptation, dark mode, enlarged text and keyboard invite', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      for (const [name, path] of [['home', 'overview'], ['plan', 'plan?day=2027-03-16'], ['money', 'money']]) {
        await open(page, path!)
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}-${width}-${colorScheme}`).toBe(true)
        await capture(page, `adapt-${name}-${width}-${colorScheme}`)
      }
    }
  }
  await page.setViewportSize({ width: 640, height: 900 })
  await open(page, 'overview')
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  await capture(page, 'home-200-percent-text-640')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; document.body.style.zoom = '2' })
  await capture(page, 'home-css-zoom-200-640')
  await page.evaluate(() => { document.body.style.zoom = '' })
  const invite = page.getByRole('button', { name: 'Invite', exact: true })
  await invite.focus(); await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Invite friends' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Anyone with this link can see and edit the whole trip')
  await capture(page, 'invite-keyboard-640')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible(); await expect(invite).toBeFocused()
})

test('group vote saves locally, winner requires a separate plan action', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await open(page, `more/vote/${pollId}`)
  const scores = page.getByRole('group', { name: 'Your vote for Le Marais' })
  await scores.getByRole('button', { name: /Must-do/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Vote saved.' })).toBeVisible()
  await page.reload()
  await expect(scores.getByRole('button', { name: /Must-do/ })).toHaveAttribute('aria-pressed', 'true')
  await scores.getByRole('button', { name: /Fine/ }).click()
  await expect(scores.getByRole('button', { name: /Fine/ })).toHaveAttribute('aria-pressed', 'true')
  await open(page, `more/vote/${closedPollId}`)
  await expect(page.getByRole('link', { name: 'Schedule the chosen option', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Schedule the chosen option', exact: true }).click()
  await expect(page).toHaveURL(/\/plan\/new\?/)
  await expect(page.getByRole('heading', { name: 'Add to plan', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('tentative')
  await capture(page, 'winner-manual-plan-handoff-390')
  await page.getByLabel('Start time', { exact: true }).fill('15:00')
  await page.getByRole('button', { name: 'Add to the plan', exact: true }).click()
  await expect(page).toHaveURL(`${root}/more/vote/${closedPollId}`)
  await expect(page.getByRole('region', { name: 'Finish this decision' })).toContainText('View in the plan')
})

test('decision options disclose forms and keep saved booking responsibility visible', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await open(page, `more/vote/${closedPollId}`)
  const handoff = page.getByRole('region', { name: 'Finish this decision' })
  await expect(handoff.getByRole('combobox', { name: 'Existing plan item', exact: true })).not.toBeVisible()
  await expect(handoff.getByRole('combobox', { name: 'Booking owner', exact: true })).not.toBeVisible()
  const link = handoff.getByRole('button', { name: 'Already on the plan? Link it', exact: true })
  await link.focus(); await page.keyboard.press('Enter')
  await expect(link).toHaveAttribute('aria-expanded', 'true')
  await handoff.getByRole('combobox', { name: 'Existing plan item', exact: true }).selectOption(id(42))
  await handoff.getByRole('button', { name: 'Link to this decision', exact: true }).click()
  await expect(handoff.getByRole('link', { name: /View in the plan/ })).toBeVisible()
  await handoff.getByRole('button', { name: 'Assign a booking owner', exact: true }).click()
  await handoff.getByRole('combobox', { name: 'Booking owner', exact: true }).selectOption(me)
  await handoff.getByLabel('Book by (optional)', { exact: true }).fill('2027-03-01')
  await handoff.getByRole('button', { name: 'Assign booking task', exact: true }).click()
  await expect(handoff.getByRole('link', { name: 'View task', exact: true })).toBeVisible()
  const edit = handoff.getByRole('button', { name: 'Change booking owner or deadline', exact: true })
  await edit.click()
  await expect(edit).toHaveAttribute('aria-expanded', 'false')
  await expect(handoff).toContainText('due 2027-03-01')
  await expect(handoff.getByRole('link', { name: 'View task', exact: true })).toBeVisible()
  await capture(page, 'decision-optional-forms-390')
  await page.reload()
  await expect(handoff.getByRole('link', { name: 'View task', exact: true })).toBeVisible()
  await expect(handoff.getByRole('combobox', { name: 'Booking owner', exact: true })).not.toBeVisible()
  await handoff.getByRole('button', { name: 'No booking needed', exact: true }).click()
  await expect(handoff.getByText('Confirmed · no booking needed', { exact: true })).toBeVisible()
})

test.describe('installed app cache', () => {
  test.use({ serviceWorkers: 'allow' })
  test('cold offline document opens cached trip and saved ticket, then reconnects', async ({ page, context, baseURL }) => {
    test.skip(!storesFixtureFiles, 'Windows WebKit ephemeral contexts cannot persist Blob files; run this cache contract in Chromium.')
    test.setTimeout(180_000)
    await seed(page, baseURL!)
    await open(page, 'overview')
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 120_000 }).toBe(true)
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys()
      const precache = keys.find(key => key.includes('precache'))
      return precache ? (await (await caches.open(precache)).keys()).length : 0
    })
    expect(cached).toBeGreaterThan(100)
    await context.setOffline(true)
    await page.close()
    const cold = await context.newPage()
    await cold.goto(`${root}/overview`)
    await expect(cold.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(cold.locator('#trip-content')).toContainText('Paris')
    await cold.goto(`${root}/tickets/${id(60)}`)
    await expect(cold.getByRole('heading', { name: 'Example · Musée d’Orsay ticket', exact: true })).toBeVisible()
    await expect(cold.locator('img[src^="blob:"]').first()).toBeVisible()
    await capture(cold, 'cold-offline-saved-ticket-390')
    await cold.goto(`${root}/tickets/${id(61)}`)
    await expect(cold.getByRole('alert').filter({ hasText: "You're offline and this file isn't on your phone yet." })).toBeVisible()
    await context.setOffline(false)
    await isolate(cold, baseURL!)
    await cold.reload()
    await expect(cold.locator('#trip-content')).toBeVisible()
    await cold.close()
  })
})

test.describe('cross-engine consumer contracts', () => {
  test('forms, dark theme, roster and legacy poll scheduling retain their contracts', async ({ page, baseURL }) => {
    await seed(page, baseURL!)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/new')
    await page.getByRole('button', { name: 'Create a trip', exact: true }).click()
    await expect(page.getByLabel('Trip name', { exact: true })).toBeFocused()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await open(page, 'travelers')
    await page.getByRole('link', { name: 'Maya Example', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Maya Example', exact: true, level: 1 })).toBeVisible()
    await open(page, `plan/new?poll=${closedPollId}&option=${id(24)}`)
    await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('tentative')
    await page.getByLabel('Start time', { exact: true }).fill('15:00')
    await page.getByRole('button', { name: 'Schedule this choice', exact: true }).click()
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]+$/)
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('Versailles')
    await capture(page, 'webkit-poll-scheduled-dark-390')
  })
})

test.describe('public map download verification', () => {
  test.use({ serviceWorkers: 'allow' })
  test('Paris map downloads, survives a cold offline page and renders saved places', async ({ page, context, baseURL }) => {
    test.skip(process.env.VERIFY_PUBLIC_MAP !== '1', 'Opt in to read-only public map downloads with VERIFY_PUBLIC_MAP=1.')
    test.setTimeout(300_000)
    await seed(page, baseURL!, 'planning', true)
    // Only this read-only public tile server bypasses the synthetic fixture's external block.
    await page.route('https://tiles.openfreemap.org/**', route => route.request().method() === 'GET' ? route.continue() : route.abort())
    await open(page, 'more/settings')
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 120_000 }).toBe(true)
    await page.getByRole('button', { name: /^Save map for offline/ }).click()
    await expect(page.getByText(/On this phone ·.*saved/)).toBeVisible({ timeout: 180_000 })
    const cache = await page.evaluate(async () => {
      const entries = await (await caches.open('map-tiles')).keys()
      let bytes = 0
      for (const request of entries) bytes += (await (await caches.match(request))!.arrayBuffer()).byteLength
      return { tiles: entries.length, bytes }
    })
    expect(cache.tiles).toBeGreaterThan(10)
    expect(cache.bytes).toBeGreaterThan(100_000)
    await test.info().attach('downloaded-map-cache.json', { body: JSON.stringify(cache), contentType: 'application/json' })
    if (shots) await writeFile(`${shots}/real-map-cache.json`, JSON.stringify(cache, null, 2))
    await context.setOffline(true)
    await page.close()
    const cold = await context.newPage()
    const failedRequests: string[] = []
    cold.on('requestfailed', request => failedRequests.push(request.url()))
    const warnings: string[] = []
    cold.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()) })
    await cold.goto(`${root}/map`)
    await expect(cold.locator('.maplibregl-canvas')).toBeVisible()
    await expect(cold.getByRole('heading', { name: /Loading your trip map|Map is taking longer/ })).toHaveCount(0, { timeout: 30_000 })
    if (shots) await writeFile(`${shots}/real-map-network.json`, JSON.stringify({ failedRequests, warnings }, null, 2))
    await expect(cold.getByText('Some map tiles could not load. Your saved places are still available in the list.', { exact: true })).toHaveCount(0)
    expect(failedRequests).toEqual([])
    await capture(cold, 'real-paris-map-cold-offline-390')
    await cold.close()
  })
})

test('offline expense and activity persist, selected day and deep links survive', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await open(page, 'money/new')
  await page.getByLabel('What for?', { exact: true }).fill('Example · Offline café')
  await page.getByLabel('Amount', { exact: true }).fill('24.80')
  await page.getByRole('button', { name: 'Save expense', exact: true }).click()
  await expect(page).toHaveURL(`${root}/money`)
  await expect(page.getByText('Example · Offline café', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Example · Offline café', { exact: true })).toBeVisible()
  await open(page, 'plan/new?day=2027-03-17')
  await page.getByLabel('Name', { exact: true }).fill('Example · Evening walk')
  await page.getByLabel('Start time', { exact: true }).fill('18:00')
  await page.getByRole('button', { name: /^Save$/ }).click()
  await expect(page).toHaveURL(/\/plan\/[0-9a-f-]+$/)
  await expect(page.getByText('Example · Evening walk', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Example · Evening walk', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Start time', { exact: true }).fill('19:00')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/plan\/[0-9a-f-]+$/)
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(`${root}/plan?day=2027-03-17`)
  await expect(page.getByRole('list', { name: 'Agenda', exact: true })).toContainText('19:00')
  await capture(page, 'offline-edits-persist-390')
  const outbox = await page.evaluate(async () => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const read = db.transaction('_outbox').objectStore('_outbox').getAll()
    const rows = await new Promise<{ table: string }[]>(resolve => { read.onsuccess = () => resolve(read.result) })
    db.close(); return rows.map(row => row.table)
  })
  expect(outbox).toContain('expenses'); expect(outbox).toContain('itinerary_items')
  await page.context().setOffline(true)
  await page.getByRole('navigation', { name: 'Trip navigation' }).filter({ visible: true }).getByRole('link', { name: 'Home', exact: true }).click()
  await expect(page.locator('[data-phase="planning"]')).toBeVisible()
  await page.context().setOffline(false)
})

test('two isolated phones reconcile an offline task through the real sync transport with a stubbed server', async ({ page, browser, context, baseURL }) => {
  const other = await browser.newContext({ baseURL, serviceWorkers: 'block', viewport: { width: 390, height: 844 } })
  try {
    const second = await other.newPage()
    await seed(page, baseURL!, 'planning', null)
    await seed(second, baseURL!, 'planning', null)
    const server = new Map<string, Map<string, Record<string, unknown>>>()
    for (const phone of [page, second]) await phone.route('**/rest/v1/**', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.pathname.includes('/rpc/')) return route.fulfill({ json: null })
      const table = url.pathname.split('/').at(-1)!
      const rows = server.get(table) ?? new Map<string, Record<string, unknown>>()
      server.set(table, rows)
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as Record<string, unknown> | Record<string, unknown>[]
        for (const row of Array.isArray(body) ? body : [body]) rows.set(row.id as string, row)
        return route.fulfill({ status: 201, json: Array.isArray(body) ? body : [body] })
      }
      if (request.method() === 'GET') {
        const since = url.searchParams.get('updated_at')?.replace(/^gt\./, '') ?? ''
        return route.fulfill({ json: [...rows.values()].filter(row => String(row.updated_at) > since) })
      }
      return route.fulfill({ json: [] })
    })
    await open(page, 'more/tasks')
    await open(second, 'more/tasks')
    await page.getByRole('link', { name: 'Add task', exact: true }).click()
    await expect(page.getByLabel('Task', { exact: true })).toBeVisible()
    await context.setOffline(true)
    await page.getByLabel('Task', { exact: true }).fill('Example · Meet at the offline rendezvous')
    await page.getByRole('button', { name: 'Save task', exact: true }).click()
    await expect(page.getByText('Example · Meet at the offline rendezvous', { exact: true })).toBeVisible()
    await expect(second.getByText('Example · Meet at the offline rendezvous', { exact: true })).toHaveCount(0)
    await context.setOffline(false)
    await expect.poll(() => [...(server.get('trip_tasks')?.values() ?? [])].some(row => row.title === 'Example · Meet at the offline rendezvous')).toBe(true)
    await second.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect(second.getByText('Example · Meet at the offline rendezvous', { exact: true })).toBeVisible()
    await second.reload()
    await expect(second.getByText('Example · Meet at the offline rendezvous', { exact: true })).toBeVisible()
  } finally { await other.close() }
})

for (const width of [390, 1440]) {
  test(`public introduction and entry at ${width}px`, async ({ page, baseURL }) => {
    await isolate(page, baseURL!)
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    for (const [name, path] of [['landing', '/'], ['first-entry', '/app'], ['create', '/new'], ['join-entry', '/join']]) {
      await page.goto(path!)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await capture(page, `${name}-${width}`)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  })
}

test.beforeAll(async () => { if (shots) await mkdir(shots, { recursive: true }) })

test('offline preparation exposes partial failure and measured control states', async ({ page, baseURL }) => {
  await seed(page, baseURL!, 'preparing')
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, 'overview')
  const offline = page.getByRole('region', { name: 'Offline access', exact: true })
  await offline.getByRole('button', { name: 'Download all', exact: true }).click()
  await expect(offline.getByText('Offline download incomplete', { exact: true })).toBeVisible()
  await expect(offline.getByText('Ready for offline', { exact: true })).toHaveCount(0)
  await offline.scrollIntoViewIfNeeded()
  await capture(page, 'offline-preparation-failed-390')
  await open(page, 'plan?day=2027-03-16')
  const sizes = await page.getByRole('button', { name: 'Agenda', exact: true }).evaluate(el => ({ height: el.getBoundingClientRect().height, width: el.getBoundingClientRect().width }))
  await open(page, 'overview')
  const heading = await page.locator('.overview-focus h2').count()
  if (shots) await writeFile(`${shots}/control-measurements.json`, JSON.stringify({ agenda: sizes, preparationPriorityHeadingCount: heading }, null, 2))
})

test('organizer creates a trip and copies the invite through a fully stubbed backend', async ({ page, baseURL }) => {
  await isolate(page, baseURL!)
  let savedTrip: Record<string, unknown> | null = null
  let savedMember: Record<string, unknown> | null = null
  await identity(page)
  await page.route('**/rest/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/rpc/create_trip')) {
      const values = route.request().postDataJSON() as Record<string, unknown>
      const base = { created_at: created, updated_at: created, deleted_at: null, created_by: null, updated_by: null }
      savedTrip = { ...base, id: values.p_trip_id, trip_id: values.p_trip_id, name: values.p_name, timezone: values.p_timezone, start_date: values.p_start_date, end_date: values.p_end_date, base_currency: values.p_base_currency, local_currency: values.p_local_currency, route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'synthetic-local-invite-only', settings: {} }
      savedMember = { ...base, id: values.p_member_id, trip_id: values.p_trip_id, display_name: values.p_member_name, color: values.p_member_color, avatar_emoji: null }
      return route.fulfill({ status: 204 })
    }
    if (path.endsWith('/rpc/my_trip_access')) return route.fulfill({ json: { role: 'member', mode: 'group', epoch: 0 } })
    if (path.endsWith('/trips')) return route.fulfill({ json: savedTrip ? [savedTrip] : [] })
    if (path.endsWith('/members')) return route.fulfill({ json: savedMember ? [savedMember] : [] })
    return route.fulfill({ json: [] })
  })
  await page.goto('/new')
  await page.getByLabel('Trip name', { exact: true }).fill('Example · Newly created Paris trip')
  await page.getByLabel('Your name', { exact: true }).fill('Alex Example')
  await page.getByRole('button', { name: 'Create a trip', exact: true }).click()
  await expect(page).toHaveURL(/\/overview(?:\?|$)/)
  await expect(page.getByRole('heading', { name: 'Example · Newly created Paris trip', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Invite', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Invite friends', exact: true })
  await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
  await expect(dialog.getByRole('status').filter({ hasText: 'Invite link copied.' })).toBeVisible()
  await capture(page, 'create-and-copy-invite-390')
  expect(savedTrip).not.toBeNull()
})

test('a Paris invitee chooses their name and reaches a vote deep link', async ({ page, baseURL }) => {
  await seed(page, baseURL!, 'planning', true)
  const fixture = await page.evaluate(async tripId => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result) })
    const read = async (name: string) => {
      const get = db.transaction(name).objectStore(name).getAll()
      return new Promise<Record<string, unknown>[]>(resolve => { get.onsuccess = () => resolve(get.result) })
    }
    const [trips, members] = await Promise.all([read('trips'), read('members')])
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { quizSeen: false, trips: {} }, version: 1 }))
    return { trip: trips.find(row => row.id === tripId)!, members }
  }, tripId)
  await identity(page)
  await page.route('**/rest/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/rpc/join_trip')) return route.fulfill({ json: tripId })
    if (path.endsWith('/rpc/my_trip_access')) return route.fulfill({ json: { role: 'member', mode: 'group', epoch: 0 } })
    if (path.endsWith('/rpc/claim_member')) return route.fulfill({ status: 204 })
    if (path.endsWith('/trips')) return route.fulfill({ json: [fixture.trip] })
    if (path.endsWith('/members')) return route.fulfill({ json: fixture.members })
    return route.fulfill({ json: [] })
  })
  await page.goto(`/join?to=vote/${pollId}#t=synthetic-local-invite-only`)
  await expect(page.getByRole('heading', { name: 'Example · Paris with friends', exact: true })).toBeVisible()
  await capture(page, 'paris-join-choose-name-390')
  await page.getByRole('button', { name: /Alex Example/ }).click()
  await expect(page).toHaveURL(`${root}/more/vote/${pollId}`)
  await expect(page.getByRole('heading', { name: 'What kind of traveler are you?' })).toHaveCount(0)
  await page.goto(`${root}/overview?joined=1`)
  await expect(page.getByRole('region', { name: 'You’re in' })).toBeVisible()
  await capture(page, 'paris-join-welcome-390')
})

test('saved places, creating a poll and all four vote scores use real local writes', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await open(page, 'more/places/new')
  await page.getByLabel('Name', { exact: true }).fill('Example · Roof garden')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/more\/places\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: 'Example · Roof garden', exact: true })).toBeVisible()
  await open(page, 'more/vote')
  await page.getByRole('button', { name: 'New vote', exact: true }).click()
  await page.getByLabel('What are we deciding?', { exact: true }).fill('Example · Sunday afternoon')
  await page.getByRole('button', { name: 'Create and add options', exact: true }).click()
  await expect(page).toHaveURL(/\/more\/vote\/[0-9a-f-]+$/)
  await page.getByLabel('Option', { exact: true }).fill('Example · Roof garden')
  await page.getByRole('button', { name: 'Add “Example · Roof garden” as a text option', exact: true }).click()
  const scores = page.getByRole('group', { name: 'Your vote for Example · Roof garden' })
  for (const name of ['No way', 'Fine', 'Want', 'Must-do']) {
    await scores.getByRole('button', { name, exact: true }).click()
    await expect(scores).toHaveAttribute('aria-busy', 'false')
    await expect(scores.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
  await scores.getByRole('button', { name: 'Must-do', exact: true }).click()
  await expect(scores.getByRole('button', { name: 'Must-do', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Example · Sunday afternoon', exact: true })).toBeVisible()
})

test('Home roster opens every traveler and returns to the roster and Home', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await open(page, 'overview')
  await page.getByRole('link', { name: '8 travelers', exact: true }).click()
  await expect(page).toHaveURL(`${root}/travelers`)
  await expect(page.getByRole('heading', { name: 'Travelers', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'People (8)', exact: true })).toBeVisible()
  const result = { url: new URL(page.url()).pathname, heading: await page.getByRole('heading', { level: 1 }).first().textContent() }
  if (shots) await writeFile(`${shots}/roster-destination.json`, JSON.stringify(result, null, 2))
  await capture(page, 'group-roster-destination-390')
  await page.getByRole('link', { name: 'Alex Example (you)', exact: true }).click()
  await expect(page).toHaveURL(`${root}/travelers/${me}`)
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(`${root}/travelers`)
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(`${root}/overview`)
})

test('Home contrast, Add icon and navigation targets survive both themes and motion modes', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  const readings: unknown[] = []
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const colorScheme of ['light', 'dark'] as const) for (const reducedMotion of ['reduce', 'no-preference'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion })
      await open(page, 'overview')
      const result = await page.locator('.overview-focus').evaluate(el => {
        const luminance = (color: string) => {
          const c = color.match(/[\d.]+/g)!.slice(0, 3).map(value => { const n = Number(value) / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4 })
          return c[0]! * .2126 + c[1]! * .7152 + c[2]! * .0722
        }
        const background = luminance(getComputedStyle(el).backgroundColor)
        return ['h2', 'p'].map(selector => {
          const foreground = luminance(getComputedStyle(el.querySelector(selector)!).color)
          return (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05)
        })
      })
      readings.push({ width, colorScheme, reducedMotion, contrast: result })
      for (const ratio of result) expect(ratio).toBeGreaterThanOrEqual(4.5)
      const add = page.getByRole('button', { name: 'Add', exact: true })
      await expect(add.locator('svg')).toBeVisible()
      expect((await add.locator('svg').boundingBox())!.width).toBeGreaterThanOrEqual(16)
      await add.focus()
      expect(await add.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
      if (width < 768) for (const tab of await page.locator('.trip-tab').all()) {
        expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        expect(await tab.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(13)
      }
      await expect(page.locator('html')).toHaveAttribute('data-astryx-theme', 'stowaway')
    }
  }
  if (shots) await writeFile(`${shots}/contrast-regression.json`, JSON.stringify(readings, null, 2))
})

test('Astryx create fields retain native validation, labels and mobile dimensions', async ({ page, baseURL }) => {
  await isolate(page, baseURL!)
  for (const width of [320, 390, 768, 1440]) for (const colorScheme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme })
    await page.goto('/new')
    for (const [name, limit] of [['Trip name', 120], ['Your name', 40]] as const) {
      const input = page.getByRole('textbox', { name, exact: true })
      await expect(input).toHaveAttribute('required', '')
      await expect(input).toHaveAttribute('maxlength', String(limit))
      expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      expect(await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
    }
    await page.getByRole('button', { name: 'Create a trip', exact: true }).click()
    await expect(page).toHaveURL('/new')
    await expect(page.getByLabel('Trip name', { exact: true })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await capture(page, `astryx-create-${width}-${colorScheme}`)
  }
})

test('hosted viewers can read the roster and traveler without edit controls', async ({ page, baseURL }) => {
  await seed(page, baseURL!, 'hosted')
  await open(page, 'travelers')
  await expect(page.getByRole('heading', { name: 'People (8)', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Remove|Let in/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Alex Example (you)', exact: true }).click()
  await expect(page.getByRole('link', { name: /Add an event|Add an expense|Assign a task|Manage packing/ })).toHaveCount(0)
  await expect(page.getByText('Edit traveler profile', { exact: true })).toHaveCount(0)
  await capture(page, 'astryx-viewer-traveler-390')
  await open(page, 'money')
  await expect(page.getByRole('region', { name: 'Your balance' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Record |Undo payment/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Add expense|Add an expense|Scan a receipt/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Group settlement details', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Record |Undo payment/ })).toHaveCount(0)
  await open(page, `money/${id(70)}`)
  await expect(page.getByRole('heading', { name: 'Example · Airport train', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Save expense|Delete expense/ })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'What for?', exact: true })).toHaveCount(0)
  await capture(page, 'astryx-viewer-expense-390')
})

test('join welcome separates installation from real per-phone ticket preparation', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.evaluate(tripId => {
    const device = JSON.parse(localStorage.getItem('trip-hub-device')!)
    device.state.setupDismissed[tripId] = false
    localStorage.setItem('trip-hub-device', JSON.stringify(device))
  }, tripId)
  await open(page, 'overview?joined=1')
  const welcome = page.getByRole('region', { name: 'You’re in', exact: true })
  await expect(welcome).toContainText('1 of 2 ticket files on this phone')
  await expect(welcome).not.toContainText('Then the plan, map and tickets work with no signal')
  await welcome.getByRole('link', { name: /Prepare this phone for no signal/ }).click()
  await expect(page).toHaveURL(`${root}/more/settings#offline-ready`)
  await expect(page.locator('#offline-ready')).toBeInViewport()
  await expect(page.locator('#offline-ready')).toBeFocused()
  await capture(page, 'astryx-preparation-anchor-390')
})

test('Money prioritizes personal payments and records an external payment locally', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await open(page, 'money')
  await expect(page.getByRole('region', { name: 'Your balance' })).toContainText('€10.00')
  await expect(page.getByRole('heading', { name: 'Your next payments' })).toBeVisible()
  const group = page.getByRole('button', { name: 'Group settlement details', exact: true })
  await expect(group).toHaveAttribute('aria-expanded', 'false')
  const history = page.getByRole('region', { name: 'History', exact: true })
  expect((await history.boundingBox())!.y).toBeLessThan((await group.boundingBox())!.y)
  await expect(page.getByRole('button', { name: /^Record / })).toHaveCount(1)
  await page.getByRole('button', { name: /^Record / }).click()
  await expect(page.getByText('Only record money already paid outside Stowaway.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mark as paid', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Your balance' })).toContainText('All settled')
  await page.reload()
  await expect(page.getByRole('region', { name: 'Your balance' })).toContainText('All settled')
  await group.click()
  await expect(group).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('heading', { name: 'Everyone’s balances' })).toBeVisible()
  await capture(page, 'astryx-money-recorded-390')
})

test('retained native confirmation keeps focus and Escape across themes and motion modes', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  for (const width of [320, 390, 768, 1440]) for (const colorScheme of ['light', 'dark'] as const) for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme, reducedMotion })
    await open(page, `money/${id(70)}`)
    const remove = page.getByRole('button', { name: 'Delete expense', exact: true })
    await remove.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Confirm this change', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveClass(/ui-dialog/)
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
    await capture(page, `astryx-confirm-${width}-${colorScheme}-${reducedMotion}`, 'allow')
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(remove).toBeFocused()
  }
  // A programmatic activation has no focused trigger. Dismissal still returns
  // reading context instead of leaving focus on an unfocusable body element.
  const remove = page.getByRole('button', { name: 'Delete expense', exact: true })
  await remove.evaluate((element: HTMLButtonElement) => { element.blur(); element.click() })
  await expect(page.getByRole('dialog', { name: 'Confirm this change', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Confirm this change', exact: true })).not.toBeVisible()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeFocused()
})

test('public Paris example requires an explicit plan action and resets without trip writes', async ({ page, baseURL }) => {
  await isolate(page, baseURL!)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try planning with the Paris example', exact: true }).click()
  const demo = page.getByRole('region', { name: 'Interactive Paris example', exact: true })
  const add = demo.getByRole('button', { name: 'Add to plan', exact: true })
  await expect(add).toBeDisabled()
  const must = demo.getByRole('button', { name: 'Must-do', exact: true })
  await must.focus(); await page.keyboard.press('Enter')
  await expect(must).toHaveAttribute('aria-pressed', 'true')
  await expect(demo.getByRole('status').filter({ hasText: 'Afternoon is still open' })).toBeVisible()
  await demo.getByRole('button', { name: 'Clear preference', exact: true }).click()
  await expect(must).toHaveAttribute('aria-pressed', 'false')
  await must.click(); await add.click()
  await expect(demo.getByRole('status').filter({ hasText: 'Added to the example itinerary' })).toContainText('Tentative · Nothing booked')
  await demo.getByRole('button', { name: 'Reset example', exact: true }).click()
  await expect(demo.getByRole('status').filter({ hasText: 'Your preference is not set' })).toBeVisible()
  await expect(add).toBeDisabled()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('trip-hub-device') ?? '{}').state?.trips ?? {})).toEqual({})
  await capture(page, 'astryx-public-example-390')
  for (const width of [320, 390, 768, 1440]) for (const colorScheme of ['light', 'dark'] as const) for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme, reducedMotion })
    await demo.getByRole('button', { name: 'Reset example', exact: true }).click()
    await must.click(); await add.click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const button of await demo.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await capture(page, `astryx-public-example-${width}-${colorScheme}-${reducedMotion}`, 'allow')
  }
})

test('prepared ticket opens with the browser offline while a missing ticket stays missing', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  // Prime route code within one document, then cut the browser network. SWs are blocked.
  await open(page, 'overview')
  await page.getByRole('link', { name: /^Tickets/ }).filter({ visible: true }).last().click()
  await expect(page).toHaveURL(`${root}/tickets`)
  await page.getByRole('link', { name: /Example · Musée d’Orsay ticket/ }).click()
  await expect(page.getByRole('img', { name: 'Example · Musée d’Orsay ticket', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await page.getByRole('link', { name: /Example · Train ticket not downloaded/ }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('navigation', { name: 'Trip navigation' }).filter({ visible: true }).getByRole('link', { name: 'Home', exact: true }).click()
  await page.getByRole('link', { name: /^Shared expenses/ }).filter({ visible: true }).last().click()
  await expect(page).toHaveURL(`${root}/money`)
  await page.getByRole('link', { name: 'Add expense', exact: true }).click()
  await expect(page).toHaveURL(`${root}/money/new`)
  await page.context().setOffline(true)
  await page.getByLabel('What for?', { exact: true }).fill('Example · Airplane mode coffee')
  await page.getByLabel('Amount', { exact: true }).fill('8.00')
  await page.getByRole('button', { name: 'Save expense', exact: true }).click()
  await expect(page).toHaveURL(`${root}/money`)
  await page.getByRole('navigation', { name: 'Trip navigation' }).filter({ visible: true }).getByRole('link', { name: 'Home', exact: true }).click()
  await page.getByRole('link', { name: /^Tickets/ }).filter({ visible: true }).last().click()
  await page.getByRole('link', { name: /Example · Musée d’Orsay ticket/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this phone' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Example · Musée d’Orsay ticket', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await page.getByRole('link', { name: /Example · Train ticket not downloaded/ }).click()
  await expect(page.getByRole('alert')).toContainText("You're offline and this file isn't on your phone yet.")
  await page.context().setOffline(false)
  await open(page, 'money')
  await expect(page.getByText('Example · Airplane mode coffee', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Example · Airplane mode coffee', { exact: true })).toBeVisible()
})

test('shared choices retain 44px targets, keyboard selection and enlarged-text reflow', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  for (const width of [320, 390, 768, 1440]) for (const colorScheme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme })
    for (const path of ['travelers', 'money']) {
      await open(page, path)
      expect(await page.locator('#trip-content').evaluate(el => el.scrollWidth <= el.clientWidth), `${path}-${width}-${colorScheme}`).toBe(true)
      if (path === 'money') await expect(page.locator('.quick-add-trigger')).toHaveCount(0)
      await capture(page, `astryx-${path}-${width}-${colorScheme}`)
    }
    await open(page, 'more/settings')
    const group = page.getByRole('radiogroup', { name: 'Temperatures', exact: true })
    await expect(group).toHaveClass(/astryx-segmented-control/)
    for (const radio of await group.getByRole('radio').all()) expect((await radio.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await group.getByRole('radio', { name: '°F', exact: true }).click()
    await page.keyboard.press('ArrowRight')
    await expect(group.getByRole('radio', { name: '°C', exact: true })).toBeFocused()
    await expect(group.getByRole('radio', { name: '°C', exact: true })).toHaveAttribute('aria-checked', 'true')
    await capture(page, `astryx-segmented-${width}-${colorScheme}`)
  }
  await page.setViewportSize({ width: 640, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const path of ['travelers', 'money', 'more/settings']) {
    await open(page, path)
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    expect(await page.locator('#trip-content').evaluate(el => el.scrollWidth <= el.clientWidth), path).toBe(true)
    const title = page.getByRole('heading', { level: 1 }).first()
    expect(await title.evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(100)
    await capture(page, `astryx-${path.replaceAll('/', '-')}-200-percent-text`)
  }
})
