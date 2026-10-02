// Builds a places file for a trip from OpenStreetMap (via the public Overpass API).
// Run once while planning, not from the app:  npm run seed:places -- seed/guatemala-2027
// Reads <dir>/areas.json and writes <dir>/places.json, which you import in
// Trip settings → Import places. Data © OpenStreetMap contributors (ODbL).
// The app can also do this for any destination by itself (Trip settings → Destinations); the
// sorting rules are shared (src/features/places/osm.ts).

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { overpassQuery, toSeedPlaces, type Bbox, type OsmElement } from '../src/features/places/osm.ts'

interface Area {
  name: string
  bbox: Bbox
}

// Public Overpass instances. The main one is often overloaded (504s), so fall back in turn.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const USER_AGENT = 'TripHub-seed/0.1 (small private group trip planner; one-off planning query)'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchArea(area: Area): Promise<OsmElement[]> {
  for (let attempt = 0; attempt < ENDPOINTS.length * 2; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length]!
    const host = new URL(endpoint).host
    let problem: string
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ data: overpassQuery(area.bbox) }),
        signal: AbortSignal.timeout(120_000),
      })
      if (res.ok) return ((await res.json()) as { elements: OsmElement[] }).elements
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`${area.name}: HTTP ${res.status} from ${host}: ${await res.text()}`)
      }
      problem = `HTTP ${res.status}`
    } catch (e) {
      if (e instanceof Error && e.message.startsWith(area.name)) throw e
      problem = e instanceof Error ? e.message : String(e)
    }
    console.warn(`  ${area.name}: ${problem} from ${host}; trying the next server…`)
    await sleep(5_000)
  }
  throw new Error(`${area.name}: every Overpass server failed`)
}

async function main() {
  const dir = process.argv[2]
  if (!dir) throw new Error('Usage: npm run seed:places -- <seed dir containing areas.json>')
  const { areas, area_routes = [] } = JSON.parse(await readFile(join(dir, 'areas.json'), 'utf8')) as {
    areas: Area[]
    area_routes?: unknown[] // typical town-to-town lancha/shuttle times, hand-maintained
  }

  const seen = new Set<string>()
  const places = []
  for (const [i, area] of areas.entries()) {
    if (i > 0) await sleep(5_000) // be polite to the shared public server
    const found = toSeedPlaces(await fetchArea(area), area.name, seen)
    places.push(...found)
    console.log(`${area.name}: ${found.length} places`)
  }

  places.sort((a, b) => a.area.localeCompare(b.area) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  const out = {
    generated_at: new Date().toISOString(),
    attribution: 'Data © OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright',
    area_routes,
    places,
  }
  await writeFile(join(dir, 'places.json'), JSON.stringify(out, null, 1) + '\n')
  console.log(`\nWrote ${places.length} places to ${join(dir, 'places.json')}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
