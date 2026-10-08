import { expect, test, type Page } from '@playwright/test'

// Local-only: fixtures live in this browser's IndexedDB and every outside request is blocked, so
// nothing here touches a real trip.
const tripId = '00000000-0000-4000-8000-000000000a01'
const alex = '00000000-0000-4000-8000-000000000a02'
const sam = '00000000-0000-4000-8000-000000000a03'
const pollId = '00000000-0000-4000-8000-000000000a04'
const optA = '00000000-0000-4000-8000-000000000a05'
const optB = '00000000-0000-4000-8000-000000000a06'
const token = 'local-only-token-000001'
const base = `/t/${tripId}`
const shots = process.env.SHOTS_DIR

type Rows = Record<string, Record<string, unknown>[]>

async function seed(page: Page, baseURL: string, opts: { offline: boolean; rows?: Rows }) {
  await page.route((url) => url.protocol === 'https:' && url.origin !== new URL(baseURL).origin, (route) => route.abort())
  if (opts.offline) await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }))
  await page.goto('/inspire')
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  await page.evaluate(async ({ tripId, alex, sam, token, rows }) => {
    const request = indexedDB.open('trip-hub')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const all: Record<string, Record<string, unknown>[]> = {
      trips: [{ id: tripId, name: 'E2E TEST votes and comments', timezone: 'America/Guatemala', start_date: null, end_date: null, base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: token, settings: {}, deleted_at: null }],
      members: [
        { id: alex, trip_id: tripId, display_name: 'Alex', color: null, avatar_emoji: null, deleted_at: null, created_at: '2026-10-01T12:00:00.000Z' },
        { id: sam, trip_id: tripId, display_name: 'Sam', color: null, avatar_emoji: null, deleted_at: null, created_at: '2026-10-01T12:05:00.000Z' },
      ],
      ...rows,
    }
    const transaction = database.transaction(Object.keys(all), 'readwrite')
    for (const [store, list] of Object.entries(all)) for (const row of list) transaction.objectStore(store).put(row)
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [tripId]: { tripId, memberId: alex, joinedAt: '2026-10-08T12:00:00.000Z' } }, quizSeen: true }, version: 1 }))
  }, { tripId, alex, sam, token, rows: opts.rows ?? {} })
}

const poll = (over: Record<string, unknown> = {}) => ({ id: pollId, trip_id: tripId, title: 'Where do we stay at the lake?', description: null, status: 'open', winner_option_id: null, kind: 'options', closes_at: null, deleted_at: null, created_at: '2026-10-08T13:00:00.000Z', updated_at: '2026-10-08T13:00:00.000Z', created_by: sam, ...over })
const option = (id: string, label: string) => ({ id, trip_id: tripId, poll_id: pollId, label, place_id: null, url: null, description: null, deleted_at: null, created_at: '2026-10-08T13:00:30.000Z', created_by: sam })
const vote = (optionId: string, member: string, score: number) => ({ id: `${optionId}-${member}`, trip_id: tripId, poll_id: pollId, option_id: optionId, member_id: member, score, deleted_at: null })

async function shot(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no sideways scroll`).toBe(true)
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true })
}

test('a shared vote link opens the vote with no signal, and bad targets go nowhere special', async ({ page, baseURL }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await seed(page, baseURL!, { offline: true, rows: { polls: [poll()], poll_options: [option(optA, 'Casa del Mundo'), option(optB, 'La Iguana Perdida')] } })

  await page.goto(`/join?to=vote/${pollId}#t=${token}`)
  await page.waitForURL(`**${base}/more/vote/${pollId}`)
  await expect(page.getByRole('heading', { name: 'Where do we stay at the lake?' })).toBeVisible()
  // Two options and nobody has voted yet: the page offers to send it to the group.
  await expect(page.getByRole('heading', { name: 'Send it to the group' })).toBeVisible()
  await page.getByRole('button', { name: 'Copy' }).click()
  await expect(page.getByText('Copied. Paste it into your group chat.')).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toBe(`Vote: “Where do we stay at the lake?” · 2 options\n${new URL(baseURL!).origin}/join?to=vote/${pollId}#t=${token}`)
  await shot(page, 'vote-share-390')

  // Once half the group has voted the prompt steps aside; sharing stays in the header.
  const choice = page.getByRole('group', { name: 'Your vote for Casa del Mundo' }).getByRole('button', { name: 'Must-do' })
  await choice.click()
  await expect(choice).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Send it to the group' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Share this vote' })).toBeVisible()

  // A target that isn't a vote is ignored; offline, an unknown trip can't be joined.
  await page.goto(`/join?to=more/settings#t=${token}`)
  await expect(page.getByRole('heading', { name: 'Couldn\'t join the trip' })).toBeVisible()
  expect(page.url()).not.toContain('settings')
  expect(errors).toEqual([])
})

