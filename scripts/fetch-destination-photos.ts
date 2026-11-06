// Builds the destination photo set used for automatic trip covers.
//
//   node scripts/fetch-destination-photos.ts            fetch anything missing
//   node scripts/fetch-destination-photos.ts --force    re-download every photo
//
// For each destination below it reads the place's representative image (P18) and coordinates
// (P625) from Wikidata, then the file's author and licence from Wikimedia Commons, and downloads
// three sizes into public/images/destinations/. Only freely licensed files are kept (Commons hosts
// nothing else, but the licence is checked anyway). The manifest it writes,
// src/features/trips/destination-photos.json, carries the credit the app prints under each photo.
// No keys, no paid services; nothing is fetched at runtime.

import { mkdir, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'

const UA = 'StowawayAssetBuilder/1.0 (https://joinstowaway.app; trip cover photos)'
const OUT_DIR = 'public/images/destinations'
const MANIFEST = 'src/features/trips/destination-photos.json'
const force = process.argv.includes('--force')

// [id, display name, English Wikipedia title, match radius in km, extra names people type]
type Entry = [string, string, string, number, string[]?]
const DESTINATIONS: Entry[] = [
  // Europe
  ['paris', 'Paris', 'Paris', 30],
  ['london', 'London', 'London', 35],
  ['rome', 'Rome', 'Rome', 30, ['roma']],
  ['barcelona', 'Barcelona', 'Barcelona', 25],
  ['amsterdam', 'Amsterdam', 'Amsterdam', 25],
  ['lisbon', 'Lisbon', 'Lisbon', 25, ['lisboa']],
  ['porto', 'Porto', 'Porto', 20, ['oporto']],
  ['madrid', 'Madrid', 'Madrid', 30],
  ['seville', 'Seville', 'Seville', 20, ['sevilla']],
  ['prague', 'Prague', 'Prague', 25, ['praha']],
  ['vienna', 'Vienna', 'Vienna', 25, ['wien']],
  ['berlin', 'Berlin', 'Berlin', 30],
  ['budapest', 'Budapest', 'Budapest', 25],
  ['krakow', 'Kraków', 'Kraków', 20, ['krakow', 'cracow']],
  ['florence', 'Florence', 'Florence', 20, ['firenze']],
  ['venice', 'Venice', 'Venice', 15, ['venezia']],
  ['amalfi-coast', 'Amalfi Coast', 'Amalfi Coast', 25, ['amalfi', 'positano']],
  ['cinque-terre', 'Cinque Terre', 'Cinque Terre', 15],
  ['lake-como', 'Lake Como', 'Lake Como', 25, ['como', 'bellagio']],
  ['tuscany', 'Tuscany', 'Tuscany', 90, ['toscana']],
  ['provence', 'Provence', 'Provence', 80],
  ['nice', 'Nice', 'Nice', 20, ['french riviera', 'cote d azur']],
  ['dublin', 'Dublin', 'Dublin', 25],
  ['edinburgh', 'Edinburgh', 'Edinburgh', 20],
  ['copenhagen', 'Copenhagen', 'Copenhagen', 25, ['kobenhavn']],
  ['stockholm', 'Stockholm', 'Stockholm', 25],
  ['reykjavik', 'Reykjavík', 'Reykjavík', 40, ['reykjavik', 'iceland']],
  ['athens', 'Athens', 'Athens', 25],
  ['santorini', 'Santorini', 'Santorini', 20, ['thira', 'oia']],
  ['mykonos', 'Mykonos', 'Mykonos', 15],
  ['dubrovnik', 'Dubrovnik', 'Dubrovnik', 20],
  ['split', 'Split', 'Split, Croatia', 20],
  ['istanbul', 'Istanbul', 'Istanbul', 35],
  ['ibiza', 'Ibiza', 'Ibiza', 25],
  ['mallorca', 'Mallorca', 'Mallorca', 50, ['majorca', 'palma']],
  ['algarve', 'Algarve', 'Algarve', 70, ['lagos portugal', 'faro']],
  ['valletta', 'Malta', 'Valletta', 25, ['malta']],
  ['zermatt', 'Zermatt', 'Zermatt', 20, ['matterhorn']],
  // North America
  ['new-york', 'New York City', 'New York City', 35, ['new york', 'nyc', 'manhattan']],
  ['los-angeles', 'Los Angeles', 'Los Angeles', 45, ['la']],
  ['san-francisco', 'San Francisco', 'San Francisco', 25],
  ['las-vegas', 'Las Vegas', 'Las Vegas', 30, ['vegas']],
  ['miami', 'Miami', 'Miami', 30, ['miami beach']],
  ['new-orleans', 'New Orleans', 'New Orleans', 25, ['nola']],
  ['chicago', 'Chicago', 'Chicago', 35],
  ['nashville', 'Nashville', 'Nashville, Tennessee', 25],
  ['honolulu', 'Honolulu', 'Honolulu', 30, ['oahu', 'waikiki']],
  ['maui', 'Maui', 'Maui', 45],
  ['grand-canyon', 'Grand Canyon', 'Grand Canyon', 80],
  ['yosemite', 'Yosemite', 'Yosemite National Park', 50],
  ['yellowstone', 'Yellowstone', 'Yellowstone National Park', 90],
  ['banff', 'Banff', 'Banff National Park', 60, ['lake louise']],
  ['vancouver', 'Vancouver', 'Vancouver', 30],
  ['montreal', 'Montréal', 'Montreal', 30, ['montreal']],
  ['mexico-city', 'Mexico City', 'Mexico City', 40, ['cdmx', 'ciudad de mexico']],
  ['cancun', 'Cancún', 'Cancún', 30, ['cancun']],
  ['tulum', 'Tulum', 'Tulum', 20],
  ['oaxaca', 'Oaxaca', 'Oaxaca City', 25, ['oaxaca de juarez']],
  ['cabo', 'Los Cabos', 'Cabo San Lucas', 40, ['cabo', 'cabo san lucas', 'los cabos']],
  ['san-juan', 'San Juan', 'San Juan, Puerto Rico', 30, ['puerto rico']],
  ['havana', 'Havana', 'Havana', 25, ['la habana']],
  // Central and South America
  ['antigua-guatemala', 'Antigua Guatemala', 'Antigua Guatemala', 15, ['antigua']],
  ['lake-atitlan', 'Lake Atitlán', 'Lake Atitlán', 25, ['atitlan', 'panajachel', 'san marcos la laguna', 'san pedro la laguna']],
  ['tikal', 'Tikal', 'Tikal', 30, ['flores']],
  ['arenal', 'Arenal', 'Arenal Volcano', 30, ['la fortuna']],
  ['manuel-antonio', 'Manuel Antonio', 'Manuel Antonio National Park', 20, ['quepos']],
  ['cartagena', 'Cartagena', 'Cartagena, Colombia', 25],
  ['medellin', 'Medellín', 'Medellín', 25, ['medellin']],
  ['cusco', 'Cusco', 'Cusco', 30, ['cuzco']],
  ['machu-picchu', 'Machu Picchu', 'Machu Picchu', 25, ['aguas calientes']],
  ['galapagos', 'Galápagos', 'Galápagos Islands', 150, ['galapagos']],
  ['rio', 'Rio de Janeiro', 'Rio de Janeiro', 35, ['rio']],
  ['buenos-aires', 'Buenos Aires', 'Buenos Aires', 35],
  ['patagonia', 'Torres del Paine', 'Torres del Paine National Park', 80, ['patagonia']],
  // Africa and the Middle East
  ['marrakesh', 'Marrakesh', 'Marrakesh', 30, ['marrakech']],
  ['cairo', 'Cairo', 'Cairo', 35, ['giza']],
  ['petra', 'Petra', 'Petra', 30, ['wadi musa']],
  ['dubai', 'Dubai', 'Dubai', 40],
  ['cape-town', 'Cape Town', 'Cape Town', 40],
  ['zanzibar', 'Zanzibar', 'Zanzibar', 60, ['stone town']],
  ['serengeti', 'Serengeti', 'Serengeti National Park', 120, ['serengeti']],
  // Asia and the Pacific
  ['tokyo', 'Tokyo', 'Tokyo', 40],
  ['kyoto', 'Kyoto', 'Kyoto', 25],
  ['seoul', 'Seoul', 'Seoul', 35],
  ['bangkok', 'Bangkok', 'Bangkok', 35],
  ['chiang-mai', 'Chiang Mai', 'Chiang Mai', 30],
  ['phuket', 'Phuket', 'Phuket Province', 40],
  ['bali', 'Bali', 'Bali', 80, ['ubud', 'seminyak', 'canggu']],
  ['singapore', 'Singapore', 'Singapore', 30],
  ['hong-kong', 'Hong Kong', 'Hong Kong', 35],
  ['hanoi', 'Hanoi', 'Hanoi', 30],
  ['ha-long-bay', 'Ha Long Bay', 'Hạ Long Bay', 40, ['halong bay', 'ha long']],
  ['siem-reap', 'Angkor', 'Angkor Wat', 30, ['siem reap', 'angkor wat']],
  ['kathmandu', 'Kathmandu', 'Kathmandu', 35],
  ['agra', 'Agra', 'Taj Mahal', 30, ['taj mahal', 'agra']],
  ['maldives', 'Maldives', 'Maldives', 400],
  ['sydney', 'Sydney', 'Sydney', 40],
  ['melbourne', 'Melbourne', 'Melbourne', 40],
  ['queenstown', 'Queenstown', 'Queenstown, New Zealand', 40],
  ['bora-bora', 'Bora Bora', 'Bora Bora', 25],
]

// After looking at the first pass: a better Commons file for places whose Wikidata image is a
// montage, a map, a portrait-orientation close-up or otherwise a poor cover.
const OVERRIDES: Record<string, string> = {
  // Neither Wikidata item has a representative image (6 Nov 2026).
  zanzibar: 'Dhow boat Zanzibar.jpg',
  maldives: 'Diamonds Thudufushi Beach and Water Villas, May 2017 -07.jpg',
}

// Credits whose Commons "Artist" field is a sentence rather than a name.
const AUTHORS: Record<string, string> = { zanzibar: 'Anton Zelenov', 'cinque-terre': 'Timothy A. Gonsalves' }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** One attempt = request + body; any failure (status, network, timeout while reading) retries with backoff. */
async function fetchBody(url: string, kind: 'json' | 'bytes', timeoutMs: number): Promise<any> {
  let last = ''
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) })
      if (res.ok) return kind === 'json' ? await res.json() : Buffer.from(await res.arrayBuffer())
      last = `HTTP ${res.status}`
    } catch (e) { last = e instanceof Error ? e.message : String(e) }
    await sleep(2000 * (attempt + 1))
  }
  throw new Error(`${last} for ${url}`)
}
const getJson = (url: string) => fetchBody(url, 'json', 30_000)
const chunks = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size))
const plain = (html = '') => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, '’').replace(/\s+/g, ' ').trim()

