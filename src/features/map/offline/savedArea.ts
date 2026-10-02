// An offline map for any destination, with nothing built ahead of time: the phone downloads the
// online map's own tiles for the trip's areas and keeps them. Offline, the map uses a copy of
// the style saved at the same moment, so it asks for exactly the tiles that were stored (the
// tile server's addresses change with each weekly build).
//
// Tiles go in the service worker's "map-tiles" cache under their real addresses, so the
// existing cache-first rule serves them. Entries put there directly aren't tracked by its
// clean-up, so a saved area isn't pushed out by ordinary map browsing.

import { useCallback, useEffect, useState } from 'react'
import type { StyleSpecification } from 'maplibre-gl'
import { db } from '@/data/db'
import type { TripArea } from '@/features/destinations/destinations'
import type { Bbox } from '@/features/places/osm'

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const TILE_CACHE = 'map-tiles'
const ASSET_CACHE = 'map-assets'
/** Refuse downloads bigger than this; it's roughly 60 MB of street-level map. */
export const MAX_TILES = 1600
const AVERAGE_TILE_BYTES = 40_000
// Latin, Latin extended, Greek, Cyrillic and general punctuation. Other scripts need signal.
const GLYPH_RANGES = ['0-255', '256-511', '512-767', '768-1023', '1024-1279', '8192-8447']

export interface Tile { z: number; x: number; y: number }

export interface SavedMap {
  style: StyleSpecification
  areas: TripArea[]
  tiles: number
  bytes: number
  savedAt: string
}

const lngToX = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z)
function latToY(lat: number, z: number) {
  const rad = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z)
}

/** Every tile at zoom `z` touching the box. */
export function tilesFor([south, west, north, east]: Bbox, z: number): Tile[] {
  const max = 2 ** z - 1
  const clampT = (n: number) => Math.min(max, Math.max(0, n))
  const out: Tile[] = []
  for (let x = clampT(lngToX(west, z)); x <= clampT(lngToX(east, z)); x++) {
    for (let y = clampT(latToY(north, z)); y <= clampT(latToY(south, z)); y++) out.push({ z, x, y })
  }
  return out
}

const pad = ([s, w, n, e]: Bbox, by: number): Bbox => [s - by, w - by, n + by, e + by]

export function union(areas: TripArea[]): Bbox {
  return [
    Math.min(...areas.map((a) => a.bbox[0])), Math.min(...areas.map((a) => a.bbox[1])),
    Math.max(...areas.map((a) => a.bbox[2])), Math.max(...areas.map((a) => a.bbox[3])),
  ]
}

/**
 * What to keep: the wider region at low zoom (to see how the towns relate), the stretch between
 * the towns at middle zoom, and each town at street level.
 */
export function planTiles(areas: TripArea[], maxZoom = 14): Tile[] {
  if (!areas.length) return []
  const all = union(areas)
  const seen = new Set<string>()
  const out: Tile[] = []
  const add = (tiles: Tile[]) => {
    for (const t of tiles) {
      const key = `${t.z}/${t.x}/${t.y}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push(t)
      }
    }
  }
  for (let z = 0; z <= Math.min(8, maxZoom); z++) add(tilesFor(pad(all, 1), z))
  for (let z = 9; z <= Math.min(11, maxZoom); z++) add(tilesFor(pad(all, 0.1), z))
  for (let z = 12; z <= maxZoom; z++) for (const a of areas) add(tilesFor(pad(a.bbox, 0.005), z))
  return out
}

export const estimateBytes = (areas: TripArea[]) => planTiles(areas).length * AVERAGE_TILE_BYTES

const fileKey = (tripId: string) => `saved-map:${tripId}`

export async function getSavedMap(tripId: string): Promise<SavedMap | null> {
  const row = await db.files.get(fileKey(tripId))
  if (!row) return null
  try {
    return JSON.parse(await row.blob.text()) as SavedMap
  } catch {
    return null
  }
}

type VectorOrRaster = { type: string; url?: string; tiles?: string[]; minzoom?: number; maxzoom?: number; attribution?: string; tileSize?: number }

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Couldn't reach the map server (HTTP ${res.status}).`)
  return (await res.json()) as T
}

/** The font stacks the style's labels use, as the server expects them ("Noto Sans Regular"). */
export function fontStacks(style: StyleSpecification): string[] {
  const stacks = new Set<string>()
  // A font list is either the plain layout value or the argument of a ["literal", …] expression.
  const visit = (v: unknown, isList: boolean) => {
    if (!Array.isArray(v)) return
    if (isList && v.length && v.every((x) => typeof x === 'string')) return void stacks.add((v as string[]).join(','))
    if (v[0] === 'literal') return visit(v[1], true)
    v.slice(1).forEach((x) => visit(x, false))
  }
  for (const layer of style.layers) {
    const font = (layer as { layout?: Record<string, unknown> }).layout?.['text-font']
    if (font) visit(font, true)
  }
  return [...stacks]
}

const tileUrl = (template: string, t: Tile) => template.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y))