test('a date vote with a deadline: add dates, vote, decide, set the trip dates', async ({ page, baseURL }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await seed(page, baseURL!, { offline: true })
  await page.goto(`${base}/more/vote`)
  await page.getByLabel('What are we deciding?').fill('When can everyone go?')
  await page.getByText('Dates that work').click()
  await page.getByLabel('Voting closes').selectOption('day')
  await page.getByRole('button', { name: 'Create and add dates' }).click()
  await expect(page.getByText(/Voting closes tomorrow /)).toBeVisible()

  for (const [from, to] of [['2027-03-13', '2027-03-20'], ['2027-03-20', '2027-03-27']] as const) {
    await page.getByLabel('First day').fill(from)
    await page.getByLabel('Last day (optional)').fill(to)
    await page.getByRole('button', { name: /^Add Mar/ }).click()
  }
  const ideal = page.getByRole('group', { name: 'Your vote for Mar 13 – 20' }).getByRole('button', { name: 'Ideal' })
  await ideal.click()
  await expect(ideal).toHaveAttribute('aria-pressed', 'true')
  const unavailable = page.getByRole('group', { name: 'Your vote for Mar 20 – 27' }).getByRole('button', { name: 'Can’t' })
  await unavailable.click()
  await expect(unavailable).toHaveAttribute('aria-pressed', 'true')
  await shot(page, 'date-vote-390')

  // The list shows the deadline; the row saved for the server carries the kind and the dates.
  await page.goto(`${base}/more/vote`)
  await expect(page.getByText(/2 options · you voted on 2 · closes tomorrow/)).toBeVisible()
  const queued = await page.evaluate(async () => {
    const request = indexedDB.open('trip-hub')
    const database = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result) })
    const rows = await new Promise<{ table: string; payload: Record<string, unknown> }[]>((resolve) => {
      const all = database.transaction('_outbox').objectStore('_outbox').getAll()
      all.onsuccess = () => resolve(all.result)
    })
    database.close()
    return rows
  })
  expect(queued.find((r) => r.table === 'polls')?.payload).toMatchObject({ kind: 'dates', status: 'open' })
  expect(queued.find((r) => r.table === 'polls')?.payload.closes_at).toBeTruthy()
  expect(queued.filter((r) => r.table === 'poll_options').map((r) => [r.payload.starts_on, r.payload.ends_on])).toEqual([['2027-03-13', '2027-03-20'], ['2027-03-20', '2027-03-27']])

  await page.getByRole('link', { name: /When can everyone go/ }).click()
  // Two people on the trip and one has voted, so the leader has enough votes to win.
  await page.getByRole('button', { name: 'Close voting and pick the winner' }).click()
  await expect(page.getByText('Decided', { exact: true })).toBeVisible()
  await expect(page.getByText('1 × Can’t')).toBeVisible()
  await page.getByRole('button', { name: 'Set as the trip’s dates' }).click()
  await expect(page.getByText('These are the trip’s dates.')).toBeVisible()
  await page.goto(`${base}/overview`)
  await expect(page.getByText(/Mar 13, 2027 – Mar 20, 2027/)).toBeVisible()
  expect(errors).toEqual([])
})

