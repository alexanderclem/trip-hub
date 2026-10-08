import { expect, test, type Page } from '@playwright/test'

// Live Supabase: two phones share a task list on a disposable "E2E TEST …" trip, and a third
// signed-in device that never joined is refused. The ids are printed so that exactly this
// trip and these anonymous users can be cleaned up afterwards.
const SUPABASE_URL = 'https://croqjdvzbpcscdcshnet.supabase.co'
const KEY = 'sb_publishable_FpJvcMvfUFtCO49tcx0tGA_fZUqNroP'
const SYNC = { timeout: 75_000 }

interface Session { token: string; userId: string }

async function sessionOf(page: Page): Promise<Session> {
  return await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))!
    const s = JSON.parse(localStorage.getItem(key)!) as { access_token: string; user: { id: string } }
    return { token: s.access_token, userId: s.user.id }
  })
}

async function rest(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers },
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) as unknown : null }
}

test('shared tasks sync between two phones, survive offline edits, and stay private to the trip', async ({ browser }) => {
  test.setTimeout(480_000)

  // ── Alex creates the trip; Sam joins with the link ──
  const a = await browser.newContext()
  const pageA = await a.newPage()
  await pageA.goto('/')
  await pageA.getByRole('link', { name: 'Create a trip' }).click()
  await pageA.getByLabel('Trip name').fill(`E2E TEST planning features ${new Date().toISOString()}`)
  await pageA.getByLabel('Your name').fill('Alex')
  await pageA.getByRole('button', { name: 'Create trip' }).click()
  await pageA.waitForURL(/\/more\/settings$/)
  const link = (await pageA.locator('p.font-mono').textContent())!.trim()
  const tripPath = new URL(pageA.url()).pathname.replace(/\/more\/settings$/, '')
  const tripId = tripPath.split('/').pop()!

  const b = await browser.newContext()
  const pageB = await b.newPage()
  await pageB.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await pageB.getByPlaceholder('Your name').fill('Sam')
  await pageB.getByRole('button', { name: 'Add me' }).click()
  await pageB.waitForURL(/\/map$/)

  const alex = await sessionOf(pageA)
  const sam = await sessionOf(pageB)
  console.log(`CLEANUP trip=${tripId} users=${alex.userId},${sam.userId}`)

  // ── Create and assign: Alex gives Sam a task ──
  await pageA.goto(`${tripPath}/more/tasks/new`)
  const assignee = pageA.getByLabel('Assigned to')
  await expect(assignee.locator('option', { hasText: 'Sam' })).toBeAttached(SYNC)
  await pageA.getByLabel('Task', { exact: true }).fill('Book the airport shuttle')
  await assignee.selectOption({ label: 'Sam' })
  await pageA.getByLabel('Due date').fill('2027-03-12')
  await pageA.getByLabel('Notes').fill('Eight seats')
  await pageA.getByRole('button', { name: 'Save task' }).click()
  await pageA.waitForURL(`**${tripPath}/more/tasks`)

  await pageB.goto(`${tripPath}/more/tasks`)
  const rowB = pageB.getByRole('link', { name: /Book the airport shuttle/ })
  await expect(rowB).toBeVisible(SYNC)
  await expect(rowB).toContainText('Sam (you)')
  await expect(rowB).toContainText('12 Mar 2027')

  // ── Edit and complete on Sam's phone; both converge ──
  await rowB.click()
  await pageB.waitForURL(/\/more\/tasks\/[0-9a-f-]{36}$/)
  const taskId = pageB.url().split('/').pop()!
  await expect(pageB.getByLabel('Notes')).toHaveValue('Eight seats')
  await pageB.getByLabel('Task', { exact: true }).fill('Book the shuttle to Antigua')
  await pageB.getByRole('button', { name: 'Save task' }).click()
  await pageB.waitForURL(`**${tripPath}/more/tasks`)
  await pageB.getByRole('checkbox', { name: 'Mark Book the shuttle to Antigua complete' }).click()
  await expect(pageB.getByRole('heading', { name: 'Completed · 1' })).toBeVisible()

  await expect(pageA.getByRole('link', { name: /Book the shuttle to Antigua/ })).toBeVisible(SYNC)
  await expect(pageA.getByRole('heading', { name: 'Completed · 1' })).toBeVisible(SYNC)

  // ── Reopen on Alex's phone ──
  await pageA.getByRole('checkbox', { name: 'Mark Book the shuttle to Antigua incomplete' }).click()
  await expect(pageA.getByRole('heading', { name: 'To do · 1' })).toBeVisible()
  await expect(pageB.getByRole('heading', { name: 'To do · 1' })).toBeVisible(SYNC)

  // ── Sam loses signal, edits and completes; it syncs on reconnect ──
  await b.setOffline(true)
  await pageB.getByRole('link', { name: /Book the shuttle to Antigua/ }).click()
  await pageB.waitForURL(/\/more\/tasks\/[0-9a-f-]{36}$/)
  await pageB.getByLabel('Task', { exact: true }).fill('Shuttle booked for 6 am')
  await pageB.getByLabel('Assigned to').selectOption({ label: 'Alex' })
  await pageB.getByRole('button', { name: 'Save task' }).click()
  await pageB.waitForURL(`**${tripPath}/more/tasks`)
  await pageB.getByRole('checkbox', { name: 'Mark Shuttle booked for 6 am complete' }).click()
  await expect(pageB.getByRole('heading', { name: 'Completed · 1' })).toBeVisible()
  // Nothing has reached the server while Sam is offline.
  const whileOffline = await rest(alex.token, `trip_tasks?id=eq.${taskId}&select=title,completed`)
  expect(whileOffline.body).toEqual([{ title: 'Book the shuttle to Antigua', completed: false }])
  await expect(pageA.getByRole('heading', { name: 'To do · 1' })).toBeVisible()
  await b.setOffline(false)

  const rowA = pageA.getByRole('link', { name: /Shuttle booked for 6 am/ })
  await expect(rowA).toBeVisible(SYNC)
  await expect(rowA).toContainText('Alex (you)')
  await expect(pageA.getByRole('heading', { name: 'Completed · 1' })).toBeVisible(SYNC)
  if (process.env.SHOTS_DIR) await pageA.screenshot({ path: `${process.env.SHOTS_DIR}/40-tasks-synced.png` })

  // ── A device that never joined the trip can neither read nor change its tasks ──
  const signUp = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: {} }),
  })
  const outsider = await signUp.json() as { access_token: string; user: { id: string } }
  expect(outsider.access_token).toBeTruthy()
  console.log(`CLEANUP outsider=${outsider.user.id}`)

  const read = await rest(outsider.access_token, `trip_tasks?trip_id=eq.${tripId}&select=id`)
  expect(read).toEqual({ status: 200, body: [] })
  const update = await rest(outsider.access_token, `trip_tasks?id=eq.${taskId}`, { method: 'PATCH', body: JSON.stringify({ title: 'Hijacked', completed: false }) })
  expect(update.body).toEqual([])
  const insert = await rest(outsider.access_token, 'trip_tasks', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), trip_id: tripId, title: 'Planted' }) })
  expect(insert.status).toBeGreaterThanOrEqual(400)
  const remove = await rest(outsider.access_token, `trip_tasks?id=eq.${taskId}`, { method: 'DELETE' })
  expect(remove.body).toEqual([])
  const anon = await rest(KEY, `trip_tasks?trip_id=eq.${tripId}&select=id`)
  expect(anon.body).toEqual([])
  // Members cannot hard-delete either, and the row is exactly as the phones left it.
  await rest(sam.token, `trip_tasks?id=eq.${taskId}`, { method: 'DELETE' })
  const after = await rest(sam.token, `trip_tasks?trip_id=eq.${tripId}&select=title,completed,deleted_at`)
  expect(after.body).toEqual([{ title: 'Shuttle booked for 6 am', completed: true, deleted_at: null }])

  // ── Remove: the tombstone reaches the server and the other phone ──
  await rowA.click()
  await pageA.waitForURL(/\/more\/tasks\/[0-9a-f-]{36}$/)
  await pageA.getByRole('button', { name: 'Remove task' }).click()
  await pageA.getByRole('button', { name: 'Confirm change' }).click()
  await pageA.waitForURL(`**${tripPath}/more/tasks`)
  await expect(pageA.getByRole('heading', { name: 'What needs doing?' })).toBeVisible()
  await expect(pageB.getByRole('heading', { name: 'What needs doing?' })).toBeVisible(SYNC)
  await expect.poll(async () => {
    const r = await rest(sam.token, `trip_tasks?id=eq.${taskId}&select=deleted_at`)
    return (r.body as { deleted_at: string | null }[])[0]?.deleted_at ?? null
  }, SYNC).not.toBeNull()

  await a.close()
  await b.close()
})
