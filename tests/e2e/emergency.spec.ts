import { expect, test, type Page } from '@playwright/test'

const SUPABASE_URL = 'https://croqjdvzbpcscdcshnet.supabase.co'
const KEY = 'sb_publishable_FpJvcMvfUFtCO49tcx0tGA_fZUqNroP'
const SYNC = { timeout: 75_000 }
const shots = process.env.SHOTS_DIR ?? 'test-results'

async function sessionOf(page: Page) {
  return await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))!
    const s = JSON.parse(localStorage.getItem(key)!) as { access_token: string; user: { id: string } }
    return { token: s.access_token, userId: s.user.id }
  })
}

// Live Supabase: cards are shared with the trip, readable offline, and only their owner can write them.
test('emergency cards sync to the group and only their owner can change them', async ({ browser }) => {
  test.setTimeout(300_000)
  const a = await browser.newContext()
  const pageA = await a.newPage()
  await pageA.goto('/')
  await pageA.getByRole('link', { name: 'Create a trip' }).click()
  await pageA.getByLabel('Trip name').fill(`E2E TEST emergency ${new Date().toISOString()}`)
  await pageA.getByLabel('Your name').fill('Ana')
  await pageA.getByRole('button', { name: 'Create trip' }).click()
  await pageA.waitForURL(/\/more\/settings$/)
  const link = (await pageA.locator('p.font-mono').textContent())!.trim()
  const tripPath = new URL(pageA.url()).pathname.replace(/\/more\/settings$/, '')
  const tripId = tripPath.split('/').pop()!

  const b = await browser.newContext()
  const pageB = await b.newPage()
  await pageB.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await pageB.getByPlaceholder('Your name').fill('Ben')
  await pageB.getByRole('button', { name: 'Add me' }).click()
  await pageB.waitForURL(/\/map$/)
  const ana = await sessionOf(pageA)
  const ben = await sessionOf(pageB)
  console.log(`CLEANUP trip=${tripId} users=${ana.userId},${ben.userId}`)

  // Ana fills in her card and the trip's numbers.
  await pageA.goto(`${tripPath}/more`)
  await pageA.getByRole('link', { name: /Emergency info/ }).click()
  await pageA.waitForURL(`**${tripPath}/more/emergency`)
  await pageA.getByRole('link', { name: 'Fill in' }).click()
  await pageA.waitForURL(`**${tripPath}/more/emergency/edit`)
  await pageA.getByLabel('Name', { exact: true }).fill('Maria')
  await pageA.getByLabel('Relationship').fill('Mom')
  await pageA.getByLabel('Phone', { exact: true }).fill('+1 555 123 4567')
  await pageA.getByLabel('Allergies').fill('Penicillin')
  await pageA.getByRole('button', { name: 'Save my card' }).click()
  await pageA.waitForURL(`**${tripPath}/more/emergency`)
  await pageA.getByRole('link', { name: 'Edit' }).first().click()
  await pageA.waitForURL(`**${tripPath}/more/emergency/numbers`)
  await pageA.getByLabel('Number 1 name').fill('Police')
  await pageA.getByLabel('Number 1 phone').fill('110')
  await pageA.getByRole('button', { name: 'Save for everyone' }).click()
  await pageA.waitForURL(`**${tripPath}/more/emergency`)

  // Ben sees both, then loses signal and still sees them.
  await pageB.goto(`${tripPath}/more/emergency`)
  const anaCard = pageB.getByRole('listitem').filter({ has: pageB.getByRole('heading', { name: 'Ana' }) })
  await expect(anaCard).toContainText('Maria (Mom)', SYNC)
  await expect(anaCard).toContainText('Penicillin')
  await expect(pageB.getByRole('link', { name: /Police/ })).toHaveAttribute('href', 'tel:110', SYNC)
  await expect(anaCard.getByRole('link', { name: /Edit|Fill in/ })).toHaveCount(0)
  await b.setOffline(true)
  await pageB.reload()
  await expect(pageB.getByRole('listitem').filter({ has: pageB.getByRole('heading', { name: 'Ana' }) })).toContainText('Penicillin')
  await pageB.screenshot({ path: `${shots}/emergency-ben-offline.png`, fullPage: true })
  await b.setOffline(false)

  // The server refuses Ben writing Ana's card.
  const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/member_safety?trip_id=eq.${tripId}&select=id,member_id`, { headers: { apikey: KEY, Authorization: `Bearer ${ben.token}` } })).json() as { id: string; member_id: string }[]
  expect(rows).toHaveLength(1)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/member_safety?id=eq.${rows[0]!.id}`, {
    method: 'PATCH', headers: { apikey: KEY, Authorization: `Bearer ${ben.token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ allergies: 'None' }),
  })
  expect(await res.json()).toEqual([])
  const after = await (await fetch(`${SUPABASE_URL}/rest/v1/member_safety?id=eq.${rows[0]!.id}&select=allergies`, { headers: { apikey: KEY, Authorization: `Bearer ${ben.token}` } })).json()
  expect(after).toEqual([{ allergies: 'Penicillin' }])
  await a.close()
  await b.close()
})

// Local-only: "Show the driver" and the medical card, from seeded data with no network.
test('show the driver and my medical card work offline', async ({ page }) => {
  const trip = '00000000-0000-4000-8000-000000000501'
  const ana = '00000000-0000-4000-8000-000000000502'
  await page.route('https://**/*', (route) => route.abort())
  await page.clock.install({ time: new Date('2027-03-14T22:00:00Z') })
  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  await page.evaluate(async ({ trip, ana }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction(['trips', 'members', 'places', 'itinerary_items', 'member_safety'], 'readwrite')
    const common = { trip_id: trip, deleted_at: null }
    tx.objectStore('trips').put({ id: trip, name: 'E2E TEST driver', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-16', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only', settings: {}, deleted_at: null })
    tx.objectStore('members').put({ ...common, id: ana, display_name: 'Ana', color: null, avatar_emoji: null, home_timezone: null })
    tx.objectStore('places').put({ ...common, id: 'casa', name: 'Casa Santo Domingo', category: 'lodging', tags: [], lat: 14.5585, lng: -90.7276, address: '3a Calle Oriente 28', area: 'Antigua Guatemala', status: 'booked', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' })
    tx.objectStore('itinerary_items').put({ ...common, id: 'stay', title: 'Casa Santo Domingo', kind: 'lodging', place_id: 'casa', to_place_id: null, all_day: false, start_local: '2027-03-13T15:00', start_tz: 'America/Guatemala', end_local: '2027-03-16T11:00', end_tz: 'America/Guatemala', start_at: '2027-03-13T21:00:00Z', end_at: '2027-03-16T17:00:00Z', status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null })
    tx.objectStore('member_safety').put({ ...common, id: 'safety', member_id: ana, emergency_name: 'Maria', emergency_relation: 'Mom', emergency_phone: '+1 555 123 4567', allergies: 'Penicillin', medical: null, blood_type: 'O+', insurance_provider: null, insurance_policy: null, insurance_phone: null, notes: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: ana, joinedAt: '2027-03-01T12:00:00Z' } }, quizSeen: true }, version: 1 }))
  }, { trip, ana })

  await page.goto(`/t/${trip}/more/emergency`)
  await page.getByRole('link', { name: 'Show the driver' }).click()
  const driver = page.getByRole('dialog', { name: 'Show the driver' })
  await expect(driver.getByText('Staying tonight')).toBeVisible()
  await expect(driver.getByText('Casa Santo Domingo')).toBeVisible()
  await expect(driver.getByText('3a Calle Oriente 28')).toBeVisible()
  await page.screenshot({ path: `${shots}/emergency-driver.png` })
  await driver.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('link', { name: 'My medical card' }).click()
  const card = page.getByRole('dialog', { name: 'My medical card' })
  await expect(card.getByText('Penicillin')).toBeVisible()
  await expect(card.getByRole('link', { name: 'Call Maria' })).toHaveAttribute('href', 'tel:+15551234567')
  await page.screenshot({ path: `${shots}/emergency-medical.png` })
})
