// Run after npm run build. Local-only regression: no trip or backend writes.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const root = resolve('dist')
const html = await readFile(resolve(root, 'index.html'))
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname)
  if (!path.startsWith(root + '/')) {
    res.setHeader('Content-Type', 'text/html')
    return res.end(html)
  }
  try {
    const data = await readFile(path)
    res.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream')
    res.end(data)
  } catch {
    res.setHeader('Content-Type', 'text/html')
    res.end(html)
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
let browser
try {
  browser = await chromium.launch()
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const page = await context.newPage()
  // Reproduce a deployment removing the chunk requested by an older page.
  await page.route('**/assets/MapScreen-*.js', route => route.fulfill({ contentType: 'text/html', body: html }))
  await page.goto(`${origin}/t/asset-recovery-check/map`)
  await page.getByRole('heading', { name: 'The app needs a refresh' }).waitFor()
  assert.equal(await page.getByText('Unexpected Application Error!').count(), 0)
  await page.unroute('**/assets/MapScreen-*.js')
  await page.getByRole('button', { name: 'Reload app' }).click()
  // With the real chunk restored, the unjoined trip redirects home normally.
  await page.getByRole('heading', { name: 'Your trips', exact: true }).waitFor()
  console.log('PASS: HTML instead of map JavaScript shows recovery; reload loads the valid chunk and restores routing.')
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