async function wikidata(titles: string[]) {
  const found = new Map<string, { image?: string; lat?: number; lng?: number }>()
  const read = (entity: any, title: string) => {
    if (!entity?.claims) return
    const image = entity.claims.P18?.[0]?.mainsnak?.datavalue?.value
    const coord = entity.claims.P625?.[0]?.mainsnak?.datavalue?.value
    found.set(title, { image, lat: coord?.latitude, lng: coord?.longitude })
  }
  const base = 'https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&props=claims|sitelinks&sitefilter=enwiki&format=json'
  // Exact titles in batches; anything that didn't match is looked up alone with redirects resolved.
  for (const group of chunks(titles, 45)) {
    const data = await getJson(`${base}&titles=${encodeURIComponent(group.join('|'))}`)
    for (const entity of Object.values<any>(data.entities ?? {})) if (entity.sitelinks?.enwiki?.title) read(entity, entity.sitelinks.enwiki.title)
  }
  for (const title of titles.filter((t) => !found.has(t))) {
    const data = await getJson(`${base}&normalize=1&titles=${encodeURIComponent(title)}`)
    read(Object.values<any>(data.entities ?? {})[0], title)
  }
  return found
}

async function commons(files: string[], width: number) {
  const found = new Map<string, any>()
  for (const group of chunks(files, 40)) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=${width}&titles=${encodeURIComponent(group.map((f) => `File:${f}`).join('|'))}`
    const data = await getJson(url)
    const normalized = new Map<string, string>((data.query?.normalized ?? []).map((n: any) => [n.to, n.from]))
    for (const page of Object.values<any>(data.query?.pages ?? {})) {
      const info = page.imageinfo?.[0]
      if (!info) continue
      const original = (normalized.get(page.title) ?? page.title).replace(/^File:/, '')
      found.set(original, info)
      found.set(page.title.replace(/^File:/, ''), info)
    }
  }
  return found
}

async function exists(path: string) { try { await access(path); return true } catch { return false } }
async function download(url: string, path: string) {
  if (!force && await exists(path)) return
  await writeFile(path, await fetchBody(url, 'bytes', 90_000))
  await sleep(250)
}

const FREE = /^(cc0|public domain|pd|cc by(-sa)?( \d\.\d)?|cc-by(-sa)?-\d\.\d|attribution|gfdl|fal)/i

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const facts = await wikidata(DESTINATIONS.map(([, , title]) => title))
  const fileFor = (id: string, title: string) => OVERRIDES[id] ?? facts.get(title)?.image
  const files = [...new Set(DESTINATIONS.map(([id, , title]) => fileFor(id, title)).filter((f): f is string => !!f))]
  const [large, small, tiny] = [await commons(files, 1280), await commons(files, 500), await commons(files, 60)]
  const manifest = []
  const problems: string[] = []
  for (const [id, name, title, radius, aliases = []] of DESTINATIONS) {
    const fact = facts.get(title)
    const file = fileFor(id, title)
    const info = file ? large.get(file) : undefined
    if (!fact || fact.lat == null || !file || !info) { problems.push(`${id}: ${!fact ? 'no Wikidata item' : fact.lat == null ? 'no coordinates' : 'no image'}`); continue }
    const meta = info.extmetadata ?? {}
    const license = plain(meta.LicenseShortName?.value) || 'unknown'
    if (!FREE.test(license)) { problems.push(`${id}: licence "${license}" not recognised as free`); continue }
    const author = AUTHORS[id] ?? (plain(meta.Artist?.value) || 'Unknown author')
    await download(info.thumburl ?? info.url, join(OUT_DIR, `${id}.jpg`))
    await download(small.get(file)?.thumburl ?? info.thumburl, join(OUT_DIR, `${id}-small.jpg`))
    await download(tiny.get(file)?.thumburl ?? info.thumburl, join(OUT_DIR, `${id}-placeholder.jpg`))
    manifest.push({
      id, name, aliases, radius,
      lat: Math.round(fact.lat * 1e4) / 1e4, lng: Math.round(fact.lng! * 1e4) / 1e4,
      width: info.thumbwidth ?? info.width, height: info.thumbheight ?? info.height,
      author: author.length > 80 ? `${author.slice(0, 77)}…` : author,
      license, licenseUrl: plain(meta.LicenseUrl?.value) || null,
      source: info.descriptionurl,
    })
    process.stdout.write('.')
  }
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`\n${manifest.length} destination photos written to ${OUT_DIR}; manifest ${MANIFEST}`)
  if (problems.length) console.log(`Skipped:\n  ${problems.join('\n  ')}`)
}

await main()
