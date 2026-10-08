// Setting up a trip for any destination without running scripts: find towns by name, work out
// the time zone and currency, and load places from OpenStreetMap. All three use free, keyless
// public services, so they need signal; what they produce is stored with the trip and synced.

import type { Trip } from '@/data/types'
import { importPlaces, type ImportResult } from '@/features/places/importPlaces'
import { overpassQuery, toSeedPlaces, type Bbox, type OsmElement, type SeedPlace } from '@/features/places/osm'

/** A town or neighbourhood the trip covers, kept in trips.settings.areas. */
export interface TripArea {
  name: string
  bbox: Bbox // south, west, north, east
  lat: number
  lng: number
}

export interface Destination extends TripArea {
  /** "Panajachel, Sololá, Guatemala" */
  label: string
  countryCode: string | null
}

export const MAX_AREAS = 6

const isBbox = (b: unknown): b is Bbox => Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === 'number' && Number.isFinite(n))

export function tripAreas(trip: Pick<Trip, 'settings'> | undefined | null): TripArea[] {
  const raw = trip?.settings?.areas
  if (!Array.isArray(raw)) return []
  return raw.filter((a): a is TripArea => !!a && typeof a === 'object' && typeof (a as TripArea).name === 'string' && isBbox((a as TripArea).bbox)
    && typeof (a as TripArea).lat === 'number' && typeof (a as TripArea).lng === 'number')
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round = (n: number) => Math.round(n * 1e4) / 1e4

/**
 * The box to load places and street-level map for: the place's own extent, but never smaller
 * than a village (about 2.5 km across) or bigger than a large town centre (about 15 km), so one
 * search result can't ask the public servers for a whole metropolis.
 */
export function areaBbox(lat: number, lng: number, extent?: [number, number, number, number] | null): Bbox {
  // Photon's extent is [west, north, east, south].
  const halfLat = clamp(extent ? Math.abs(extent[1] - extent[3]) / 2 : 0, 0.012, 0.07)
  const halfLng = clamp(extent ? Math.abs(extent[2] - extent[0]) / 2 : 0, 0.012, 0.07)
  return [round(lat - halfLat), round(lng - halfLng), round(lat + halfLat), round(lng + halfLng)]
}

export interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: { name?: string; state?: string; county?: string; country?: string; countrycode?: string; osm_key?: string; osm_value?: string; extent?: [number, number, number, number] }
}

// Places people stay in. A municipality or county shares its town's name but is centred in the
// middle of its territory, often far from the town itself, so those are left out.
const SETTLEMENTS = ['city', 'town', 'village', 'hamlet', 'suburb', 'borough', 'quarter', 'neighbourhood', 'island', 'islet']

/** Search results as destinations: settlements only, one per distinct label. */
export function toDestinations(features: PhotonFeature[]): Destination[] {
  const seen = new Set<string>()
  const out: Destination[] = []
  for (const f of features) {
    const p = f.properties
    const [lng, lat] = f.geometry.coordinates
    if (!p.name || p.osm_key !== 'place' || !SETTLEMENTS.includes(p.osm_value ?? '') || !Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const label = [p.name, p.state ?? p.county, p.country].filter((x, i, all) => x && all.indexOf(x) === i).join(', ')
    if (seen.has(label)) continue
    seen.add(label)
    out.push({ name: p.name, label, countryCode: p.countrycode?.toUpperCase() ?? null, lat: round(lat), lng: round(lng), bbox: areaBbox(lat, lng, p.extent) })
  }
  return out
}

export async function searchDestinations(query: string, signal?: AbortSignal): Promise<Destination[]> {
  const url = `https://photon.komoot.io/api/?${new URLSearchParams({ q: query, limit: '15', lang: 'en', osm_tag: 'place' })}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Place search isn't answering (HTTP ${res.status}). Try again in a moment.`)
  return toDestinations(((await res.json()) as { features: PhotonFeature[] }).features).slice(0, 7)
}

