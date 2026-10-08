import { expect, test, type Page } from '@playwright/test'
import type { AIRequest, IdeaResult, Profile } from '../../src/features/discovery/model'

// This suite uses disposable browser data and mocked network boundaries; never writes to live trips.
const TRIP = '00000000-0000-4000-8000-000000000011'
const ALEX = '00000000-0000-4000-8000-000000000012'
const SAM = '00000000-0000-4000-8000-000000000013'
const USER = '00000000-0000-4000-8000-000000000014'
const scores = { adventure: 70, nature: 90, culture: 60, food: 95, nightlife: 10, relaxation: 80, comfort: 60, budget: 85 }
const profile: Profile = { scores, description: 'Food and quiet nature', constraints: 'Vegetarian; no clubs' }
const result: IdeaResult = { ideas: [{ title: 'Markets and coastal mornings', destination: 'California', timezone: 'America/Los_Angeles', currency: 'USD', summary: 'Local food and an easy walk by the sea.', why: 'Food, nature, and a slower pace.', tradeoffs: 'Leave a free evening for travelers with different tastes.', scores, estimatedCostMinor: 15000,
  days: [{ title: 'A slow start', activities: [{ title: 'Visit the food market', kind: 'meal', time: '10:00', durationMinutes: 60, placeName: 'Seaside market', existingPlaceId: null, notes: 'Verify opening hours and vegetarian options.', costMinor: 2000 }] }], tasks: ['Check market opening hours'],
}, { title: 'Museum weekend', destination: 'California', timezone: 'America/Los_Angeles', currency: 'USD', summary: 'Art and architecture.', why: 'An alternative for culture lovers.', tradeoffs: 'Less time in nature.', scores: { ...scores, nature: 20, culture: 95 }, estimatedCostMinor: 18000,
  days: [{ title: 'Gallery morning', activities: [{ title: 'Explore the museum', kind: 'activity', time: '11:00', durationMinutes: 90, placeName: null, existingPlaceId: null, notes: 'Verify hours.', costMinor: 2500 }] }], tasks: [],
}] }

// Stowie's reading of a typed line: a request to add to the trip, a change to the draft, or a one-day plan in California.
const chatReply = (text: string) => /task/i.test(text)
  ? { intent: 'ask', reply: 'Let me look.', destination: null, days: null, budget: null, topics: ['tasks'] }
  : /downtime|slower/i.test(text)
    ? { intent: 'refine', reply: 'More room to breathe, got it.', destination: null, days: null, budget: null, topics: [] }
    : { intent: 'plan', reply: 'A slow day by the sea, noted.', destination: 'California', days: 1, budget: null, topics: [] }
const nothing = { action: 'none', title: null, date: null, time: null, durationMinutes: null, assignee: null, options: [] }
const assistReply = (text: string) => /task/i.test(text)
  ? { ...nothing, reply: 'I can add that for Sam. Shall I?', action: 'task', title: 'Book the shuttle', assignee: 'sam' }
  : { ...nothing, reply: 'Nothing is on the plan yet.' }
/** The hand editor sits behind Stowie's chat; getting there by links keeps both routes loaded for offline steps. */
async function openEditor(page: Page) {
  await page.getByRole('link', { name: 'Explore trip ideas' }).click()
  await page.getByRole('link', { name: 'Edit by hand' }).click()
  await page.waitForURL(/\/more\/ideas\/manual$/)
}

