import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

/** A small but valid one-page PDF (Helvetica text), so pdf.js has something real to render. */
function makePdf(text: string): Buffer {
  const content = `BT /F1 28 Tf 30 110 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 220] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((o, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

test('tickets: attach a PDF to a flight, it syncs to a second phone, opens with no signal; master download', async ({ browser }) => {
  // ── Alex: trip + a flight on the plan ──
  const a = await browser.newContext()
  const pageA = await a.newPage()
  await pageA.goto('/')
  await pageA.getByRole('link', { name: 'Create a trip' }).click()
  await pageA.getByLabel('Trip name').fill(`E2E TEST tickets ${new Date().toISOString()}`)
  await pageA.getByLabel('Your name').fill('Alex')
  await pageA.getByLabel('Starts').fill('2027-03-13')
  await pageA.getByLabel('Ends').fill('2027-03-21')
  await pageA.getByRole('button', { name: 'Create trip' }).click()
  await expect(pageA.getByRole('heading', { name: 'Invite the group' })).toBeVisible()
  const link = (await pageA.locator('p.font-mono').textContent())!.trim()
  const tripPath = new URL(pageA.url()).pathname.replace(/\/more\/settings$/, '')

  await pageA.goto(`${tripPath}/plan/new?day=2027-03-13`)
  await pageA.getByRole('radio', { name: 'Flight' }).click()
  await pageA.getByLabel('Name').fill('UA 1234 to Guatemala City')
  await pageA.getByLabel('Start time', { exact: true }).fill('07:10')
  await pageA.getByLabel('Confirmation code').fill('K7XQ2P')
  await pageA.getByRole('button', { name: 'Save' }).click()
  await pageA.waitForURL(/\/plan\/[0-9a-f-]{36}$/)

  // ── Attach the boarding pass from the flight's page ──
  await pageA.getByRole('link', { name: 'Add a ticket or confirmation' }).click()
  await expect(pageA.getByLabel('Name')).toHaveValue('UA 1234 to Guatemala City')
  await expect(pageA.getByLabel('Confirmation code')).toHaveValue('K7XQ2P')
  await pageA.getByLabel('Choose file').setInputFiles({ name: 'boarding-pass.pdf', mimeType: 'application/pdf', buffer: makePdf('BOARDING PASS UA1234 K7XQ2P') })
  await pageA.getByRole('button', { name: 'Save ticket' }).click()
  await pageA.waitForURL(/\/tickets\/[0-9a-f-]{36}$/)
  const ticketPath = new URL(pageA.url()).pathname
  await expect(pageA.getByRole('img', { name: /UA 1234 to Guatemala City, page 1 of 1/ })).toBeVisible({ timeout: 30_000 })
  await shot(pageA, '60-ticket-viewer')

  // Uploads in the background → "On this phone" (and no longer "Waiting to upload").
  await pageA.goto(`${tripPath}/tickets`)
  await expect(pageA.getByText('On this phone')).toBeVisible({ timeout: 60_000 })
  await shot(pageA, '61-tickets-wallet')

  // ── Sam joins; the ticket comes down to Sam's phone ──
  const b = await browser.newContext()
  const pageB = await b.newPage()
  await pageB.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await pageB.getByPlaceholder('Your name').fill('Sam')
  await pageB.getByRole('button', { name: 'Add me' }).click()
  await pageB.waitForURL(/\/map$/)
  await pageB.goto(`${tripPath}/tickets`)
  await expect(pageB.getByText('UA 1234 to Guatemala City')).toBeVisible({ timeout: 30_000 })
  await expect(pageB.getByText('On this phone')).toBeVisible({ timeout: 60_000 }) // background download
  await pageB.waitForFunction(async () => (await navigator.serviceWorker.ready) && !!navigator.serviceWorker.controller)

  // ── No signal at all: Sam opens the boarding pass ──
  await b.setOffline(true)
  await pageB.getByRole('link', { name: /UA 1234 to Guatemala City/ }).click()
  await expect(pageB.getByText('K7XQ2P').first()).toBeVisible()
  await expect(pageB.getByRole('img', { name: /page 1 of 1/ })).toBeVisible({ timeout: 30_000 })
  await shot(pageB, '62-ticket-offline')
  await b.setOffline(false)

  // ── Master download on Alex's phone ──
  await pageA.goto(`${tripPath}/more/settings`)
  await pageA.getByRole('button', { name: 'Download everything for offline' }).click()
  const card = pageA.locator('section', { has: pageA.getByRole('heading', { name: 'Ready for offline' }) })
  await expect(card.getByText(/Ready for offline · checked/)).toBeVisible({ timeout: 60_000 })
  await shot(pageA, '63-master-download')
  expect(ticketPath).toContain('/tickets/')

  await a.close()
  await b.close()
})
