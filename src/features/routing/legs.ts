// Turns computed legs, reported times and typical town-to-town routes into the travel options
// shown for a pair of places. Pure, so it's unit-tested and works offline.
//
// Priority, per mode: what someone in the group reported > typical route for the two towns >
// routed time × the trip's correction range > straight-line estimate.

import type { AreaRoute, LegOverride, Place, RouteLeg, TravelMode } from '@/data/types'
import { haversineM } from '@/lib/geo'

export type OptionSource = 'reported' | 'typical' | 'routed' | 'estimate'

export interface TravelOption {
  mode: TravelMode
  minS: number
  maxS: number
  source: OptionSource
  distanceM: number | null
  note?: string | null
}

export interface LegContext {
  legs: RouteLeg[]
  overrides: LegOverride[]
  areaRoutes: AreaRoute[]
  factorLow: number
  factorHigh: number
}

const WALK_ROUTED_MAX_M = 6_000 // don't suggest walking further than this
const WALK_EST_MAX_M = 2_500
const WALK_KMH = 4.5
const DETOUR = 1.3 // straight line → street distance
const DRIVE_EST_KMH = 30
const COORD_EPS = 1e-5
const SHORT_WALK_S = 25 * 60

export const pairKey = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a])

const roundDown5 = (s: number) => Math.max(60, Math.floor(s / 300) * 300)
const roundUp5 = (s: number) => Math.max(300, Math.ceil(s / 300) * 300)
// Whole minutes for short trips ("9–11 min"), 5-minute steps beyond 20 minutes.
const FINE_ROUNDING_BELOW_S = 20 * 60
const range = (lo: number, hi: number): [number, number] => {
  const min = lo < FINE_ROUNDING_BELOW_S ? Math.max(60, Math.round(lo / 60) * 60) : roundDown5(lo)
  const max = hi < FINE_ROUNDING_BELOW_S ? Math.max(min, Math.round(hi / 60) * 60) : roundUp5(hi)
  return [min, Math.max(min, max)]
}

/** A computed leg is stale if either pin has moved since it was computed. */
export function isStale(leg: RouteLeg, from: Place, to: Place): boolean {
  const moved = (a: number | null, b: number | null) => a == null || b == null || Math.abs(a - b) > COORD_EPS
  return moved(leg.from_lat, from.lat) || moved(leg.from_lng, from.lng) || moved(leg.to_lat, to.lat) || moved(leg.to_lng, to.lng)
}

function findLeg(ctx: LegContext, from: Place, to: Place, mode: 'drive' | 'walk'): RouteLeg | undefined {
  const pick = (a: Place, b: Place) =>
    ctx.legs.find((l) => l.from_place_id === a.id && l.to_place_id === b.id && l.mode === mode && !l.deleted_at && !isStale(l, a, b))
  // Fall back to the reverse direction; close enough for planning.
  return pick(from, to) ?? pick(to, from)
}