/**
 * The IANA time zone at a point, or null if it can't be worked out (the form keeps its current
 * zone). Looked up on the phone from a table shipped with the app, loaded only when a
 * destination is picked, so it never depends on a second service answering.
 */
export async function lookupZone(lat: number, lng: number): Promise<string | null> {
  try {
    const { default: tzLookup } = await import('@photostructure/tz-lookup')
    const zone = tzLookup(lat, lng)
    // Open sea has no named zone, only a fixed offset.
    return zone.startsWith('Etc/') ? null : zone
  } catch {
    return null
  }
}

// Country → currency for the places groups commonly travel to. Anything missing is left for
// the person to type.
const EURO = ['AT', 'BE', 'BG', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'ME', 'XK']
const CURRENCY: Record<string, string> = {
  ...Object.fromEntries(EURO.map((c) => [c, 'EUR'])),
  US: 'USD', PR: 'USD', EC: 'USD', SV: 'USD', PA: 'USD', CA: 'CAD', MX: 'MXN', GT: 'GTQ', BZ: 'BZD', HN: 'HNL', NI: 'NIO', CR: 'CRC',
  CO: 'COP', PE: 'PEN', BR: 'BRL', AR: 'ARS', CL: 'CLP', BO: 'BOB', UY: 'UYU', PY: 'PYG', DO: 'DOP', JM: 'JMD', BS: 'BSD', CU: 'CUP',
  GB: 'GBP', CH: 'CHF', NO: 'NOK', SE: 'SEK', DK: 'DKK', IS: 'ISK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', TR: 'TRY', RS: 'RSD', AL: 'ALL',
  MA: 'MAD', EG: 'EGP', ZA: 'ZAR', KE: 'KES', TZ: 'TZS', GH: 'GHS', NG: 'NGN', TN: 'TND',
  JP: 'JPY', KR: 'KRW', CN: 'CNY', TW: 'TWD', HK: 'HKD', TH: 'THB', VN: 'VND', ID: 'IDR', MY: 'MYR', SG: 'SGD', PH: 'PHP', KH: 'KHR', LA: 'LAK',
  IN: 'INR', LK: 'LKR', NP: 'NPR', AE: 'AED', IL: 'ILS', JO: 'JOD', QA: 'QAR', SA: 'SAR', GE: 'GEL', AU: 'AUD', NZ: 'NZD', FJ: 'FJD',
}
export const currencyFor = (countryCode: string | null | undefined): string | null => (countryCode ? (CURRENCY[countryCode.toUpperCase()] ?? null) : null)

// Public Overpass instances; the main one is often busy, so fall back in turn.
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

async function fetchElements(area: TripArea): Promise<OsmElement[]> {
  let problem = ''
  for (const endpoint of OVERPASS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: overpassQuery(area.bbox, 40) }),
        signal: AbortSignal.timeout(50_000),
      })
      if (res.ok) return ((await res.json()) as { elements: OsmElement[] }).elements
      problem = `HTTP ${res.status}`
    } catch (e) {
      problem = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(`Couldn't load places for ${area.name} (${problem}). The free map servers are busy; try again in a minute.`)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Loads OpenStreetMap places for each area into the trip's idea pool. Ids come from the OSM id,
 * so doing this twice, or on two phones, never creates duplicates.
 */
export async function loadAreaPlaces(tripId: string, areas: TripArea[], memberId: string | null, onArea?: (name: string) => void): Promise<ImportResult> {
  const seen = new Set<string>()
  const places: SeedPlace[] = []
  for (const [i, area] of areas.entries()) {
    onArea?.(area.name)
    if (i > 0) await sleep(1_500) // be polite to the shared public servers
    places.push(...toSeedPlaces(await fetchElements(area), area.name, seen, area.bbox))
  }
  return importPlaces(tripId, { places }, memberId)
}