async function keep(cache: Cache, url: string): Promise<number> {
  const res = await fetch(url)
  // The tile server answers 204/404 for empty sea; there's nothing to store.
  if (res.status === 204 || res.status === 404) return 0
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  await cache.put(url, new Response(blob, { status: 200, headers: res.headers }))
  return blob.size
}

/** Runs `job` over `items`, a few at a time. */
async function pooled<T>(items: T[], size: number, job: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) await job(items[next++]!)
  }))
}

/**
 * Downloads the map for the trip's areas onto this phone. `onProgress` gets tiles done and the
 * total. Throws if the phone can't store it or too much of the download fails.
 */
export async function saveAreaMap(tripId: string, areas: TripArea[], onProgress: (done: number, total: number) => void): Promise<SavedMap> {
  if (!('caches' in window)) throw new Error("This browser can't store maps for offline use.")
  if (!areas.length) throw new Error('Add a destination first.')

  // Inline each source's tile addresses, so the saved style never has to look them up.
  const style = await json<StyleSpecification>(STYLE_URL)
  const sources = style.sources as Record<string, VectorOrRaster>
  for (const [id, source] of Object.entries(sources)) {
    if (!source.url) continue
    const info = await json<{ tiles: string[]; minzoom?: number; maxzoom?: number; attribution?: string }>(source.url)
    sources[id] = { type: source.type, tiles: info.tiles, minzoom: info.minzoom, maxzoom: info.maxzoom, attribution: info.attribution }
  }

  const urls: string[] = []
  for (const source of Object.values(sources)) {
    const template = source.tiles?.[0]
    if (!template) continue
    const top = Math.min(source.maxzoom ?? 14, 14)
    // Low-zoom backdrops (shaded relief) only matter for the overview.
    const tiles = source.type === 'vector' ? planTiles(areas, top) : planTiles(areas, Math.min(top, 8))
    urls.push(...tiles.map((t) => tileUrl(template, t)))
  }
  if (urls.length > MAX_TILES) throw new Error('That is too much map to save. Remove a destination, or pick towns that are closer together.')

  let done = 0
  let bytes = 0
  let failed = 0
  const tileCache = await caches.open(TILE_CACHE)
  onProgress(0, urls.length)
  await pooled(urls, 6, async (url) => {
    try {
      bytes += await keep(tileCache, url)
    } catch {
      failed++
    }
    onProgress(++done, urls.length)
  })
  if (failed > urls.length * 0.05) throw new Error(`${failed} of ${urls.length} map pieces failed to download. Try again on better signal.`)

  // Label fonts and icons.
  const assets = await caches.open(ASSET_CACHE)
  const assetUrls: string[] = [STYLE_URL]
  if (typeof style.sprite === 'string') for (const suffix of ['.json', '.png', '@2x.json', '@2x.png']) assetUrls.push(`${style.sprite}${suffix}`)
  if (style.glyphs) {
    for (const stack of fontStacks(style)) for (const range of GLYPH_RANGES) assetUrls.push(style.glyphs.replace('{fontstack}', stack).replace('{range}', range))
  }
  await pooled(assetUrls, 6, async (url) => {
    try {
      bytes += await keep(assets, url)
    } catch {
      // a missing font range only affects labels in that script
    }
  })

  const saved: SavedMap = { style, areas, tiles: urls.length, bytes, savedAt: new Date().toISOString() }
  await db.files.put({ name: fileKey(tripId), blob: new Blob([JSON.stringify(saved)], { type: 'application/json' }) })
  return saved
}

export async function removeSavedMap(tripId: string): Promise<void> {
  const saved = await getSavedMap(tripId)
  await db.files.delete(fileKey(tripId))
  if (!saved || !('caches' in window)) return
  const cache = await caches.open(TILE_CACHE)
  for (const source of Object.values(saved.style.sources as Record<string, VectorOrRaster>)) {
    const template = source.tiles?.[0]
    if (!template) continue
    const top = Math.min(source.maxzoom ?? 14, 14)
    const tiles = source.type === 'vector' ? planTiles(saved.areas, top) : planTiles(saved.areas, Math.min(top, 8))
    await Promise.all(tiles.map((t) => cache.delete(tileUrl(template, t))))
  }
}

/** The saved map for a trip on this phone: undefined while loading, null if there isn't one. */
export function useSavedMap(tripId: string): [SavedMap | null | undefined, () => void] {
  const [saved, setSaved] = useState<SavedMap | null | undefined>(undefined)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    void getSavedMap(tripId).then((s) => {
      if (!cancelled) setSaved(s)
    })
    return () => {
      cancelled = true
    }
  }, [tripId, tick])
  return [saved, useCallback(() => setTick((t) => t + 1), [])]
}
