import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

async function addPlaceOption(page: Page, name: string) {
  await page.getByLabel('Option').fill(name)
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await page.getByRole('button', { name: new RegExp(`^${escaped}`) }).click()
  await expect(page.getByRole('group', { name: `Your vote for ${name}` })).toBeVisible()
}

async function castVote(page: Page, option: string, score: 'No way' | 'Fine' | 'Want' | 'Must-do') {
  const group = page.getByRole('group', { name: `Your vote for ${option}` })
  await group.getByRole('button', { name: score }).click()
  await expect(group.getByRole('button', { name: score })).toHaveAttribute('aria-pressed', 'true')
}

test('voting and group ratings: two people vote, results rank, winner goes on the plan, ratings sync', async ({ browser }) => {
  // ── Alex creates the trip and a vote ──
  const a = await browser.newContext()
  const pageA = await a.newPage()
  await pageA.goto('/')
  await pageA.getByRole('link', { name: 'Create a trip' }).click()
  await pageA.getByLabel('Trip name').fill(`E2E TEST voting ${new Date().toISOString()}`)
  await pageA.getByLabel('Your name').fill('Alex')
  await pageA.getByRole('button', { name: 'Create trip' }).click()
  await pageA.getByRole('button', { name: /Load Guatemala/ }).click()
  await expect(pageA.getByText(/Added 1301 places/)).toBeVisible()
  const link = (await pageA.locator('p.font-mono').textContent())!.trim()
  const tripPath = new URL(pageA.url()).pathname.replace(/\/more\/settings$/, '')

  await pageA.goto(`${tripPath}/more/vote`)
  await pageA.getByLabel('What are we deciding?').fill('Where do we stay at the lake?')
  await pageA.getByRole('button', { name: 'Create and add options' }).click()
  await pageA.waitForURL(/\/more\/vote\/[0-9a-f-]{36}$/)
  const pollPath = new URL(pageA.url()).pathname

  await addPlaceOption(pageA, 'Casa Atitlan')
  await addPlaceOption(pageA, 'Brothers Guesthouse (correct location)')
  await pageA.getByLabel('Option').fill('Camp on the beach')
  await pageA.getByRole('button', { name: 'Add “Camp on the beach” as a text option' }).click()
  await expect(pageA.getByRole('group', { name: 'Your vote for Camp on the beach' })).toBeVisible()

  await castVote(pageA, 'Casa Atitlan', 'Must-do')
  await castVote(pageA, 'Brothers Guesthouse (correct location)', 'Fine')
  await castVote(pageA, 'Camp on the beach', 'No way')
  // Tapping your current choice clears it, then re-vote.
  await pageA.getByRole('group', { name: 'Your vote for Camp on the beach' }).getByRole('button', { name: 'No way' }).click()
  await expect(pageA.getByRole('tab', { name: 'Vote (2/3)' })).toBeVisible()
  await castVote(pageA, 'Camp on the beach', 'No way')
  await shot(pageA, '30-poll-vote')

  // ── Sam joins and votes ──
  const b = await browser.newContext()
  const pageB = await b.newPage()
  await pageB.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await pageB.getByPlaceholder('Your name').fill('Sam')
  await pageB.getByRole('button', { name: 'Add me' }).click()
  await pageB.waitForURL(/\/map$/)
  await pageB.goto(pollPath)
  await expect(pageB.getByRole('group', { name: 'Your vote for Camp on the beach' })).toBeVisible({ timeout: 30_000 })
  await castVote(pageB, 'Casa Atitlan', 'Want')
  await castVote(pageB, 'Brothers Guesthouse (correct location)', 'Want')
  await castVote(pageB, 'Camp on the beach', 'No way')

  // ── Results (on Alex's phone, once Sam's votes sync) ──
  await pageA.getByRole('tab', { name: 'Results' }).click()
  const results = pageA.locator('ol > li')
  // Usually seconds (realtime poke). While Alex's phone is still uploading the 1,301 imported
  // places it can take until the 60 s periodic pull, so allow for that.
  await expect(results.nth(2)).toContainText('2 × No way', { timeout: 75_000 })
  await expect(results.nth(0)).toContainText('Casa Atitlan')
  await expect(results.nth(0)).toContainText('2.5 avg · 2 of 2 voted')
  await expect(results.nth(1)).toContainText('Brothers Guesthouse')
  await expect(results.nth(2)).toContainText('Camp on the beach')
  await shot(pageA, '31-poll-results')

  // ── Close voting → winner → on the plan ──
  await pageA.getByRole('button', { name: 'Close voting and pick the winner' }).click()
  await expect(pageA.getByText('Decided')).toBeVisible()
  await pageA.getByRole('button', { name: 'Add to the plan' }).click()
  await expect(pageA.getByText('On the plan:')).toBeVisible()
  await expect(pageB.getByText('Decided')).toBeVisible({ timeout: 30_000 })

  // ── Sam rates the winner; Alex sees it ──
  await pageB.getByRole('link', { name: 'Casa Atitlan' }).first().click().catch(async () => {
    await pageB.getByRole('tab', { name: /Vote/ }).click()
    await pageB.getByRole('link', { name: 'Casa Atitlan' }).click()
  })
  await pageB.waitForURL(/\/more\/places\//)
  const placeUrl = new URL(pageB.url()).pathname
  await pageB.getByRole('group', { name: 'Your rating' }).getByRole('button', { name: '4 stars' }).click()
  await pageB.getByLabel('Your note').fill('Great view of the volcanoes')
  await pageB.getByLabel('Your note').blur()
  await expect(pageB.getByLabel(/Group rating 4\.0 out of 5 from 1 person/)).toBeVisible()

  await pageA.goto(placeUrl)
  await expect(pageA.getByText('Great view of the volcanoes')).toBeVisible({ timeout: 30_000 })
  await expect(pageA.getByLabel(/Group rating 4\.0 out of 5/)).toBeVisible()
  await expect(pageA.getByText('Planned', { exact: true }).first()).toBeVisible()
  await shot(pageA, '32-place-rating')

  await a.close()
  await b.close()
})
