// Puts places without a pin on the map: the plan's AI-suggested places, events imported with only a
// venue, and anything added by name alone. A pin is tied to a real place whenever possible:
//   1. a place already in the trip with the same name and a location (usually an OSM place from the
//      idea pool), whose OSM id and address are copied too;
//   2. otherwise an OpenStreetMap search (Photon, keyless) limited to the trip's area, accepted only
//      when the result's name matches.
// Places that can't be found are marked `external_ids.located = 'none'` so no phone keeps asking.
import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import { save } from '@/data/repo'
import type { Place, Trip } from '@/data/types'
import { tripAreas, type PhotonFeature } from '@/features/destinations/destinations'
import type { Bbox } from '@/features/places/osm'
import { useOnline } from '@/lib/useOnline'

/** How a place got its pin: from another place in the trip, from an OSM search, or not found. */
export type LocatedBy = 'trip' | 'osm' | 'none'

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'at', 'de', 'del', 'la', 'las', 'el', 'los', 'y', 'le', 'les', 'du', 'des', 'di', 'da', 'do', 'dos', 'das'])

export const normalizeName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const words = (s: string) => normalizeName(s).split(' ').filter((w) => w && !STOP.has(w))

/**
 * Whether two names are the same place: identical once accents, case and punctuation are dropped,
 * or every meaningful word of the shorter name (at least two) appears in the longer one
 * ("Casa Santo Domingo" and "Hotel Casa Santo Domingo").
 */
export function sameName(a: string, b: string): boolean {
  const na = normalizeName(a), nb = normalizeName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const wa = words(a), wb = words(b)
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa]
  if (short.length < 2) return false
  const set = new Set(long)
  return short.every((w) => set.has(w))
}

/** The trip's place with this name, preferring an exact match, then one with a location. */
export function findKnownPlace<P extends Pick<Place, 'id' | 'name' | 'lat' | 'lng'>>(name: string, places: P[], exclude?: string): P | null {
  const key = normalizeName(name)
  if (!key) return null
  const candidates = places.filter((p) => p.id !== exclude && sameName(name, p.name))
  const rank = (p: P) => (normalizeName(p.name) === key ? 0 : 2) + (p.lat != null && p.lng != null ? 0 : 1)
  return candidates.sort((x, y) => rank(x) - rank(y))[0] ?? null
}

/** The area to search in: the trip's destinations, else the spread of its located places, with a margin. */
export function searchRegion(trip: Pick<Trip, 'settings'> | undefined | null, places: Pick<Place, 'lat' | 'lng'>[]): Bbox | null {
  const boxes: Bbox[] = tripAreas(trip).map((a) => a.bbox)
  if (!boxes.length) {
    const located = places.filter((p) => p.lat != null && p.lng != null)
    if (!located.length) return null
    boxes.push([Math.min(...located.map((p) => p.lat!)), Math.min(...located.map((p) => p.lng!)), Math.max(...located.map((p) => p.lat!)), Math.max(...located.map((p) => p.lng!))])
  }
  const [s, w, n, e] = [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))]
  const padLat = Math.max(0.05, (n - s) * 0.25), padLng = Math.max(0.05, (e - w) * 0.25)
  return [Math.max(-90, s - padLat), Math.max(-180, w - padLng), Math.min(90, n + padLat), Math.min(180, e + padLng)]
}

type PhotonHit = PhotonFeature & { properties: PhotonFeature['properties'] & { osm_type?: string; osm_id?: number; street?: string; housenumber?: string; city?: string; district?: string; locality?: string } }
export interface Found { lat: number; lng: number; address: string | null; osm: string | null; name: string | null }

const OSM_TYPE: Record<string, string> = { N: 'node', W: 'way', R: 'relation' }
const round = (n: number) => Math.round(n * 1e6) / 1e6

export function toFound(f: PhotonHit): Found | null {
  const [lng, lat] = f.geometry.coordinates
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const p = f.properties
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const address = [street, p.locality ?? p.district, p.city].filter((x, i, all) => x && all.indexOf(x) === i).join(', ') || null
  return { lat: round(lat), lng: round(lng), address, osm: p.osm_type && p.osm_id ? `${OSM_TYPE[p.osm_type] ?? p.osm_type}/${p.osm_id}` : null, name: p.name ?? null }
}

const inside = (b: Bbox, f: Found) => f.lat >= b[0] && f.lat <= b[2] && f.lng >= b[1] && f.lng <= b[3]

