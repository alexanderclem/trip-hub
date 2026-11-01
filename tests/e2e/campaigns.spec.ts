import { expect, test, type Page } from '@playwright/test'

// Phase 2c campaigns with no live services: the composer (stubbed RPCs; sending switched off) and the
// one-tap unsubscribe page.
const shots = process.env.SHOTS_DIR ?? 'test-results'

async function shoot(page: Page, name: string) {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${shots}/${name}-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
}

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

test('an organizer writes a campaign, sees who it reaches, and queues it while sending is off', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort())
  await page.route('**/rest/v1/rpc/my_organizer', (r) => r.fulfill(json({ id: 'org', display_name: 'Ana Trips', support_email: 'ana@example.com', slug: 'ana', reviewed: true, pro: true, beta: true, postal_address: '12 Main St, Austin, TX 78701', campaign_sending: false })))
  let saved = 0
  await page.route('**/rest/v1/campaigns*', (r) => r.fulfill(json(saved ? [{ id: 'c1', subject: 'Back to the lake', body: 'x', audience: {}, status: 'queued', recipients: 2, queued_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' }] : [])))
  await page.route('**/rest/v1/trip_offers*', (r) => r.fulfill(json([{ trip_id: 't1', title: 'Lake week' }])))
  await page.route('**/rest/v1/organizer_contacts*', (r) => r.fulfill(json([{ id: 'k', email: 'kim@example.com', name: 'Kim', trips: 1, total_paid_minor: 0, last_trip_on: null, tags: ['vip'], notes: '', marketing_consent: true, unsubscribed_at: null }])))
  await page.route('**/rest/v1/rpc/campaign_audience', async (r) => {
    const a = r.request().postDataJSON().p_audience as { trip_ids: string[] }
    await r.fulfill(json(a.trip_ids.length ? { count: 1, first: [{ name: 'Ola', email: 'ola@example.com' }] } : { count: 2, first: [{ name: 'Kim', email: 'kim@example.com' }, { name: 'Ola', email: 'ola@example.com' }] }))
  })
  await page.route('**/rest/v1/rpc/save_campaign', (r) => { saved++; return r.fulfill(json({ id: 'c1' })) })
  await page.route('**/rest/v1/rpc/send_campaign_test', (r) => r.fulfill(json(null)))
  await page.route('**/rest/v1/rpc/queue_campaign', (r) => r.fulfill(json(2)))
  await page.goto('/organize/campaigns')
  await expect(page.getByRole('note')).toContainText('Sending turns on once Stowaway sets up its campaign sender')
  await page.getByRole('button', { name: 'Write a campaign' }).click()
  await page.getByLabel('Subject').fill('Back to the lake')
  await page.getByLabel('Message').fill('Same week next year? Early places are $100 off.')
  await expect(page.getByText('2 people who agreed to hear from you')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Lake week' }).check()
  await expect(page.getByText('1 person who agreed to hear from you')).toBeVisible()
  await page.getByRole('button', { name: 'Send me a test' }).click()
  await expect(page.getByText('A test copy is on its way to your support email.')).toBeVisible()
  await shoot(page, 'campaign-composer')
  await page.getByRole('button', { name: 'Queue for 1' }).click()
  await expect(page.getByText('Queued for 2')).toBeVisible()
  await shoot(page, 'campaign-list')
})

test('unsubscribing takes one tap and says what still arrives', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort())
  await page.route('**/rest/v1/rpc/unsubscribe', (r) => r.fulfill(json({ organizer: 'Ana Trips' })))
  await page.goto('/unsubscribe#t=abc123')
  await expect(page.getByRole('heading', { level: 1, name: 'Stop trip emails' })).toBeVisible()
  await shoot(page, 'unsubscribe')
  await page.getByRole('button', { name: 'Unsubscribe' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'You’re unsubscribed' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText(/Ana Trips won’t email you about future trips any more\./)
})
