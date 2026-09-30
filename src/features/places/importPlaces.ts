import { z } from 'zod'
import { db } from '@/data/db'
import { saveMany } from '@/data/repo'
import { PLACE_CATEGORIES, type Place } from '@/data/types'
import { stableId } from '@/lib/ids'

/** Shape written by scripts/overpass-seed.ts. */
const SeedPlace = z.object({
  osm_id: z.string(), // e.g. "node/123456"
  name: z.string().min(1).max(200),
  category: z.enum(PLACE_CATEGORIES),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  area: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  opening_hours: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
})
const SeedFile = z.object({ places: z.array(SeedPlace) })

export interface ImportResult {
  added: number
  skipped: number
}

/**
 * Adds OSM places to the trip's idea pool. Ids are derived from the OSM id, so importing
 * the same file twice (or on two phones) never creates duplicates, and places someone has
 * already edited are left alone.
 */
export async function importPlaces(tripId: string, json: unknown, memberId: string | null): Promise<ImportResult> {
  const parsed = SeedFile.safeParse(json)
  if (!parsed.success) throw new Error(`Not a Trip Hub places file: ${parsed.error.issues[0]?.message ?? 'invalid'}`)

  const rows: Place[] = parsed.data.places.map((s) => ({
    id: stableId(tripId, 'osm', s.osm_id),
    trip_id: tripId,
    name: s.name,
    category: s.category,
    tags: s.tags ?? [],
    lat: s.lat,
    lng: s.lng,
    address: s.address ?? null,
    area: s.area ?? null,
    status: 'catalog',
    notes: null,
    phone: s.phone ?? null,
    website: s.website && /^https?:\/\//i.test(s.website) ? s.website : null,
    opening_hours: s.opening_hours ?? null,
    external_ids: { osm: s.osm_id },
    source: 'osm',
  }))

  const existing = new Set((await db.places.bulkGet(rows.map((r) => r.id))).filter(Boolean).map((p) => p!.id))
  const fresh = rows.filter((r) => !existing.has(r.id))
  if (fresh.length) await saveMany('places', fresh, memberId)
  return { added: fresh.length, skipped: rows.length - fresh.length }
}
