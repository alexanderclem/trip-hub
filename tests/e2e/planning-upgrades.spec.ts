import { expect, test, type Page } from '@playwright/test'
test.use({ actionTimeout: 15_000, navigationTimeout: 20_000 })

// Disposable offline fixtures: every external request is blocked; no live trips or accounts.
const tripId = '00000000-0000-4000-8000-00000000a901'
const me = '00000000-0000-4000-8000-00000000a902'
const sam = '00000000-0000-4000-8000-00000000a903'
const noah = '00000000-0000-4000-8000-00000000a904'
const pollId = '00000000-0000-4000-8000-00000000a905'
const optionId = '00000000-0000-4000-8000-00000000a906'
const placeId = '00000000-0000-4000-8000-00000000a907'
const root = `/t/${tripId}`
const shots = process.env.SHOTS_DIR ?? 'test-results/planning-upgrades'

async function seed(page: Page, baseURL: string, opts: { empty?: boolean; hosted?: boolean; overlap?: boolean } = {}) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route((url) => url.origin !== new URL(baseURL).origin && /https?:/.test(url.protocol), (route) => route.abort())
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }))
  await page.addInitScript(({ tripId, me }) => {
    const saved = JSON.parse(localStorage.getItem('trip-hub-device') ?? '{"state":{},"version":1}')
    if (Object.keys(saved.state?.trips ?? {}).length) return
    localStorage.setItem('trip-hub-device', JSON.stringify({ ...saved, state: { ...saved.state, quizSeen: true, trips: { [tripId]: { tripId, memberId: me, joinedAt: '2026-11-01T12:00:00Z' } } } }))
  }, { tripId, me })
  await page.goto('/app')
  await expect(page.getByText('No upcoming trips', { exact: true })).toBeVisible()
  await page.evaluate(async ({ tripId, me, sam, noah, pollId, optionId, placeId, opts }) => {
    const req = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
    const tx = db.transaction(['trips', 'members', 'places', 'polls', 'poll_options', 'poll_votes', 'itinerary_items', 'leg_overrides', 'expenses'], 'readwrite')
    const put = (store: string, row: Record<string, unknown>) => tx.objectStore(store).put({ trip_id: tripId, deleted_at: null, created_by: me, created_at: '2026-11-01T12:00:00Z', ...row })
    put('trips', { id: tripId, name: 'A weekend together', timezone: 'America/New_York', start_date: '2027-05-01', end_date: '2027-05-03', base_currency: 'USD', local_currency: 'USD', share_token: 'local-only', route_factor_low: 1.4, route_factor_high: 2, settings: {}, bbox: null, offline_pack: null })
    for (const [id, display_name] of [[me, 'Alex'], [sam, 'Sam'], [noah, 'Noah']]) put('members', { id, display_name, color: null, avatar_emoji: null, home_timezone: null })
    for (const [id, name] of [['a', 'Coffee shop'], ['b', 'Tour meeting point'], [placeId, 'Museum']]) put('places', { id, name, category: 'activity', tags: [], lat: null, lng: null, address: 'Main Street', area: 'New York', status: 'shortlist', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' })
    put('polls', { id: pollId, title: 'Which afternoon activity?', description: null, status: 'closed', winner_option_id: optionId, kind: 'options', closes_at: null })
    put('poll_options', { id: optionId, poll_id: pollId, label: 'Museum', place_id: placeId, url: 'https://example.com/book', description: 'Meet at the main entrance.' })
    for (const [id, score] of [[me, 3], [sam, 2], [noah, 0]] as const) put('poll_votes', { id: `vote-${id}`, poll_id: pollId, option_id: optionId, member_id: id, score })
    if (!opts.empty) {
      const common = { kind: 'activity', to_place_id: null, all_day: false, start_tz: 'America/New_York', end_tz: 'America/New_York', status: 'tentative', confirmation_code: null, attendee_ids: null, details: {}, notes: null, est_cost_currency: 'USD' }
      put('itinerary_items', { ...common, id: 'coffee', title: 'Coffee', place_id: 'a', start_local: '2027-05-01T09:00', end_local: '2027-05-01T10:00', start_at: '2027-05-01T13:00:00.000Z', end_at: '2027-05-01T14:00:00.000Z', est_cost_minor: 0 })
      put('itinerary_items', { ...common, id: 'tour', title: 'Walking tour', place_id: 'b', start_local: opts.overlap ? '2027-05-01T09:30' : '2027-05-01T10:15', end_local: opts.overlap ? '2027-05-01T10:30' : '2027-05-01T11:15', start_at: opts.overlap ? '2027-05-01T13:30:00.000Z' : '2027-05-01T14:15:00.000Z', end_at: opts.overlap ? '2027-05-01T14:30:00.000Z' : '2027-05-01T15:15:00.000Z', est_cost_minor: 6000 })
      put('leg_overrides', { id: 'route', place_a_id: 'a', place_b_id: 'b', mode: 'shuttle', min_s: 1200, max_s: 1800, note: null })
      put('expenses', { id: 'expense', description: 'Shared taxi', category: 'transport', spent_on: '2027-05-01', amount_minor: 3000, currency: 'USD', fx_rate: 1, fx_source: 'same', fx_as_of: null, base_currency: 'USD', base_amount_minor: 3000, payers: [{ member_id: me, amount_minor: 3000 }], split_method: 'equal', split: [me, sam, noah].map((member_id) => ({ member_id, value: 0 })), place_id: null, item_id: null, notes: null })
    }
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { quizSeen: true, trips: { [tripId]: { tripId, memberId: me, joinedAt: '2026-11-01T12:00:00Z' } }, access: opts.hosted ? { [tripId]: { mode: 'hosted', role: 'traveler', organized: true, canRemove: false, epoch: 0, removed: false, removedMembers: [] } } : {}, moneyView: 'base' }, version: 1 }))
    sessionStorage.setItem('stowaway-install-dismissed', '1')
  }, { tripId, me, sam, noah, pollId, optionId, placeId, opts })
  return errors
}