async function mockNetwork(page: Page, calls: AIRequest[]) {
  await page.route('**/auth/v1/**', (route) => route.fulfill({ json: { id: USER, aud: 'authenticated', role: 'authenticated', email: '', app_metadata: {}, user_metadata: {}, is_anonymous: true, created_at: '2026-10-02T00:00:00Z' } }))
  const rows = new Map<string, Record<string, unknown>[]>()
  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request(), url = new URL(req.url()), table = url.pathname.split('/').pop()!
    if (table === 'create_trip') {
      const t = req.postDataJSON() as Record<string, string>
      rows.set('trips', [{ id: t.p_trip_id, name: t.p_name, timezone: t.p_timezone, start_date: t.p_start_date, end_date: t.p_end_date, base_currency: t.p_base_currency, local_currency: t.p_local_currency, route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'test', settings: {}, updated_at: new Date().toISOString() }])
      rows.set('members', [{ id: t.p_member_id, trip_id: t.p_trip_id, display_name: t.p_member_name, color: '#295361', avatar_emoji: null, home_timezone: null, updated_at: new Date().toISOString() }])
      await route.fulfill({ json: t.p_trip_id }); return
    }
    if (req.method() === 'POST') {
      const payload = req.postDataJSON() as Record<string, unknown>[]
      const saved = rows.get(table) ?? []
      for (const r of payload) { const i = saved.findIndex((s) => s.id === r.id); const row = { ...r, updated_at: new Date().toISOString() }; if (i < 0) saved.push(row); else saved[i] = row }
      rows.set(table, saved)
      await route.fulfill({ json: null }); return
    }
    const tripFilter = url.searchParams.get('trip_id')?.slice(3)
    const saved = (rows.get(table) ?? []).filter((r) => !tripFilter || r.trip_id === tripFilter)
    await route.fulfill({ json: saved, headers: { 'content-range': `0-${Math.max(0, saved.length - 1)}/${saved.length}` } })
  })
  await page.route('**/api/travel-ai', async (route) => {
    const body = route.request().postDataJSON() as AIRequest
    calls.push(body)
    const revision = structuredClone(result)
    if (body.action === 'ideas' && body.tripId && body.previous) revision.ideas[0]!.days[0]!.activities[0]!.title = 'A slower food market morning'
    if (body.action === 'chat') { await route.fulfill({ json: chatReply(body.text) }); return }
    if (body.action === 'assist') { await route.fulfill({ json: assistReply(body.text) }); return }
    await route.fulfill({ json: body.action === 'profile' ? { scores, explanation: 'Food and nature lead; nightlife is low.' } : revision })
  })
  await page.addInitScript(({ user }) => {
    localStorage.setItem('sb-croqjdvzbpcscdcshnet-auth-token', JSON.stringify({ access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: user, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, is_anonymous: true } }))
  }, { user: USER })
}

