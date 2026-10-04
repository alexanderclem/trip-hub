import { expect, test } from '@playwright/test'

// Local-only: seeded trip, no network.
const trip = '00000000-0000-4000-8000-000000000701'
const [ana, ben] = ['00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000703']
const shots = process.env.SHOTS_DIR ?? 'test-results'

test('trip recap: story slides with the group’s numbers, tap to move, share as a picture', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort())
  await page.clock.install({ time: new Date('2027-03-20T18:00:00Z') })
  await page.goto('/inspire')
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  await page.evaluate(async ({ trip, ana, ben }) => {
    const request = indexedDB.open('trip-hub')
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const stores = ['trips', 'members', 'places', 'itinerary_items', 'place_ratings', 'polls', 'poll_options', 'poll_votes', 'expenses']
    const tx = db.transaction(stores, 'readwrite')
    const c = { trip_id: trip, deleted_at: null }
    tx.objectStore('trips').put({ id: trip, name: 'Guatemala SB 27', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-20', base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only', settings: {}, deleted_at: null })
    for (const [id, name] of [[ana, 'Ana'], [ben, 'Ben']]) tx.objectStore('members').put({ ...c, id, display_name: name, color: null, avatar_emoji: null, home_timezone: null })
    const places: [string, string, number, number][] = [['cafe', 'Café Sky', 14.556, -90.733], ['volcano', 'Pacaya', 14.38, -90.6], ['lake', 'San Marcos', 14.725, -91.26]]
    for (const [id, name, lat, lng] of places) tx.objectStore('places').put({ ...c, id, name, category: id === 'cafe' ? 'food' : 'activity', tags: [], lat, lng, address: null, area: null, status: 'visited', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual', created_by: ana })
    const item = { ...c, kind: 'activity', to_place_id: null, all_day: false, start_tz: 'America/Guatemala', end_local: null, end_tz: null, end_at: null, status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null, created_by: ben }
    ;[['i1', 'cafe', '2027-03-14T09:00', '2027-03-14T15:00:00Z'], ['i2', 'volcano', '2027-03-15T06:00', '2027-03-15T12:00:00Z'], ['i3', 'lake', '2027-03-17T10:00', '2027-03-17T16:00:00Z']]
      .forEach(([id, place, local, at]) => tx.objectStore('itinerary_items').put({ ...item, id, title: id, place_id: place, start_local: local, start_at: at }))
    ;[['cafe', ana, 5], ['cafe', ben, 5], ['volcano', ana, 5], ['volcano', ben, 2]].forEach(([p, m, s]) => tx.objectStore('place_ratings').put({ ...c, id: `${p}${m}`, place_id: p, member_id: m, stars: s, note: null }))
    tx.objectStore('polls').put({ ...c, id: 'poll', title: 'Volcano day', description: null, status: 'closed', winner_option_id: null })
    ;['Pacaya', 'Acatenango'].forEach((l) => tx.objectStore('poll_options').put({ ...c, id: l, poll_id: 'poll', label: l, place_id: null, url: null, description: null }))
    ;[['Pacaya', ana, 3], ['Pacaya', ben, 3], ['Acatenango', ana, 2], ['Acatenango', ben, 3]].forEach(([o, m, s]) => tx.objectStore('poll_votes').put({ ...c, id: `${o}${m}`, poll_id: 'poll', option_id: o, member_id: m, score: s }))
    const exp = (id: string, desc: string, cat: string, amount: number, payer: string) => tx.objectStore('expenses').put({ ...c, id, description: desc, category: cat, spent_on: '2027-03-15', amount_minor: amount, currency: 'USD', fx_rate: 1, fx_source: 'same', fx_as_of: null, base_currency: 'USD', base_amount_minor: amount, payers: [{ member_id: payer, amount_minor: amount }], split_method: 'equal', split: [{ member_id: ana, value: 0 }, { member_id: ben, value: 0 }], place_id: null, item_id: null, notes: null, created_by: payer })
    exp('e1', 'Volcano tour', 'activities', 12000, ana)
    exp('e2', 'Dinner at Café Sky', 'food', 8000, ben)
    exp('e3', 'Lancha', 'transport', 2000, ana)
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    db.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [trip]: { tripId: trip, memberId: ana, joinedAt: '2027-03-01T12:00:00Z' } }, quizSeen: true }, version: 1 }))
  }, { trip, ana, ben })

  await page.emulateMedia({ reducedMotion: 'reduce' }) // no auto-advance or count-up: steady screenshots
  await page.goto(`/t/${trip}/wrapped`)
  const recap = page.getByRole('dialog', { name: 'Trip recap' })
  await expect(recap.getByRole('heading', { name: 'Guatemala SB 27' })).toBeVisible()
  await expect(recap).toContainText('Your trip, wrapped')
  await expect(recap).toContainText('8 days · 2 travellers')
  await page.screenshot({ path: `${shots}/wrapped-1-intro.png` })

  const next = async () => recap.locator('section[aria-roledescription="slide"]').click({ position: { x: 300, y: 40 } })
  await next()
  await expect(recap).toContainText('Together you covered')
  await expect(recap.getByRole('heading')).toContainText('km')
  await next()
  await expect(recap).toContainText('3 places')
  await next()
  await expect(recap).toContainText('The group’s favourite')
  await expect(recap.getByRole('heading', { name: 'Café Sky' })).toBeVisible()
  await expect(recap).toContainText('Most divisive: Pacaya')
  await page.screenshot({ path: `${shots}/wrapped-4-favourite.png` })
  await next()
  await expect(recap).toContainText('4 votes')
  await expect(recap).toContainText('Closest call: Pacaya edged out Acatenango')
  await next()
  await expect(recap.getByRole('heading', { name: '$220.00' })).toBeVisible()
  await expect(recap).toContainText('Ana paid the most up front: $140.00')
  await page.screenshot({ path: `${shots}/wrapped-6-money.png` })
  await next()
  await expect(recap).toContainText('Your trip')
  await expect(recap.getByRole('heading', { name: '$110.00' })).toBeVisible()

  // Back with a tap on the left.
  await recap.locator('section[aria-roledescription="slide"]').click({ position: { x: 5, y: 40 } })
  await expect(recap.getByRole('heading', { name: '$220.00' })).toBeVisible()

  // Share falls back to a download where files can't be shared.
  const download = page.waitForEvent('download')
  await recap.getByRole('button', { name: 'Share this slide' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('guatemala-sb-27-money.png')
  await file.saveAs(`${shots}/wrapped-share-money.png`)

  for (let i = 0; i < 3; i++) await next()
  await expect(recap).toContainText('Same again?')
  await expect(recap.getByLabel('Add the group’s shared photo album link')).toBeVisible()
  await page.screenshot({ path: `${shots}/wrapped-9-outro.png` })
  await recap.getByRole('button', { name: 'Close recap' }).click()
})