export function travelOptions(from: Place, to: Place, ctx: LegContext): TravelOption[] {
  if (from.id === to.id) return []
  const straight =
    from.lat != null && from.lng != null && to.lat != null && to.lng != null
      ? haversineM({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng })
      : null
  const out: TravelOption[] = []
  const covered = new Set<TravelMode>()

  // 1. Reported by the group.
  const [a, b] = pairKey(from.id, to.id)
  for (const o of ctx.overrides) {
    if (o.deleted_at || o.place_a_id !== a || o.place_b_id !== b) continue
    out.push({ mode: o.mode, minS: o.min_s, maxS: o.max_s, source: 'reported', distanceM: null, note: o.note })
    covered.add(o.mode)
  }

  // 2. Typical town-to-town routes (lanchas, shuttles).
  if (from.area && to.area && from.area !== to.area) {
    for (const r of ctx.areaRoutes) {
      const match = (r.a === from.area && r.b === to.area) || (r.a === to.area && r.b === from.area)
      if (!match || covered.has(r.mode)) continue
      out.push({ mode: r.mode, minS: r.min_min * 60, maxS: r.max_min * 60, source: 'typical', distanceM: null, note: r.note })
      covered.add(r.mode)
    }
  }

  // 3. Routed times, widened by the trip's correction range.
  const drive = covered.has('drive') ? undefined : findLeg(ctx, from, to, 'drive')
  if (drive?.duration_s != null) {
    const [min, max] = range(drive.duration_s * ctx.factorLow, drive.duration_s * ctx.factorHigh)
    out.push({ mode: 'drive', minS: min, maxS: max, source: 'routed', distanceM: drive.distance_m })
    covered.add('drive')
  }
  const walk = covered.has('walk') ? undefined : findLeg(ctx, from, to, 'walk')
  if (walk?.duration_s != null && (walk.distance_m ?? 0) <= WALK_ROUTED_MAX_M) {
    const [min, max] = range(walk.duration_s, walk.duration_s * 1.2)
    out.push({ mode: 'walk', minS: min, maxS: max, source: 'routed', distanceM: walk.distance_m })
    covered.add('walk')
  }

  // 4. Straight-line estimates when nothing better exists (e.g. offline before legs synced).
  if (straight != null) {
    if (!covered.has('walk') && straight <= WALK_EST_MAX_M) {
      const t = ((straight * DETOUR) / 1000 / WALK_KMH) * 3600
      const [min, max] = range(t, t * 1.3)
      out.push({ mode: 'walk', minS: min, maxS: max, source: 'estimate', distanceM: straight * DETOUR })
    }
    if (!covered.has('drive') && straight > 800) {
      const t = ((straight * 1.5) / 1000 / DRIVE_EST_KMH) * 3600 + 300
      const [min, max] = range(t * ctx.factorLow, t * ctx.factorHigh)
      out.push({ mode: 'drive', minS: min, maxS: max, source: 'estimate', distanceM: straight * 1.5 })
    }
  }

  // Nobody drives 500 m through Antigua's cobbled one-way streets: if it's a short walk,
  // leave out driving unless someone specifically reported a drive time.
  const shortWalk = out.some((o) => o.mode === 'walk' && o.maxS <= SHORT_WALK_S)
  const shown = shortWalk ? out.filter((o) => o.mode !== 'drive' || o.source === 'reported') : out

  return shown.sort((x, y) => x.minS - y.minS || x.maxS - y.maxS)
}

/** Fastest option's lower bound, for sorting places by travel time. */
export function bestTime(options: TravelOption[]): number {
  return options.length ? Math.min(...options.map((o) => o.minS)) : Infinity
}

function fmt(s: number): string {
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r}` : `${h} h`
}

/** "25–40 min", "3–4 h", "1 h 50 – 2 h 40", "7 min". */
export function formatRange(minS: number, maxS: number): string {
  const lo = Math.round(minS / 60)
  const hi = Math.round(maxS / 60)
  if (lo === hi) return fmt(minS)
  if (hi < 60) return `${lo}–${hi} min`
  if (lo >= 60 && lo % 60 === 0 && hi % 60 === 0) return `${lo / 60}–${hi / 60} h`
  return `${fmt(minS)} – ${fmt(maxS)}`
}

export const MODE_LABEL: Record<TravelMode, { label: string; emoji: string }> = {
  walk: { label: 'Walk', emoji: '🚶' },
  drive: { label: 'Drive', emoji: '🚗' },
  tuktuk: { label: 'Tuk-tuk', emoji: '🛺' },
  shuttle: { label: 'Shuttle', emoji: '🚐' },
  bus: { label: 'Chicken bus', emoji: '🚌' },
  boat: { label: 'Lancha', emoji: '🚤' },
  flight: { label: 'Flight', emoji: '✈️' },
}

export const SOURCE_LABEL: Record<OptionSource, string> = {
  reported: 'reported by the group',
  typical: 'typical',
  routed: 'road route, adjusted',
  estimate: 'rough estimate',
}