async function read(page: Page, store: string): Promise<Record<string, any>[]> {
  return page.evaluate(async (store) => {
    const req = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
    const get = db.transaction(store).objectStore(store).getAll()
    const rows = await new Promise<Record<string, any>[]>((resolve, reject) => { get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error) })
    db.close(); return rows
  }, store)
}

async function budget(page: Page, amount = '60') {
  await page.goto(`${root}/money`)
  await page.getByRole('button', { name: 'Set a budget', exact: true }).click()
  await page.getByLabel('Trip budget (USD)', { exact: true }).fill(amount)
  await page.getByRole('button', { name: 'Save budget', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Budget saved on this phone.' })).toBeVisible()
}

async function winnerForm(page: Page) {
  await page.goto(`${root}/more/vote/${pollId}`)
  await page.getByRole('link', { name: 'Add to the plan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Schedule group choice', exact: true })).toBeVisible()
  await page.getByLabel('Start date', { exact: true }).fill('2027-05-02')
  await page.getByLabel('Start time', { exact: true }).fill('14:00')
  await page.getByLabel('End time', { exact: true }).fill('15:30')
  await page.getByLabel('Estimated cost (per group)', { exact: true }).fill('120')
}

test('private budget persists offline, stays out of sync, edits and removes', async ({ page, baseURL }) => {
  const errors = await seed(page, baseURL!)
  await budget(page)
  const section = page.getByRole('region', { name: 'Your private budget' })
  await expect(section).toContainText('$30.00 left in your budget')
  expect((await read(page, '_outbox')).some((row) => JSON.stringify(row).includes('budget:'))).toBe(false)
  expect((await read(page, '_meta')).find((row) => row.key === `budget:${tripId}:${me}`)).toBeTruthy()
  await page.reload()
  await expect(section).toContainText('$60.00')
  await section.getByRole('button', { name: 'Edit budget' }).click()
  await page.getByLabel('Trip budget (USD)', { exact: true }).fill('20')
  await page.getByRole('button', { name: 'Save budget', exact: true }).click()
  await expect(section).toContainText('$10.00 over your budget')
  await section.getByRole('button', { name: 'Edit budget' }).click()
  await section.getByRole('button', { name: 'Remove budget' }).click()
  await expect(section.getByRole('button', { name: 'Set a budget' })).toBeVisible()
  expect((await read(page, '_meta')).some((row) => row.key.startsWith('budget:'))).toBe(false)
  expect(errors).toEqual([])
})

test('empty trips can set a zero budget and recover from a failed local save', async ({ page, baseURL }) => {
  await seed(page, baseURL!, { empty: true })
  await page.goto(`${root}/money`)
  await page.getByRole('button', { name: 'Set a budget' }).click()
  await page.getByLabel('Trip budget (USD)', { exact: true }).fill('0')
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === '_meta') { IDBObjectStore.prototype.put = original; throw new DOMException('Storage unavailable', 'QuotaExceededError') }
      return original.apply(this, args)
    }
  })
  await page.getByRole('button', { name: 'Save budget' }).click()
  await expect(page.getByRole('alert')).toContainText('Storage unavailable')
  await expect(page.getByLabel('Trip budget (USD)', { exact: true })).toHaveValue('0')
  await page.getByRole('button', { name: 'Save budget' }).click()
  await expect(page.getByRole('region', { name: 'Your private budget' })).toContainText('$0.00 left in your budget')
})

