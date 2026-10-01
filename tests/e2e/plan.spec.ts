import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

interface ItemSpec {
  day: string
  kind: 'Activity' | 'Meal' | 'Flight' | 'Transport' | 'Stay'
  name?: string
  place?: string
  start: string
  endDay?: string
  end?: string
  startTz?: string
  endTz?: string
  code?: string
}

async function addItem(page: Page, tripPath: string, s: ItemSpec) {
  await page.goto(`${tripPath}/plan/new?day=${s.day}`)
  await page.getByRole('radio', { name: s.kind }).click()
  if (s.place) {
    await page.getByLabel(s.kind === 'Flight' || s.kind === 'Transport' ? 'From place' : 'Place').fill(s.place)
    await page.getByRole('button', { name: new RegExp(`^${s.place}`) }).click()
  }
  if (s.name) await page.getByLabel('Name').fill(s.name)
  await page.getByLabel('Start time', { exact: true }).fill(s.start)
  if (s.startTz) await page.getByLabel('Start time zone').selectOption(s.startTz)
  if (s.endDay) await page.getByLabel('End date').fill(s.endDay)
  if (s.end) await page.getByLabel('End time', { exact: true }).fill(s.end)
  if (s.endTz) await page.getByLabel('End time zone').selectOption(s.endTz)
  if (s.code) await page.getByLabel('Confirmation code').fill(s.code)
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/)
}

// The phone is in New York, so "my phone's time" differs from Guatemala time.
test.use({ timezoneId: 'America/New_York' })

test('itinerary: cross-zone flight, stays, overlaps, local/destination time toggle, day route on the map', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Create a trip' }).click()
  await page.getByLabel('Trip name').fill(`E2E TEST plan ${new Date().toISOString()}`)
  await page.getByLabel('Your name').fill('Alex')
  await page.getByLabel('Starts').fill('2027-03-13')
  await page.getByLabel('Ends').fill('2027-03-21')
  await page.getByRole('button', { name: 'Create trip' }).click()
  await page.getByRole('button', { name: /Load Guatemala/ }).click()
  await expect(page.getByText(/Added 1301 places/)).toBeVisible()
  const tripPath = new URL(page.url()).pathname.replace(/\/more\/settings$/, '')

  // Flight in: departs Chicago 07:10 local, lands Guatemala City 11:05 local.
  await addItem(page, tripPath, {
    day: '2027-03-13', kind: 'Flight', name: 'UA 1234 to Guatemala City', start: '07:10', end: '11:05',
    startTz: 'America/Chicago', endTz: 'America/Guatemala', code: 'K7XQ2P',
  })
  await expect(page.getByText('07:10 → 11:05')).toBeVisible()
  await expect(page.getByText('Chicago time → Guatemala time')).toBeVisible()
  await expect(page.getByText('K7XQ2P')).toBeVisible()
  await shot(page, '40-flight-detail')

  // Monday 15 March in Antigua.
  await addItem(page, tripPath, { day: '2027-03-15', kind: 'Stay', place: 'Antigua Inn', start: '15:00', endDay: '2027-03-17', end: '11:00' })
  await addItem(page, tripPath, { day: '2027-03-15', kind: 'Activity', name: 'Volcano hike', start: '05:00', end: '12:00' })
  await addItem(page, tripPath, { day: '2027-03-15', kind: 'Activity', name: 'Coffee tour', start: '10:00', end: '13:00' })
  await addItem(page, tripPath, { day: '2027-03-15', kind: 'Meal', place: '12 Onzas', start: '13:30', end: '14:30' })
  await addItem(page, tripPath, { day: '2027-03-15', kind: 'Meal', place: 'Antigua House Bed & Food', name: 'Dinner', start: '19:00', end: '20:30' })

  await page.goto(`${tripPath}/plan?day=2027-03-15`)
  await expect(page.getByText('Staying at Antigua Inn')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('2 items overlap')
  const volcano = page.getByRole('link', { name: /^Volcano hike, 05:00–12:00/ })
  await expect(volcano).toBeVisible()
  await expect(page.getByRole('link', { name: /^Coffee tour.*overlaps another item/ })).toBeVisible()
  await shot(page, '41-plan-day')

  // Show times on the phone's clock (New York, EDT after 14 March): +2 hours.
  await page.getByRole('radio', { name: /My phone/ }).click()
  await expect(page.getByRole('link', { name: /^Volcano hike, 07:00–14:00/ })).toBeVisible()
  await page.getByRole('radio', { name: /Guatemala time/ }).click()
  await expect(volcano).toBeVisible()

  // The stay shows on the 16th but not on check-out day.
  await page.getByRole('tab', { name: /Tuesday 16 March/ }).click()
  await expect(page.getByText('Staying at Antigua Inn')).toBeVisible()
  await page.getByRole('tab', { name: /Wednesday 17 March/ }).click()
  await expect(page.getByText('Staying at Antigua Inn')).toHaveCount(0)

  // Places put on the plan are marked planned.
  await page.goto(`${tripPath}/more/places`)
  await page.getByPlaceholder('Search places').fill('12 Onzas')
  await expect(page.getByRole('link', { name: /12 Onzas/ })).toContainText('Planned')

  // The day on the map: numbered stops joined by a route.
  await page.goto(`${tripPath}/plan?day=2027-03-15`)
  await page.getByRole('link', { name: 'On map' }).click()
  await expect(page.getByText(/Mon 15 Mar · 2 stops/)).toBeVisible()
  await page.waitForTimeout(3500)
  await shot(page, '42-day-on-map')
})
