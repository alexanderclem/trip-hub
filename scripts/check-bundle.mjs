import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { gzipSync } from 'node:zlib'
import { init, parse } from 'es-module-lexer'

// Count shared static imports once for entry + each cold route, never just the route chunk.
await init
const directory = resolve(process.argv[2] ?? 'dist')
const html = await readFile(resolve(directory, 'app.html'), 'utf8')
const entry = html.match(/src="(\/assets\/[^"\s]+\.js)"/)?.[1]
if (!entry) throw new Error('Build the app before checking its bundle.')
const assets = await readdir(resolve(directory, 'assets'))
const budgets = JSON.parse(await readFile(new URL('../.design/astryx-migration/BUNDLE_BUDGETS.json', import.meta.url), 'utf8'))
const report = {}
for (const [name, prefix] of Object.entries({ entry: null, create: 'CreateTripScreen-', home: 'TripOverviewScreen-', plan: 'PlanScreen-', money: 'MoneyScreen-' })) {
  const files = new Map()
  async function visit(file) {
    if (files.has(file)) return
    const code = await readFile(file)
    files.set(file, { raw: code.length, gzip: gzipSync(code).length })
    for (const item of parse(code.toString())[0]) {
      if (item.d === -1 && item.n?.startsWith('.')) await visit(resolve(dirname(file), item.n))
    }
  }
  await visit(resolve(directory, entry.slice(1)))
  if (prefix) {
    const route = assets.find(file => file.startsWith(prefix) && file.endsWith('.js'))
    if (!route) throw new Error(`Missing ${name} route`)
    await visit(resolve(directory, 'assets', route))
  }
  report[name] = { modules: files.size, raw: 0, gzip: 0 }
  for (const size of files.values()) { report[name].raw += size.raw; report[name].gzip += size.gzip }
}
report.css = { raw: 0, gzip: 0 }
for (const name of assets.filter(file => /^index-.*\.css$/.test(file))) {
  const bytes = await readFile(resolve(directory, 'assets', name))
  report.css.raw += bytes.length; report.css.gzip += gzipSync(bytes).length
}
let failed = false
for (const [name, size] of Object.entries(report)) {
  const kib = size.gzip / 1024
  console.log(`${name}: ${kib.toFixed(1)} KiB gzip / ${budgets.gzipKiB[name]} KiB budget`)
  if (kib > budgets.gzipKiB[name]) failed = true
}
if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify({ method: budgets.method, ...report }, null, 2) + '\n')
if (failed) throw new Error('Bundle budget exceeded. Review the complete import graph before changing a budget.')
