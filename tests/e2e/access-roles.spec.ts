import { expect, test, type Page } from '@playwright/test'

// Local-only fixtures: the phone is offline, every network request is refused, and the trip and the
// phone's role are written straight into IndexedDB and the device store. Nothing reaches Supabase.
const trip = '00000000-0000-4000-8000-000000000201'
const ana = '00000000-0000-4000-8000-000000000202'
const ben = '00000000-0000-4000-8000-000000000203'
const base = `/t/${trip}`
const shots = process.env.SHOTS_DIR ?? 'test-results'

type Role = 'owner' | 'member' | 'traveler' | 'pending'
interface Setup { me: string; role: Role; mode: 'group' | 'hosted'; removed?: boolean; organized?: boolean; canRemove?: boolean }

async function seed(page: Page, s: Setup) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }))
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/inspire/manual') // opens the local database, so the stores below exist
  await expect(page.getByRole('heading', { name: 'Trip ideas', level: 1 })).toBeVisible()
  await page.evaluate(async ({ trip, ana, ben, s }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction(['trips', 'members'], 'readwrite')
    tx.objectStore('trips').put({ id: trip, name: 'E2E TEST roles', timezone: 'America/Guatemala', start_date: '2027-03-15', end_date: '2027-03-18', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only-token', settings: {}, created_by: ana, access_mode: s.mode, access_epoch: 0 })
    for (const [id, name] of [[ana, 'Ana'], [ben, 'Ben']]) tx.objectStore('members').put({ id, trip_id: trip, deleted_at: null, display_name: name, color: null, avatar_emoji: null, home_timezone: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    const access = { role: s.removed ? null : s.role, mode: s.mode, epoch: 0, removed: !!s.removed, canRemove: !!s.canRemove, organized: !!s.organized, removedMembers: [] }
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: s.me, joinedAt: '2027-03-01T12:00:00Z' } }, access: { [trip]: access }, quizSeen: true, timeView: 'trip', basemap: 'offline', moneyView: 'base' }, version: 1 }))
  }, { trip, ana, ben, s })
}

/** The app scrolls inside its own container, so the People card is captured on its own. */
async function shootPeople(page: Page, name: string) {
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: /^People/ }) })
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await card.scrollIntoViewIfNeeded()
    await card.screenshot({ path: `${shots}/roles-${name}-people-${width}.png` })
  }
  await page.setViewportSize({ width: 390, height: 844 })
}

async function shoot(page: Page, name: string) {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${shots}/roles-${name}-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
}

test('a group trip looks as before, and its creator can remove people', async ({ page }) => {
  await seed(page, { me: ana, role: 'member', mode: 'group', canRemove: true })
  await page.goto(`${base}/more/settings`)
  await expect(page.getByRole('button', { name: 'Remove Ben' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Ana' })).toHaveCount(0)
  await expect(page.getByText('Anyone with this link can see and edit the whole trip')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Organize this trip' })).toBeVisible()
  await shoot(page, 'group-creator-settings')
  await shootPeople(page, 'group-creator')
  await page.goto(`${base}/plan`)
  await expect(page.getByRole('link', { name: 'Add to this day' })).toBeVisible()
})

test('a group trip member who did not create it sees no remove buttons', async ({ page }) => {
  await seed(page, { me: ben, role: 'member', mode: 'group' })
  await page.goto(`${base}/more/settings`)
  await expect(page.getByRole('heading', { name: /People/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Remove (Ana|Ben)$/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Organize this trip' })).toHaveCount(0)
})

test('a hosted traveler cannot add to the plan but can add their own expenses and tickets', async ({ page }) => {
  await seed(page, { me: ben, role: 'traveler', mode: 'hosted', organized: true })
  await page.goto(`${base}/plan`)
  await expect(page.getByRole('heading', { name: 'Know what’s next' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add to this day' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('link', { name: /Add an expense/ })).toBeVisible()
  await expect(dialog.getByRole('link', { name: /Add a ticket/ })).toBeVisible()
  await expect(dialog.getByRole('link', { name: /Add to plan/ })).toHaveCount(0)
  await expect(dialog.getByRole('link', { name: /Save a place/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.goto(`${base}/more/settings`)
  await expect(page.getByText('People who open this link ask to join')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Replace link' })).toHaveCount(0)
  await shoot(page, 'hosted-traveler-settings')
})

test('a hosted organizer chooses who can change the plan', async ({ page }) => {
  await seed(page, { me: ana, role: 'owner', mode: 'hosted', organized: true, canRemove: true })
  await page.goto(`${base}/more/settings`)
  const group = page.getByRole('radiogroup', { name: 'Who can change the plan' })
  await expect(group.getByRole('radio', { name: 'Organizers' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: 'Remove Ben' })).toBeVisible()
  await shoot(page, 'hosted-owner-settings')
  await shootPeople(page, 'hosted-owner')
})

test('someone waiting for approval sees a waiting page, not the trip', async ({ page }) => {
  await seed(page, { me: ben, role: 'pending', mode: 'hosted', organized: true })
  await page.goto(`${base}/overview`)
  await expect(page.getByRole('heading', { name: 'Waiting to join E2E TEST roles' })).toBeVisible()
  await shoot(page, 'pending')
})

test('someone who was removed is told so and can leave the trip behind', async ({ page }) => {
  await seed(page, { me: ben, role: 'traveler', mode: 'group', removed: true })
  await page.goto(`${base}/plan`)
  await expect(page.getByRole('heading', { name: 'You were removed from this trip' })).toBeVisible()
  await shoot(page, 'removed')
  await page.getByRole('button', { name: 'Back to my trips' }).click()
  await page.waitForURL('**/app')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('trip-hub-device')!).state.trips)).toEqual({})
})