async function seedTrip(page: Page, ideas: IdeaResult) {
  // Wait for the app's Dexie schema before opening it with the native API.
  await expect.poll(() => page.evaluate(async () => {
    if (!(await indexedDB.databases()).some((entry) => entry.name === 'trip-hub')) return []
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open('trip-hub'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
    const stores = Array.from(database.objectStoreNames)
    database.close()
    return stores
  })).toEqual(expect.arrayContaining(['trips', 'members', 'member_preferences', 'ai_drafts']))
  await page.evaluate(async ({ tripId, alex, sam, profile: p, ideas }) => {
    localStorage.setItem('trip-hub-device', JSON.stringify({ version: 1, state: { trips: { [tripId]: { tripId, memberId: alex, joinedAt: new Date().toISOString() } }, travelProfile: p } }))
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open('trip-hub'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
    const tables = ['trips', 'members', 'member_preferences', 'ai_drafts']
    const tx = database.transaction(tables, 'readwrite')
    tx.objectStore('trips').put({ id: tripId, name: 'E2E TEST local AI planning', timezone: 'America/Los_Angeles', start_date: '2027-03-14', end_date: '2027-03-15', base_currency: 'USD', local_currency: null, route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'test', settings: {} })
    for (const [id, name] of [[alex, 'Alex'], [sam, 'Sam'], ['00000000-0000-4000-8000-000000000015', 'Lee']]) tx.objectStore('members').put({ id, trip_id: tripId, display_name: name, color: '#295361', avatar_emoji: null, home_timezone: null })
    tx.objectStore('member_preferences').put({ id: crypto.randomUUID(), trip_id: tripId, member_id: alex, ...p })
    tx.objectStore('member_preferences').put({ id: crypto.randomUUID(), trip_id: tripId, member_id: sam, ...p, scores: { ...p.scores, nature: 20, nightlife: 90 }, constraints: 'No long walks' })
    tx.objectStore('ai_drafts').put({ id: '00000000-0000-4000-8000-000000000016', scope: tripId, createdAt: new Date().toISOString(), brief: { prompt: 'A relaxed day', destination: 'California', days: 1, startDate: '2027-03-14', budgetMinor: null, currency: 'USD' }, result: ideas })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    database.close()
  }, { tripId: TRIP, alex: ALEX, sam: SAM, profile, ideas })
}

test('preferences become a radar profile, generate ideas, filter, refine and survive reload', async ({ page }) => {
  const calls: AIRequest[] = []
  await mockNetwork(page, calls)
  await page.goto('/inspire/manual')
  await page.getByRole('textbox', { name: 'What does your ideal trip feel like?' }).fill(profile.description)
  await page.getByRole('button', { name: 'Let AI suggest my scores' }).click()
  await expect(page.getByRole('slider', { name: 'Food', exact: true })).toHaveValue('95')
  await page.getByRole('textbox', { name: /^Must-haves/ }).fill(profile.constraints)
  await page.getByRole('button', { name: 'Save my preferences' }).click()
  await page.getByRole('button', { name: 'Close preferences' }).click()
  await expect(page.getByRole('img', { name: /Saved preferences/ })).toBeVisible()
  await page.getByRole('textbox', { name: 'What are you imagining?' }).fill('One relaxed day on the California coast')
  await page.getByRole('spinbutton', { name: /^Days/ }).fill('1')
  await page.getByRole('button', { name: 'Generate trip ideas' }).click()
  await expect(page.getByRole('heading', { name: result.ideas[0]!.title })).toBeVisible()
  await page.screenshot({ path: '.wrangler/ai-check/trip-ideas-mobile.png', fullPage: true })
  const generated = calls.find((r) => r.action === 'ideas')!
  expect(generated.action === 'ideas' && generated.profiles[0]?.constraints).toBe(profile.constraints)
  await page.getByRole('checkbox', { name: 'Nature', exact: true }).check()
  await expect(page.getByRole('heading', { name: 'Museum weekend' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Refine this idea' }).click()
  await page.getByRole('textbox', { name: 'What would you change?' }).fill('Keep the market, add more downtime')
  await page.getByRole('button', { name: 'Generate a revised draft' }).click()
  await expect(page.getByRole('combobox', { name: 'Saved draft' })).toBeVisible()
  const revision = calls.filter((r) => r.action === 'ideas').at(-1)!
  expect(revision.action === 'ideas' && revision.previous?.title).toBe(result.ideas[0]!.title)
  await page.reload()
  await expect(page.getByRole('heading', { name: result.ideas[0]!.title })).toBeVisible()
  await page.getByRole('button', { name: 'Build this trip' }).first().click()
  await page.waitForURL(/\/new\?draft=/)
  await expect(page.getByLabel('Trip name', { exact: true })).toHaveValue(result.ideas[0]!.title)
  await expect(page.getByLabel('Destination time zone')).toHaveValue('America/Los_Angeles')
  await page.getByLabel('Your name').fill('Alex')
  await page.getByLabel('Starts', { exact: true }).fill('2027-03-14')
  await page.getByRole('button', { name: 'Create trip', exact: true }).click()
  await page.waitForURL(/\/plan$/)
  await expect(page.getByRole('link', { name: 'Visit the food market', exact: true })).toBeVisible()
})

test('a failed score suggestion shows feedback beside the button and can be retried', async ({ page }) => {
  const calls: AIRequest[] = []
  await mockNetwork(page, calls)
  let attempts = 0
  await page.route('**/api/travel-ai', async (route) => {
    attempts++
    if (attempts === 1) await route.fulfill({ status: 503, json: { error: 'AI planning is temporarily unavailable. Try again.' } })
    else await route.fulfill({ json: { scores, explanation: 'Nature and food matter most.' } })
  })
  await page.goto('/inspire/manual')
  await page.getByRole('textbox', { name: 'What does your ideal trip feel like?' }).fill('Food and quiet nature')
  await page.getByRole('button', { name: 'Let AI suggest my scores' }).click()
  const error = page.getByRole('alert')
  await expect(error).toHaveText('AI planning is temporarily unavailable. Try again.')
  const buttonBox = await page.getByRole('button', { name: 'Let AI suggest my scores' }).boundingBox()
  const errorBox = await error.boundingBox()
  expect(errorBox!.y - (buttonBox!.y + buttonBox!.height)).toBeLessThan(40)
  await expect(page.getByRole('slider', { name: 'Food', exact: true })).toHaveValue('50')
  await page.getByRole('button', { name: 'Let AI suggest my scores' }).click()
  await expect(page.getByRole('slider', { name: 'Food', exact: true })).toHaveValue('95')
  await expect(error).toHaveCount(0)
})

test('group radar excludes missing profiles, updates membership and applies and undoes an offline draft', async ({ page, context }) => {
  const calls: AIRequest[] = []
  await mockNetwork(page, calls)
  await page.goto('/inspire') // opens the current IndexedDB schema
  await seedTrip(page, result)
  await page.goto(`/t/${TRIP}/more/ideas/manual`)
  await expect(page.getByText('2 of 3 travelers included.', { exact: false })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Lee · Needs a profile' })).toBeDisabled()
  await expect(page.getByText(/Different tastes: Nature, Nightlife/)).toBeVisible()
  await page.screenshot({ path: '.wrangler/ai-check/group-preferences-mobile.png', fullPage: true })
  await page.getByRole('checkbox', { name: 'Sam', exact: true }).uncheck()
  await expect(page.getByText('1 of 3 travelers included.', { exact: false })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Alex (you)' }).uncheck()
  await expect(page.getByText('Select at least one traveler')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Alex (you)' }).check()
  // Load the lazy calendar route before testing offline navigation.
  await page.goto(`/t/${TRIP}/plan`)
  await expect(page.getByText('Nothing planned yet', { exact: true })).toBeVisible()
  await openEditor(page)
  await context.setOffline(true)
  await page.locator('section').filter({ has: page.getByRole('heading', { name: result.ideas[0]!.title }) }).last().getByRole('button', { name: 'Add draft to plan' }).click()
  await expect(page.getByText(/Added 1 tentative items/)).toBeVisible()
  await page.getByRole('link', { name: 'Open plan' }).click()
  await page.waitForURL(/\/plan$/)
  await expect(page.getByRole('link', { name: 'Visit the food market', exact: true })).toBeVisible()
  await openEditor(page)
  await context.setOffline(false)
  await page.locator('section').filter({ has: page.getByRole('heading', { name: result.ideas[0]!.title }) }).last().getByRole('button', { name: 'Refine this idea' }).click()
  await page.getByRole('textbox', { name: 'What would you change?' }).fill('A slower morning at the market')
  await page.getByRole('spinbutton', { name: /^Days/ }).fill('1')
  await page.getByRole('button', { name: 'Generate a revised draft' }).click()
  await expect(page.getByRole('button', { name: 'Replace unedited draft' }).first()).toBeVisible()
  expect(calls.at(-1)?.action === 'ideas' && (calls.at(-1) as Extract<AIRequest, { action: 'ideas' }>).existingPlan).toEqual([])
  await page.locator('section').filter({ has: page.getByRole('heading', { name: result.ideas[0]!.title }) }).last().getByRole('button', { name: 'Replace unedited draft' }).click()
  await expect(page.getByText(/Added 1 tentative items/)).toBeVisible()
  await page.getByRole('link', { name: 'Open plan' }).click()
  await page.waitForURL(/\/plan$/)
  await expect(page.getByRole('link', { name: 'A slower food market morning', exact: true })).toBeVisible()
  await expect(page.getByText('Visit the food market', { exact: true })).toHaveCount(0)
  await openEditor(page)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Undo unedited additions' }).click()
  await expect(page.getByText(/Removed 3 generated entries/)).toBeVisible()
  await page.getByRole('link', { name: 'Open plan' }).click()
  await page.waitForURL(/\/plan$/)
  await expect(page.getByText('Visit the food market', { exact: true })).toHaveCount(0)
  await expect(page.getByText('A slower food market morning', { exact: true })).toHaveCount(0)
})

test('an overlapping draft explains the empty plan and can be refined and added', async ({ page }) => {
  const calls: AIRequest[] = []
  await mockNetwork(page, calls)
  await page.goto('/inspire')
  const overlapping = structuredClone(result)
  overlapping.ideas = [overlapping.ideas[0]!]
  const activities = overlapping.ideas[0]!.days[0]!.activities
  activities[0]!.time = '17:00'
  activities[0]!.durationMinutes = 120
  activities.push({ ...activities[0]!, title: 'Sunset at El Arco', time: '18:00', durationMinutes: 60 })
  await seedTrip(page, overlapping)
  await page.goto(`/t/${TRIP}/more/ideas/manual`)
  await page.getByText('Preview daily itinerary', { exact: true }).click()
  await expect(page.getByText('17:00–19:00', { exact: true })).toBeVisible()
  await expect(page.getByText('18:00–19:00', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add draft to plan' }).click()
  await expect(page.getByRole('alert')).toHaveText('“Sunset at El Arco” overlaps “Visit the food market” within this draft on 2027-03-14. Nothing was added to your plan. Refine this idea to give the activities separate times.')
  await page.goto(`/t/${TRIP}/plan`)
  await expect(page.getByText('Nothing planned yet', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Sunset at El Arco/ })).toHaveCount(0)
  await openEditor(page)
  await page.getByRole('button', { name: 'Refine this idea' }).click()
  await page.getByRole('textbox', { name: 'What would you change?' }).fill('Give the market and sunset separate times, keeping sunset in the evening')
  await page.getByRole('spinbutton', { name: /^Days/ }).fill('1')
  await page.getByRole('button', { name: 'Generate a revised draft' }).click()
  await expect(page.getByRole('combobox', { name: 'Saved draft' })).toBeVisible()
  const revised = calls.at(-1) as Extract<AIRequest, { action: 'ideas' }>
  expect(revised.existingPlan).toEqual([])
  expect(revised.previous?.days[0]?.activities[1]?.title).toBe('Sunset at El Arco')
  await page.locator('section').filter({ has: page.getByRole('heading', { name: result.ideas[0]!.title }) }).last().getByRole('button', { name: 'Add draft to plan' }).click()
  await expect(page.getByText(/Added 1 tentative items/)).toBeVisible()
  await page.getByRole('link', { name: 'Open plan' }).click()
  await expect(page.getByRole('link', { name: 'A slower food market morning', exact: true })).toBeVisible()
})

const SHOTS = process.env.SHOTS_DIR
const say = async (page: Page, text: string) => {
  await page.getByRole('textbox', { name: 'Message Stowie' }).fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
}

test('Stowie learns a travel style, sketches from a typed line, revises, and survives reload', async ({ page }) => {
  const calls: AIRequest[] = []
  await mockNetwork(page, calls)
  await page.goto('/inspire')
  const log = page.getByRole('log', { name: 'Conversation with Stowie' })
  await expect(log.getByText(/I’d like to know how you travel/)).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stowie-1-hello.png` })
  await page.getByRole('button', { name: 'Tell you myself' }).click()
  await say(page, profile.description)
  await expect(page.getByRole('img', { name: 'Suggested travel style' })).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stowie-2-style.png` })
  await page.getByRole('button', { name: 'Yes, save it' }).click()
  await expect(log.getByText('Now, what are you imagining?')).toBeVisible()

  // One typed line carries the place and the length, so Stowie asks only about budget.
  await say(page, 'One relaxed day on the California coast')
  await expect(log.getByText('A slow day by the sea, noted.')).toBeVisible()
  await page.getByRole('button', { name: 'No limit in mind' }).click()
  await expect(page.getByRole('heading', { name: result.ideas[0]!.title })).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stowie-3-draft.png` })
  expect(calls.map((c) => c.action)).toEqual(['profile', 'chat', 'ideas'])
  const first = calls[2] as Extract<AIRequest, { action: 'ideas' }>
  expect(first.brief).toMatchObject({ prompt: 'One relaxed day on the California coast', destination: 'California', days: 1, budgetMinor: null })
  expect(first.profiles[0]?.scores.food).toBe(95)

  await say(page, 'Keep the market, add more downtime')
  await expect(log.getByText('Here’s the revision. Tell me if it’s closer.')).toBeVisible()
  const revision = calls.at(-1) as Extract<AIRequest, { action: 'ideas' }>
  expect(revision.previous?.title).toBe(result.ideas[0]!.title)
  expect(revision.brief.days).toBe(1)

  await page.reload()
  await expect(log.getByText('Here’s the revision. Tell me if it’s closer.')).toBeVisible()
  await page.getByRole('button', { name: 'Build this trip' }).click()
  await page.waitForURL(/\/new\?draft=/)
  await expect(page.getByLabel('Trip name', { exact: true })).toHaveValue(result.ideas[0]!.title)
})

test('Stowie adds a saved draft to the trip offline, and says so when it cannot reach the planner', async ({ page, context }) => {
  const calls: AIRequest[] = []
  await mockNetwork(page, calls)
  await page.goto('/inspire') // opens the current IndexedDB schema
  await seedTrip(page, result)
  // Load the plan and chat routes before going offline.
  await page.goto(`/t/${TRIP}/plan`)
  await page.getByRole('link', { name: 'Explore trip ideas' }).click()
  const log = page.getByRole('log', { name: 'Conversation with Stowie' })
  await expect(log.getByText(/I have travel styles for 2 of you/)).toBeVisible()
  await context.setOffline(true)
  await say(page, 'Somewhere with a beach')
  await expect(log.getByText(/I can’t reach the planner without a connection/)).toBeVisible()
  expect(calls).toEqual([])
  await page.getByRole('button', { name: 'Show my last draft' }).click()
  await expect(page.getByRole('heading', { name: result.ideas[0]!.title })).toBeVisible()
  await page.getByRole('button', { name: 'Add it to the plan' }).click()
  await expect(log.getByText(/1 tentative item is in the plan/)).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stowie-4-applied.png` })
  await page.getByRole('button', { name: 'Open the plan' }).click()
  await page.waitForURL(/\/plan$/)
  await expect(page.getByRole('link', { name: 'Visit the food market', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Explore trip ideas' }).click()
  await page.getByRole('button', { name: 'Undo that' }).click()
  await expect(log.getByText(/Removed 3 generated entries/)).toBeVisible()
})

test('Stowie hosts the quiz and picks the conversation back up with the result', async ({ page }) => {
  await mockNetwork(page, [])
  await page.goto('/inspire')
  await page.getByRole('button', { name: 'Take the quiz' }).click()
  await page.waitForURL(/\/quiz\?next=%2Finspire$/)
  await page.getByRole('button', { name: 'Start the quiz' }).click()
  const progress = page.getByRole('progressbar', { name: 'Quiz progress' })
  const total = Number(await progress.getAttribute('aria-valuemax'))
  for (let i = 0; i < total; i++) {
    await expect(progress).toHaveAttribute('aria-valuenow', String(i + 1))
    if (i === 2 && SHOTS) await page.screenshot({ path: `${SHOTS}/stowie-5-quiz.png` })
    await page.getByRole('radio').first().click()
  }
  await expect(page.getByRole('img', { name: /Your travel style/ })).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stowie-6-quiz-result.png` })
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(/\/inspire$/)
  const log = page.getByRole('log', { name: 'Conversation with Stowie' })
  await expect(log.getByText(/^Stowie: Saved\. I’d call you a /)).toBeVisible()
  await expect(log.getByText('Now, what are you imagining?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Surprise me' })).toBeVisible()
})

test('Stowie rides along on trip tabs, answers from the trip, and adds a task only after a yes', async ({ page }) => {
  const calls: AIRequest[] = []
  await mockNetwork(page, calls)
  await page.goto('/inspire') // opens the current IndexedDB schema
  await seedTrip(page, result)
  await page.goto(`/t/${TRIP}/plan`)
  await expect(page.getByRole('button', { name: 'Ask Stowie' })).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stowie-9-launcher.png` })
  await page.getByRole('button', { name: 'Ask Stowie' }).click()
  const sheet = page.getByRole('dialog', { name: 'Stowie' })
  const log = sheet.getByRole('log', { name: 'Conversation with Stowie' })
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stowie-7-companion.png` })

  // The plan tab's own suggestion comes first, and sends only the plan.
  await sheet.getByRole('button', { name: 'What’s next?' }).click()
  await expect(log.getByText('Nothing is on the plan yet.')).toBeVisible()
  const asked = calls.at(-1) as Extract<AIRequest, { action: 'assist' }>
  expect(Object.keys(asked.snapshot)).toEqual(['plan'])
  expect(asked.me).toBe('Alex')

  await sheet.getByRole('textbox', { name: 'Message Stowie' }).fill('Add a task for Sam to book the shuttle')
  await sheet.getByRole('button', { name: 'Send' }).click()
  await expect(sheet.getByText('Add a shared task')).toBeVisible()
  await expect(sheet.getByText('For Sam', { exact: true })).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stowie-8-proposal.png` })
  expect(await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open('trip-hub'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
    const count = await new Promise<number>((resolve) => { const req = database.transaction('trip_tasks').objectStore('trip_tasks').count(); req.onsuccess = () => resolve(req.result) })
    database.close()
    return count
  })).toBe(0)
  await sheet.getByRole('button', { name: 'Yes, add it' }).click()
  await expect(log.getByText('Added the task “Book the shuttle” for Sam.')).toBeVisible()
  await sheet.getByRole('button', { name: 'Open tasks' }).click()
  await page.waitForURL(/\/more\/tasks$/)
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('link', { name: /Book the shuttle/ })).toBeVisible()

  // Money is added up on the phone, with no request at all.
  const before = calls.length
  await page.goto(`/t/${TRIP}/money`)
  await page.getByRole('button', { name: 'Ask Stowie' }).click()
  await sheet.getByRole('button', { name: 'What do I owe?' }).click()
  await expect(log.getByText(/all square/)).toBeVisible()
  expect(calls.length).toBe(before)

  // Stowie stays out of forms.
  await page.goto(`/t/${TRIP}/more/tasks/new`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ask Stowie' })).toHaveCount(0)
})