/**
 * The OSM feature for a place's name inside `region`, or null. A name search must match the
 * result's name; an address search (events list only their venue) takes the best hit in the area.
 */
export async function searchOsm(query: { name: string; address?: string | null }, region: Bbox, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<Found | null> {
  const ask = async (q: string) => {
    const params = new URLSearchParams({ q, limit: '8', bbox: [region[1], region[0], region[3], region[2]].join(','), lat: String((region[0] + region[2]) / 2), lon: String((region[1] + region[3]) / 2) })
    const res = await fetcher(`https://photon.komoot.io/api/?${params}`, { signal })
    if (!res.ok) throw new Error(`Place search answered ${res.status}`)
    return ((await res.json()) as { features?: PhotonHit[] }).features ?? []
  }
  for (const hit of await ask(query.name)) {
    const found = toFound(hit)
    if (found && inside(region, found) && found.name && sameName(query.name, found.name)) return found
  }
  if (query.address?.trim()) {
    for (const hit of await ask(query.address)) {
      const found = toFound(hit)
      if (found && inside(region, found)) return found
    }
  }
  return null
}

/** The fields to save on `place` so it has a pin, or a "not found" marker. */
export async function locatePlace(place: Place, others: Place[], region: Bbox | null, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<Partial<Place>> {
  const known = findKnownPlace(place.name, others.filter((p) => p.lat != null && p.lng != null), place.id)
  if (known) {
    return { lat: known.lat, lng: known.lng, address: place.address ?? known.address, area: place.area ?? known.area,
      external_ids: { ...place.external_ids, ...(known.external_ids.osm ? { osm: known.external_ids.osm } : {}), located: 'trip' } }
  }
  const found = region ? await searchOsm({ name: place.name, address: place.address }, region, fetcher, signal) : null
  if (!found) return { external_ids: { ...place.external_ids, located: 'none' } }
  return { lat: found.lat, lng: found.lng, address: place.address ?? found.address,
    external_ids: { ...place.external_ids, ...(found.osm && !place.external_ids.osm ? { osm: found.osm } : {}), located: 'osm' } }
}

/** A place the map should show but can't yet: one of the trip's picks with no pin, not already tried. */
export const needsPin = (p: Place) => !p.deleted_at && (p.lat == null || p.lng == null) && p.status !== 'catalog' && p.status !== 'rejected' && !p.external_ids?.located

const tried = new Set<string>() // this session; a failed request is retried next time the app opens
const GAP_MS = 1100 // Photon is a shared public service: about one search a second
const PER_RUN = 20

/** Online, in the background: give each of the trip's unpinned picks a location. */
export function useAutoLocate(tripId: string) {
  const memberId = useDevice((s) => s.trips[tripId]?.memberId ?? null)
  const online = useOnline()
  const pending = useLiveQuery(async () => {
    const places = await db.places.where('trip_id').equals(tripId).toArray()
    return places.filter(needsPin).map((p) => p.id).sort().join(',')
  }, [tripId])

  useEffect(() => {
    if (!online || !memberId || !pending) return
    const controller = new AbortController()
    const run = async () => {
      const [trip, places] = await Promise.all([db.trips.get(tripId), db.places.where('trip_id').equals(tripId).filter((p) => !p.deleted_at).toArray()])
      const region = searchRegion(trip, places)
      const targets = places.filter((p) => needsPin(p) && !tried.has(p.id)).slice(0, PER_RUN)
      for (const [i, target] of targets.entries()) {
        if (controller.signal.aborted) return
        if (i) await new Promise((r) => setTimeout(r, GAP_MS))
        tried.add(target.id)
        let patch: Partial<Place>
        try { patch = await locatePlace(target, places, region, fetch, controller.signal) }
        catch { tried.delete(target.id); return } // offline or the service is down: try again later
        const fresh = await db.places.get(target.id)
        if (!fresh || !needsPin(fresh) || controller.signal.aborted) continue
        await save('places', { ...fresh, ...patch }, memberId)
        if (patch.lat != null) Object.assign(target, patch) // later places can match this one
      }
    }
    // Wait a moment so a burst of new places (a whole draft) is handled in one pass.
    const t = setTimeout(() => { run().catch((e) => console.warn('[locate]', e)) }, 1500)
    return () => { clearTimeout(t); controller.abort() }
  }, [tripId, online, memberId, pending])
}
