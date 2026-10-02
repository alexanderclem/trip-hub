// OpenStreetMap → Stowaway places. Shared by the app (loading places for any destination) and
// scripts/overpass-seed.ts (building a pack shipped with the app), so both sort places the same
// way. Pure and dependency-free. Data © OpenStreetMap contributors (ODbL).

export type OsmCategory = 'lodging' | 'food' | 'drink' | 'activity' | 'sight' | 'transport' | 'shopping' | 'flight'

/** [south, west, north, east] */
export type Bbox = [number, number, number, number]

export interface OsmElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export interface SeedPlace {
  osm_id: string
  name: string
  category: OsmCategory
  lat: number
  lng: number
  area: string
  address: string | null
  phone: string | null
  website: string | null
  opening_hours: string | null
  tags: string[]
}

/** OSM tags → our categories. Checked in order; first match wins. */
const RULES: [(t: Record<string, string>) => boolean, OsmCategory][] = [
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

export const categoryOf = (tags: Record<string, string>): OsmCategory | null => RULES.find(([test]) => test(tags))?.[1] ?? null

export function overpassQuery([s, w, n, e]: Bbox, timeoutSeconds = 90): string {
  const b = `${s},${w},${n},${e}`
  return `[out:json][timeout:${timeoutSeconds}];
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

const clean = (s: string | undefined) => (s && s.trim() ? s.trim() : null)

function address(t: Record<string, string>): string | null {
  const parts = [[t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '), t['addr:city']].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

/**
 * The named, located elements we have a category for, as places in `area`. `seen` carries OSM
 * ids across areas, so a place inside two overlapping areas is kept once. With `within`, places
 * centred outside that box are dropped: a big reserve or route that merely touches the box is
 * returned by the query, but its centre can be far from the town.
 */
export function toSeedPlaces(elements: OsmElement[], area: string, seen = new Set<string>(), within?: Bbox): SeedPlace[] {
  const out: SeedPlace[] = []
  for (const el of elements) {
    const t = el.tags ?? {}
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    const osm_id = `${el.type}/${el.id}`
    if (lat == null || lng == null || !t.name || seen.has(osm_id)) continue
    if (within && (lat < within[0] || lng < within[1] || lat > within[2] || lng > within[3])) continue
    const category = categoryOf(t)
    if (!category) continue
    seen.add(osm_id)
    out.push({
      osm_id,
      name: t.name,
      category,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      area,
      address: address(t),
      phone: clean(t.phone ?? t['contact:phone']),
      website: clean(t.website ?? t['contact:website']),
      opening_hours: clean(t.opening_hours),
      tags: [t.cuisine, t.tourism, t.amenity, t.historic && 'historic'].filter((x): x is string => !!x).flatMap((x) => x.split(';')),
    })
  }
  return out
}
