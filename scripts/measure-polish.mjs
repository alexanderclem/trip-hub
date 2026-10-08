// Reproducible local lab profile; not field Web Vitals. Run against a production preview.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const label = process.argv[2] ?? 'baseline'
const origin = process.env.BASE_URL ?? 'http://127.0.0.1:4176'
const browser = await chromium.launch()
const results = []
await mkdir('.design/screenshots/polish', { recursive: true })
async function measure(context, page, name) {
  const requests = []
  const capture = request => requests.push({ url: request.url().replace(origin, ''), worker: !!request.serviceWorker() })
  context.on('request', capture)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(origin)
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.waitForTimeout(10000)
  const metrics = await page.evaluate(() => ({
    ...window.lab,
    resources: performance.getEntriesByType('resource').map(r => ({ url: r.name.replace(location.origin, ''), transfer: r.transferSize, encoded: r.encodedBodySize, start: r.startTime, end: r.responseEnd })),
    domReady: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
    controlled: !!navigator.serviceWorker.controller,
  }))
  // FAQ exists before and after polish; measure the same real keyboard interaction.
  await page.getByText('Do I need to download an app?', { exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  metrics.events = await page.evaluate(() => window.lab.events)
  context.off('request', capture)
  const result = { name, ...metrics, requests, errors }
  results.push(result)
  console.log(JSON.stringify({ name, lcp: result.lcp, cls: result.cls, domReady: result.domReady, requests: requests.length, workerRequests: requests.filter(r => r.worker).length, events: result.events, errors }))
}
try {
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
    await context.addInitScript(() => {
      window.lab = { lcp: 0, cls: 0, events: [], longTasks: [] }
      new PerformanceObserver(list => { for (const e of list.getEntries()) window.lab.lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.lab.cls += e.value }).observe({ type: 'layout-shift', buffered: true })
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.interactionId) window.lab.events.push({ name: e.name, duration: e.duration }) }).observe({ type: 'event', buffered: true, durationThreshold: 16 })
      new PerformanceObserver(list => { for (const e of list.getEntries()) window.lab.longTasks.push(e.duration) }).observe({ type: 'longtask', buffered: true })
    })
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750, connectionType: 'cellular4g' })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await measure(context, page, `cold-${i + 1}`)
    if (i === 2) await measure(context, page, 'warm')
    await context.close()
  }
  const context = await browser.newContext()
  const page = await context.newPage()
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(origin)
    await page.getByRole('heading', { level: 1 }).waitFor()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `.design/screenshots/polish/${label}-${width}.png`, fullPage: true })
  }
  await writeFile(`.design/${label}-metrics.json`, JSON.stringify({ profile: { browser: await browser.version(), origin, viewport: '390x844', cpu: '4x', latencyMs: 150, downloadBytesPerSecond: 200000, observation: '10 seconds after load; page CDP throttling does not model OS-wide worker contention', serving: 'Vite production preview, uncompressed responses' }, results }, null, 2))
} finally { await browser.close() }