test('winner becomes a scheduled activity and owned booking task, with budget impact and duplicate protection', async ({ page, baseURL }) => {
  const errors = await seed(page, baseURL!)
  await budget(page)
  await winnerForm(page)
  await expect(page.getByLabel('Alex', { exact: true })).toBeChecked()
  await expect(page.getByLabel('Sam', { exact: true })).toBeChecked()
  await expect(page.getByLabel('Noah', { exact: true })).not.toBeChecked()
  const impact = page.getByRole('region', { name: 'Your budget impact' })
  await expect(impact).toContainText('Your estimated share: ≈ $60.00')
  await expect(impact).toContainText('Trip total after saving: ≈ $90.00')
  await expect(impact).toContainText('$30.00 over your budget')
  await page.getByLabel('Create a booking task').check()
  await page.getByRole('combobox', { name: 'Who will book it?', exact: true }).selectOption(sam)
  await page.getByLabel('Book by', { exact: true }).fill('2027-04-28')
  await page.getByRole('button', { name: 'Schedule this choice' }).click()
  await page.waitForURL(/\/plan\/[a-f0-9-]+$/)
  await expect(page.getByRole('heading', { name: 'Museum', exact: true })).toBeVisible()
  const saved = (await read(page, 'itinerary_items')).find((row) => row.details.vote_option_id === optionId)!
  expect(saved.attendee_ids).toEqual([me, sam])
  expect(saved.est_cost_minor).toBe(12000)
  expect(saved.start_local).toBe('2027-05-02T14:00')
  expect(saved.end_local).toBe('2027-05-02T15:30')
  expect((await read(page, 'trip_tasks'))[0]).toMatchObject({ assignee_id: sam, due_date: '2027-04-28', completed: false })
  await page.getByRole('link', { name: /Booking task · Sam/ }).click()
  await expect(page.getByRole('link', { name: 'View Museum in the plan' })).toBeVisible()
  await page.goto(`${root}/more/vote/${pollId}`)
  await expect(page.getByRole('link', { name: 'View in the plan' })).toBeVisible()
  await page.goto(`${root}/plan/new?poll=${pollId}&option=${optionId}`)
  await expect(page.getByText('This choice is already in the plan.', { exact: true })).toBeVisible()
  expect((await read(page, 'itinerary_items')).filter((row) => row.details.vote_option_id === optionId)).toHaveLength(1)
  expect(errors).toEqual([])
})

