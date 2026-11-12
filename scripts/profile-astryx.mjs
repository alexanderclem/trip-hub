import { createServer } from 'node:http'
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { performance } from 'node:perf_hooks'
import { chromium } from '@playwright/test'

// Repeatable local comparison. Gzip server avoids mistaking preview's raw transfers for production.
// No external requests, service workers, hosted writes or physical-device claims.
const candidates = process.argv.slice(2)
if (!candidates.length) candidates.push('dist')
const reports = []
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' }
const browser = await chromium.launch()
try {
  for (const candidate of candidates) {
    const directory = resolve(candidate)
    const server = createServer(async (req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
        let file = resolve(directory, '.' + pathname)
        if (!file.startsWith(directory + sep)) throw new Error('Outside build')
        if ((await stat(file).catch(() => null))?.isDirectory()) file = resolve(file, 'index.html')
        let data = await readFile(file).catch(() => null)
        if (!data && !extname(pathname)) { file = resolve(directory, 'app.html'); data = await readFile(file) }
        if (!data) { res.writeHead(404); return res.end() }
        const compressed = gzipSync(data)
        res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Content-Encoding': 'gzip', 'Content-Length': compressed.length, 'Cache-Control': 'no-store' })
        res.end(compressed)
      } catch { res.writeHead(404); res.end() }
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    try {
      const samples = []
      for (let run = 0; run < 3; run++) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 3, serviceWorkers: 'block' })
        await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
        const page = await context.newPage()
        const cdp = await context.newCDPSession(page)
        await cdp.send('Network.enable')
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750 })
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
        await cdp.send('Performance.enable')
        let bytes = 0
        cdp.on('Network.loadingFinished', event => { bytes += event.encodedDataLength })
        await page.addInitScript(() => {
          localStorage.setItem('trip-hub-device', JSON.stringify({ state: { quizSeen: true }, version: 1 }))
          window.__longTasks = []
          new PerformanceObserver(list => window.__longTasks.push(...list.getEntries().map(entry => entry.duration))).observe({ type: 'longtask', buffered: true })
        })
        const start = performance.now()
        await page.goto(origin + '/new')
        await page.getByLabel('Trip name', { exact: true }).fill('Example performance trip')
        await page.getByLabel('Your name', { exact: true }).fill('Example traveler')
        const readyMs = performance.now() - start
        const paint = await page.evaluate(() => ({ fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime, longTasks: window.__longTasks }))
        const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]))
        samples.push({ run: run + 1, formUsableMs: Math.round(readyMs), fcpMs: Math.round(paint.fcpMs), encodedBytes: bytes, scriptMs: Math.round(metrics.ScriptDuration * 1000), taskMs: Math.round(metrics.TaskDuration * 1000), longTaskCount: paint.longTasks.length, longestTaskMs: Math.round(Math.max(0, ...paint.longTasks)) })
        await context.close()
      }
      const sorted = samples.map(sample => sample.formUsableMs).sort((a, b) => a - b)
      reports.push({ directory: candidate, medianFormUsableMs: sorted[1], samples })
    } finally { await new Promise(resolve => server.close(resolve)) }
  }
} finally { await browser.close() }
await mkdir('output', { recursive: true })
const report = { method: 'Chromium, fresh context per sample, 390×844 viewport, gzip local HTTP, 4× CPU slowdown, 1.6 Mbps down / 0.75 Mbps up, 150ms latency, 3 cold /new samples. Form usable = both actual inputs filled. All external traffic blocked. Lab comparison, not physical phone or field Web Vitals.', reports }
await writeFile('output/astryx-performance.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
const budgets = JSON.parse(await readFile(new URL('../.design/astryx-migration/BUNDLE_BUDGETS.json', import.meta.url), 'utf8'))
if (reports.at(-1).medianFormUsableMs > budgets.lab.coldCreateMedianMs) throw new Error('Cold create median exceeds the documented lab budget.')