test('a passed deadline ends voting, records the winner, and the winner goes onto the plan', async ({ page, baseURL }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await seed(page, baseURL!, {
    offline: false,
    rows: {
      polls: [poll({ closes_at: '2026-10-08T18:00:00.000Z' })],
      poll_options: [option(optA, 'Casa del Mundo'), option(optB, 'La Iguana Perdida')],
      poll_votes: [vote(optA, alex, 3), vote(optA, sam, 2), vote(optB, alex, 1), vote(optB, sam, 0)],
    },
  })
  await page.goto(`${base}/more/vote/${pollId}`)
  await expect(page.getByText('Voting has ended.')).toBeVisible()
  await expect(page.getByText('Decided', { exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Your vote for Casa del Mundo' }).getByRole('button', { name: 'Must-do' })).toBeDisabled()
  await expect(page.getByRole('heading', { name: 'Add an option' })).toHaveCount(0)

  // This phone has signal, so it records the result for everyone.
  await expect.poll(async () => page.evaluate(async (id) => {
    const request = indexedDB.open('trip-hub')
    const database = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result) })
    const row = await new Promise<Record<string, unknown>>((resolve) => {
      const get = database.transaction('polls').objectStore('polls').get(id)
      get.onsuccess = () => resolve(get.result)
    })
    database.close()
    return [row.status, row.winner_option_id]
  }, pollId)).toEqual(['closed', optA])

  await page.getByRole('link', { name: 'Add to the plan' }).click()
  await page.waitForURL(/\/plan\/new\?title=/)
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Casa del Mundo')
  expect(errors).toEqual([])
})

test('comments on a vote, and what’s new on the overview', async ({ page, baseURL }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const recent = new Date(Date.now() - 5 * 60_000).toISOString()
  await seed(page, baseURL!, {
    offline: true,
    rows: {
      polls: [poll({ created_at: recent, updated_at: recent })],
      poll_options: [{ ...option(optA, 'Casa del Mundo'), created_at: recent }, { ...option(optB, 'La Iguana Perdida'), created_at: recent }],
      comments: [{ id: '00000000-0000-4000-8000-000000000a07', trip_id: tripId, subject_type: 'poll', subject_id: pollId, member_id: sam, body: 'Casa is far from the dock.', deleted_at: null, created_at: recent, created_by: sam }],
    },
  })

  // Sam started a vote and commented since Alex joined: two things are new.
  await page.goto(`${base}/more/vote/${pollId}`)
  const badge = page.getByRole('link', { name: /E2E TEST votes and comments/ }).filter({ visible: true })
  await expect(badge).toContainText('2 new updates')
  await expect(page.getByText('Casa is far from the dock.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Remove your comment/ })).toHaveCount(0) // not Alex's to remove

  await page.getByLabel('Say why, or suggest something else').fill('Worth it for the view though')
  await page.getByRole('button', { name: 'Post comment' }).click()
  await expect(page.getByRole('heading', { name: 'Comments (2)' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Worth it for the view though')).toBeVisible()
  await shot(page, 'vote-comments-390')

  await page.goto(`${base}/more/vote`)
  await expect(page.getByText(/2 comments/)).toBeVisible()

  await page.goto(`${base}/overview`)
  const news = page.getByRole('region', { name: 'What’s new' })
  await expect(news.getByText('on Where do we stay at the lake?: “Casa is far from the dock.”')).toBeVisible()
  await expect(news.getByText('New', { exact: true })).toHaveCount(2)
  await expect(news.getByText(/^You on Where do we stay/)).toBeVisible()
  await expect(page.getByText(/new updates?/)).toHaveCount(0) // seen now
  await shot(page, 'overview-news-390')

  // Leave and come back: nothing is new any more.
  await page.goto(`${base}/more/vote/${pollId}`)
  await page.getByRole('button', { name: /Remove your comment/ }).click()
  await page.getByRole('button', { name: 'Confirm change' }).click()
  await expect(page.getByRole('heading', { name: 'Comments (1)' })).toBeVisible()
  await page.goto(`${base}/overview`)
  await expect(page.getByRole('region', { name: 'What’s new' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'What’s new' }).getByText('New', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Worth it for the view though')).toHaveCount(0)

  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${base}/more/vote/${pollId}`)
    await expect(page.getByRole('heading', { name: 'Comments (1)' })).toBeVisible()
    await shot(page, `vote-comments-${width}`)
    await page.goto(`${base}/overview`)
    await expect(page.getByRole('region', { name: 'What’s new' })).toBeVisible()
    await shot(page, `overview-news-${width}`)
  }
  expect(errors).toEqual([])
})