test('failed booking-task write rolls back everything and retains the form for retry', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await winnerForm(page)
  await page.getByLabel('Create a booking task').check()
  await page.getByLabel('Book by', { exact: true }).fill('2027-04-28')
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'trip_tasks') { IDBObjectStore.prototype.put = original; throw new DOMException('Task storage unavailable', 'QuotaExceededError') }
      return original.apply(this, args)
    }
  })
  await page.getByRole('button', { name: 'Schedule this choice' }).click()
  await expect(page.getByRole('alert')).toContainText('Task storage unavailable')
  await expect(page.getByLabel('Start time', { exact: true })).toHaveValue('14:00')
  await expect(page.getByLabel('Estimated cost (per group)', { exact: true })).toHaveValue('120')
  expect((await read(page, 'itinerary_items')).filter((row) => row.details.vote_option_id)).toHaveLength(0)
  expect(await read(page, 'trip_tasks')).toHaveLength(0)
  expect(await read(page, '_outbox')).toHaveLength(0)
  await page.getByRole('button', { name: 'Schedule this choice' }).click()
  await page.waitForURL(/\/plan\/[a-f0-9-]+$/)
  expect(await read(page, 'trip_tasks')).toHaveLength(1)
})

test('travel shortage offers an explicit preview, saves offline, and undoes', async ({ page, baseURL }) => {
  const errors = await seed(page, baseURL!)
  await page.goto(`${root}/plan?day=2027-05-01`)
  await page.getByRole('button', { name: 'Review fixes' }).click()
  const dialog = page.getByRole('dialog', { name: 'Review schedule fixes' })
  await expect(dialog).toContainText('15 min later')
  await dialog.getByRole('radio', { name: /Move Walking tour/ }).check()
  await expect(dialog.getByRole('region', { name: 'Schedule preview' })).toBeVisible()
  expect((await read(page, 'itinerary_items')).find((row) => row.id === 'tour')!.start_local).toBe('2027-05-01T10:15')
  await dialog.getByRole('button', { name: 'Apply this fix' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'Allow more travel time' })).toHaveCount(0)
  const saved = (await read(page, 'itinerary_items')).find((row) => row.id === 'tour')!
  expect(saved.start_local).toBe('2027-05-01T10:30')
  expect(saved.end_local).toBe('2027-05-01T11:30')
  expect((await read(page, '_outbox')).some((row) => row.table === 'itinerary_items')).toBe(true)
  await page.getByRole('button', { name: /^Undo:/ }).click()
  await expect(page.getByRole('heading', { name: 'Allow more travel time' })).toBeVisible()
  expect((await read(page, 'itinerary_items')).find((row) => row.id === 'tour')!.start_local).toBe('2027-05-01T10:15')
  expect(errors).toEqual([])
})

