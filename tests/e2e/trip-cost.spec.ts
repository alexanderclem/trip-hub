import { expect, test } from '@playwright/test'

// Local-only: seeds IndexedDB and blocks the network.
const trip = '00000000-0000-4000-8000-000000000401'
const [ana, ben] = ['00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000403']
const shots = process.env.SHOTS_DIR ?? 'test-results'

test('money: what the trip costs me, from logged expenses and plan estimates', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/inspire')
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  await page.evaluate(async ({ trip, ana, ben }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const tx = db.transaction(['trips', 'members', 'itinerary_items', 'expenses'], 'readwrite')
    const common = { trip_id: trip, deleted_at: null }
    tx.objectStore('trips').put({ id: trip, name: 'E2E TEST cost', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-16', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only', settings: {}, deleted_at: null })
    for (const [id, name] of [[ana, 'Ana'], [ben, 'Ben']]) tx.objectStore('members').put({ ...common, id, display_name: name, color: null, avatar_emoji: null, home_timezone: null })
    const item = { ...common, to_place_id: null, place_id: null, all_day: false, start_tz: 'America/Guatemala', end_tz: null, end_local: null, end_at: null, status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null }
    tx.objectStore('itinerary_items').put({ ...item, id: 'volcano', title: 'Acatenango overnight hike', kind: 'activity', start_local: '2027-03-14T07:00', start_at: '2027-03-14T13:00:00Z', est_cost_minor: 20000, est_cost_currency: 'USD' })
    tx.objectStore('itinerary_items').put({ ...item, id: 'cooking', title: 'Cooking class', kind: 'activity', start_local: '2027-03-15T17:00', start_at: '2027-03-15T23:00:00Z', est_cost_minor: 0, est_cost_currency: null })
    tx.objectStore('expenses').put({ ...common, id: 'e1', description: 'Shuttle from the airport', category: 'transport', spent_on: '2027-03-13', amount_minor: 6000, currency: 'USD', fx_rate: 1, fx_source: 'same', fx_as_of: null, base_currency: 'USD', base_amount_minor: 6000, payers: [{ member_id: ana, amount_minor: 6000 }], split_method: 'equal', split: [{ member_id: ana, value: 0 }, { member_id: ben, value: 0 }], place_id: null, item_id: null, notes: null })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: ana, joinedAt: '2027-03-01T12:00:00Z' } }, quizSeen: true, moneyView: 'base' }, version: 1 }))
  }, { trip, ana, ben })

  await page.goto(`/t/${trip}/money`)
  const card = page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'What this trip costs you' }) }).last()
  await expect(card.getByText('Spent so far')).toBeVisible()
  await expect(card).toContainText('$30.00') // half the shuttle
  await expect(card).toContainText('≈ $100.00') // half the hike estimate
  await expect(card).toContainText('≈ $130.00')
  await expect(card.getByText(/1 of your plans has no cost estimate/)).toBeVisible()
  await card.getByRole('button', { name: /Show 1 planned cost/ }).click()
  await expect(card.getByRole('link', { name: /Acatenango overnight hike/ })).toContainText('$200.00 ÷ 2')
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await card.screenshot({ path: `${shots}/trip-cost-${width}.png` })
  }
})
