// Real service-worker upgrade, served from two immutable builds on the same local origin.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
let root = resolve(process.env.BASELINE_DIST ?? '/tmp/stowaway-polish-baseline/dist')
const finalRoot = resolve('dist')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' }
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname
  const file = resolve(root, '.' + (pathname === '/' || !extname(pathname) ? '/index.html' : pathname))
  if (!file.startsWith(root + '/')) { res.writeHead(400); return res.end() }
  try {
    const data = await readFile(file)
    res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.end(data)
  } catch { res.writeHead(404); res.end('Not found') }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch()
try {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.route(url => url.protocol === 'https:', route => route.abort())
  console.log("Loading baseline app")
  await page.goto(`${origin}/app`)
  await page.getByRole('heading', { name: 'Have an invite?' }).waitFor()
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready) && !!navigator.serviceWorker.controller)
  console.log("Baseline worker controls app")
  const oldEntry = await page.locator('script[type=module]').getAttribute('src')
  // Keep a sentinel to prove the update preserves local traveler data.
  await page.evaluate(() => localStorage.setItem('polish-update-sentinel', 'kept'))
  root = finalRoot
  console.log("Switching server to final build")
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    const changed = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Worker did not activate within 30s')), 30000)
      navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timer); resolve(true) }, { once: true })
    })
    await registration.update()
    await changed
  }).catch(error => { if (!/Execution context was destroyed/.test(error.message)) throw error })
  // Workbox may automatically reload; explicitly reload also verifies navigation against the new cache.
  console.log("Worker upgrade observed; checking reload")
  await page.reload()
  await page.getByRole('heading', { name: 'Have an invite?' }).waitFor()
  assert.notEqual(await page.locator('script[type=module]').getAttribute('src'), oldEntry)
  assert.equal(await page.evaluate(() => localStorage.getItem('polish-update-sentinel')), 'kept')
  await context.setOffline(true)
  await page.goto(origin)
  await page.getByRole('button', { name: 'Day 3', exact: true }).click()
  await page.getByRole('heading', { name: 'Walk the Brooklyn Bridge' }).waitFor()
  console.log('PASS: old worker upgraded to final build, entry changed, local state survived, and new preview works after offline navigation.')
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
