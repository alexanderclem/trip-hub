import { expect, test, type Page } from '@playwright/test'

// Live Supabase: two phones share a packing list on a disposable "E2E TEST …" trip.
const SUPABASE_URL = 'https://croqjdvzbpcscdcshnet.supabase.co'
const KEY = 'sb_publishable_FpJvcMvfUFtCO49tcx0tGA_fZUqNroP'
const SYNC = { timeout: 75_000 }
const shots = process.env.SHOTS_DIR

async function sessionOf(page: Page) {
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

test('packing: everyone ticks, claimed gear and personal items sync between two phones', async ({ browser }) => {
  test.setTimeout(480_000)

  const a = await browser.newContext()
  const pageA = await a.newPage()
  await pageA.goto('/')
  await pageA.getByRole('link', { name: 'Create a trip' }).click()
  await pageA.getByLabel('Trip name').fill(`E2E TEST packing ${new Date().toISOString()}`)
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

  // ── Alex starts from the suggestions and adds a personal item ──
  await pageA.goto(`${tripPath}/more`)
  await pageA.getByRole('link', { name: /Packing list/ }).click()
  await pageA.waitForURL(`**${tripPath}/more/packing`)
  await pageA.getByRole('button', { name: 'Add suggested items' }).click()
  await expect(pageA.getByText(/^Added \d+ suggested items/)).toBeVisible()
  await pageA.getByRole('link', { name: 'Add item' }).click()
  await pageA.waitForURL(`**${tripPath}/more/packing/new`)
  await pageA.getByLabel('Item', { exact: true }).fill('Contact lenses')
  await pageA.getByRole('radio', { name: /Just me/ }).check()
  await pageA.getByRole('button', { name: 'Save item' }).click()
  await pageA.waitForURL(`**${tripPath}/more/packing`)
  await expect(pageA.getByRole('link', { name: /Contact lenses/ })).toBeVisible()

  // ── Alex ticks the passport; Sam sees 1/2 and that Alex packed it ──
  await pageA.getByRole('checkbox', { name: 'Packed Passport' }).click()
  await expect(pageA.getByRole('checkbox', { name: 'Packed Passport' })).toBeChecked()
  await pageB.goto(`${tripPath}/more/packing`)
  const passport = pageB.getByRole('listitem').filter({ has: pageB.getByRole('link', { name: /^Passport/ }) })
  await expect(passport.getByRole('button', { name: /1\/2 packed/ })).toBeVisible(SYNC)
  await passport.getByRole('button', { name: /packed, show who/ }).click()
  await expect(passport.getByText('Packed: Alex')).toBeVisible()
  await expect(passport.getByText('Not yet: Sam')).toBeVisible()
  // Alex's personal item isn't on Sam's list.
  await expect(pageB.getByRole('link', { name: /Contact lenses/ })).toHaveCount(0)

  // ── Sam claims the speaker and packs it; Alex sees who's bringing it ──
  const speakerB = pageB.getByRole('listitem').filter({ has: pageB.getByRole('link', { name: /Bluetooth speaker/ }) })
  await speakerB.getByRole('button', { name: 'I’ll bring it' }).click()
  await expect(speakerB.getByRole('checkbox', { name: 'Packed Bluetooth speaker' })).toBeEnabled()
  await speakerB.getByRole('checkbox', { name: 'Packed Bluetooth speaker' }).click()
  await expect(speakerB.getByRole('checkbox', { name: 'Packed Bluetooth speaker' })).toBeChecked()
  await expect(pageA.getByRole('link', { name: /Bluetooth speaker/ })).toContainText('Sam is bringing it · packed', SYNC)
  await expect(pageA.getByRole('listitem').filter({ has: pageA.getByRole('link', { name: /Bluetooth speaker/ }) }).getByRole('checkbox')).toBeDisabled()

  // ── Sam says he doesn't need a plug adapter, offline; it syncs on reconnect ──
  await b.setOffline(true)
  const adapterB = pageB.getByRole('listitem').filter({ has: pageB.getByRole('link', { name: /Plug adapter/ }) })
  await adapterB.getByRole('button', { name: /packed, show who/ }).click()
  await adapterB.getByRole('button', { name: 'I don’t need this' }).click()
  await expect(adapterB.getByRole('link')).toContainText('Not needed')
  await b.setOffline(false)
  const adapterA = pageA.getByRole('listitem').filter({ has: pageA.getByRole('link', { name: /Plug adapter/ }) })
  await expect(adapterA.getByRole('button', { name: /0\/1 packed/ })).toBeVisible(SYNC)

  // ── Alex un-ticks: the tick row stays (state null), it is never deleted ──
  await pageA.getByRole('checkbox', { name: 'Packed Passport' }).click()
  await expect(pageA.getByRole('checkbox', { name: 'Packed Passport' })).not.toBeChecked()
  await expect(passport.getByRole('button', { name: /0\/2 packed/ })).toBeVisible(SYNC)
  const ticks = await rest(sam.token, `packing_checks?trip_id=eq.${tripId}&select=state,deleted_at&order=state.asc.nullsfirst`)
  expect(ticks.body).toEqual([{ state: null, deleted_at: null }, { state: 'skip', deleted_at: null }])

  // ── The server enforces the shapes the app relies on ──
  const bad = await rest(sam.token, 'packing_items', { method: 'POST', body: JSON.stringify({ id: crypto.randomUUID(), trip_id: tripId, title: 'Orphan', kind: 'personal' }) })
  expect(bad.status).toBeGreaterThanOrEqual(400)

  if (shots) {
    await pageA.screenshot({ path: `${shots}/packing-alex.png`, fullPage: true })
    await pageB.screenshot({ path: `${shots}/packing-sam.png`, fullPage: true })
  }
  await a.close()
  await b.close()
})
