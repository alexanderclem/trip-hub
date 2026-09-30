// Builds a places file for a trip from OpenStreetMap (via the public Overpass API).
// Run once while planning, not from the app:  npm run seed:places -- seed/guatemala-2027
// Reads <dir>/areas.json and writes <dir>/places.json, which you import in
// Trip settings → Import places. Data © OpenStreetMap contributors (ODbL).

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type Category = 'lodging' | 'food' | 'drink' | 'activity' | 'sight' | 'transport' | 'shopping' | 'flight'

interface Area {
  name: string
  bbox: [number, number, number, number] // south, west, north, east
}

interface OsmElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

// Public Overpass instances. The main one is often overloaded (504s), so fall back in turn.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const USER_AGENT = 'TripHub-seed/0.1 (small private group trip planner; one-off planning query)'

/** OSM tags → our categories. Checked in order; first match wins. */
const RULES: [(t: Record<string, string>) => boolean, Category][] = [
  [(t) => t.aeroway === 'aerodrome', 'flight'],
  [(t) => ['hotel', 'hostel', 'guest_house', 'apartment', 'motel', 'chalet'].includes(t.tourism ?? ''), 'lodging'],
  [(t) => ['bar', 'pub', 'nightclub', 'biergarten'].includes(t.amenity ?? ''), 'drink'],
  [(t) => ['restaurant', 'cafe', 'fast_food', 'ice_cream', 'food_court'].includes(t.amenity ?? ''), 'food'],
  [(t) => t.shop === 'bakery', 'food'],
  [(t) => ['ferry_terminal', 'bus_station'].includes(t.amenity ?? '') || (t.man_made === 'pier' && !!t.name), 'transport'],
  [(t) => ['attraction', 'museum', 'viewpoint', 'gallery', 'artwork'].includes(t.tourism ?? '') || !!t.historic, 'sight'],
  [(t) => t.tourism === 'information' && t.information === 'office', 'activity'],
  [(t) => !!t.leisure && ['park', 'nature_reserve', 'beach_resort'].includes(t.leisure), 'activity'],
  [(t) => ['marketplace'].includes(t.amenity ?? '') || ['craft', 'souvenir', 'gift', 'art', 'chocolate', 'coffee'].includes(t.shop ?? ''), 'shopping'],
]

function queryFor([s, w, n, e]: Area['bbox']): string {
  const b = `${s},${w},${n},${e}`
  return `[out:json][timeout:90];
(
  nwr["tourism"~"^(hotel|hostel|guest_house|apartment|motel|chalet|attraction|museum|viewpoint|gallery|artwork|information)$"]["name"](${b});
  nwr["amenity"~"^(restaurant|cafe|fast_food|ice_cream|food_court|bar|pub|nightclub|biergarten|ferry_terminal|bus_station|marketplace)$"]["name"](${b});
  nwr["historic"]["name"](${b});
  nwr["man_made"="pier"]["name"](${b});
  nwr["shop"~"^(bakery|craft|souvenir|gift|art|chocolate|coffee)$"]["name"](${b});
  nwr["leisure"~"^(park|nature_reserve|beach_resort)$"]["name"](${b});
  nwr["aeroway"="aerodrome"]["name"](${b});
);
out center tags;`
}

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
        body: new URLSearchParams({ data: queryFor(area.bbox) }),
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

const clean = (s: string | undefined) => (s && s.trim() ? s.trim() : null)

function address(t: Record<string, string>): string | null {
  const parts = [[t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '), t['addr:city']].filter(Boolean)
  return parts.length ? parts.join(', ') : null
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
    const elements = await fetchArea(area)
    let kept = 0
    for (const el of elements) {
      const t = el.tags ?? {}
      const lat = el.lat ?? el.center?.lat
      const lng = el.lon ?? el.center?.lon
      const osm_id = `${el.type}/${el.id}`
      if (lat == null || lng == null || !t.name || seen.has(osm_id)) continue
      const category = RULES.find(([test]) => test(t))?.[1]
      if (!category) continue
      seen.add(osm_id)
      kept++
      places.push({
        osm_id,
        name: t.name,
        category,
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        area: area.name,
        address: address(t),
        phone: clean(t.phone ?? t['contact:phone']),
        website: clean(t.website ?? t['contact:website']),
        opening_hours: clean(t.opening_hours),
        tags: [t.cuisine, t.tourism, t.amenity, t.historic && 'historic'].filter((x): x is string => !!x).flatMap((x) => x.split(';')),
      })
    }
    console.log(`${area.name}: ${kept} places`)
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