test('overlap warnings expose fixes and saved buffers change the next departure', async ({ page, baseURL }) => {
  await seed(page, baseURL!, { overlap: true })
  await page.goto(`${root}/plan?day=2027-05-01`)
  await page.getByRole('button', { name: 'Review fixes' }).click()
  const dialog = page.getByRole('dialog', { name: 'Review schedule fixes' })
  await expect(dialog).toContainText('60 min later')
  await dialog.getByRole('button', { name: 'Apply this fix' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.goto(`${root}/plan/tour/edit`)
  await page.getByLabel('Check-in / preparation (min)', { exact: true }).fill('20')
  await page.getByLabel('Waiting time (min)', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForURL(`**/plan/tour`)
  await expect(page.getByText(/Arrival buffers: 20 min/)).toBeVisible()
  await page.goto(`${root}/plan?day=2027-05-01`)
  await expect(page.getByText('Plus 30 min for check-in / waiting · 60 min total.')).toBeVisible()
})

test('hosted travelers can set private budgets but cannot schedule choices or apply fixes', async ({ page, baseURL }) => {
  await seed(page, baseURL!, { hosted: true })
  await page.goto(`${root}/plan?day=2027-05-01`)
  await expect(page.getByRole('heading', { name: 'Allow more travel time' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review fixes' })).toHaveCount(0)
  await page.goto(`${root}/more/vote/${pollId}`)
  await expect(page.getByRole('link', { name: 'Add to the plan', exact: true })).toHaveCount(0)
  await page.goto(`${root}/plan/new?poll=${pollId}&option=${optionId}`)
  await expect(page.getByText('You do not have permission to edit this itinerary.')).toBeVisible()
  await budget(page)
  await expect(page.getByRole('region', { name: 'Your private budget' })).toContainText('$60.00')
})

test('editing a cost replaces the estimate in the budget preview instead of counting it twice', async ({ page, baseURL }) => {
  await seed(page, baseURL!); await budget(page)
  await page.goto(`${root}/plan/tour/edit`)
  await page.getByLabel('Estimated cost (per group)', { exact: true }).fill('120')
  const impact = page.getByRole('region', { name: 'Your budget impact' })
  await expect(impact).toContainText('Your estimated share: ≈ $40.00')
  await expect(impact).toContainText('Trip total after saving: ≈ $50.00 (+$20.00)')
  await expect(impact).toContainText('$10.00 left in your budget')
  expect((await read(page, 'itinerary_items')).find((row) => row.id === 'tour')!.est_cost_minor).toBe(6000)
})

test('schedule previews reject another traveler’s newer edit without overwriting it', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.goto(`${root}/plan?day=2027-05-01`)
  await page.getByRole('button', { name: 'Review fixes' }).click()
  await page.evaluate(async () => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result) })
    const tx = db.transaction('itinerary_items', 'readwrite')
    const get = tx.objectStore('itinerary_items').get('coffee')
    get.onsuccess = () => tx.objectStore('itinerary_items').put({ ...get.result, notes: 'Sam changed the meeting point' })
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve() }); db.close()
  })
  await page.getByRole('button', { name: 'Apply this fix' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('itinerary changed')
  expect((await read(page, 'itinerary_items')).find((row) => row.id === 'coffee')!.notes).toBe('Sam changed the meeting point')
  expect((await read(page, 'itinerary_items')).find((row) => row.id === 'tour')!.start_local).toBe('2027-05-01T10:15')
})

test('new surfaces reflow in both themes, support reduced motion and keyboard focus', async ({ page, baseURL }) => {
  await seed(page, baseURL!)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await budget(page)
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => localStorage.setItem('stowaway-appearance', value), theme)
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(`${root}/money`)
      await expect(page.getByRole('region', { name: 'Your private budget' })).toContainText('$60.00')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `${shots}/budget-${theme}-${width}.png`, fullPage: true })
      await page.getByRole('region', { name: 'Your private budget' }).screenshot({ path: `${shots}/budget-detail-${theme}-${width}.png` })
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${root}/plan?day=2027-05-01`)
  const review = page.getByRole('button', { name: 'Review fixes' })
  await review.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Review schedule fixes' })).toBeVisible()
  await page.screenshot({ path: `${shots}/schedule-fix-dark-390.png` })
  await page.keyboard.press('Escape')
  await expect(review).toBeFocused()
  await winnerForm(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('#trip-content').evaluate((el) => { el.scrollTop = 0 })
  await page.screenshot({ path: `${shots}/winner-head-dark-390.png` })
  await page.getByRole('region', { name: 'Your budget impact' }).screenshot({ path: `${shots}/winner-impact-dark-390.png` })
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  await expect(page.getByRole('button', { name: 'Schedule this choice' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
