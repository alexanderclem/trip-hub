// Distance/duration matrices between trip places. Pure (only uses the fetch passed in), so it
// runs in the Edge Function and in unit tests alike.
//
// Providers, in order: OpenRouteService (free key, generous matrix limits, results may be
// stored) → the public OSRM servers (no key; best-effort; fallback only).

export interface Pt {
  id: string
  lat: number
  lng: number
}

export type Mode = 'drive' | 'walk'
export type Provider = 'ors' | 'osrm'

export interface Leg {
  from: string
  to: string
  mode: Mode
  distance_m: number | null
  duration_s: number
  source: Provider
}

export interface ComputeOptions {
  orsKey?: string
  fetchFn?: typeof fetch
  /** Places closer than this (straight line) also get walking times. */
  walkRadiusM?: number
}

export interface ComputeResult {
  legs: Leg[]
  providers: Provider[]
  warnings: string[]
}

const ORS_MAX_ROUTES = 3500 // ORS matrix limit: sources × destinations per request
const OSRM_MAX_POINTS = 90

const ORS_PROFILE: Record<Mode, string> = { drive: 'driving-car', walk: 'foot-walking' }
const OSRM_BASE: Record<Mode, string> = {
  drive: 'https://router.project-osrm.org/table/v1/driving',
  walk: 'https://routing.openstreetmap.de/routed-foot/table/v1/driving',
}

export function haversineM(a: Pt, b: Pt): number {
  const R = 6_371_000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Groups points into clusters where each point is within `radius` of another in the group. */
export function walkGroups(points: Pt[], radius: number): Pt[][] {
  const parent = points.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (haversineM(points[i]!, points[j]!) <= radius) parent[find(i)] = find(j)
    }
  }
  const groups = new Map<number, Pt[]>()
  points.forEach((p, i) => {
    const r = find(i)
    groups.set(r, [...(groups.get(r) ?? []), p])
  })
  return [...groups.values()].filter((g) => g.length > 1)
}

interface Matrix {
  durations: (number | null)[][]
  distances: (number | null)[][] | null
}

async function orsMatrix(f: typeof fetch, key: string, mode: Mode, pts: Pt[], sources: number[]): Promise<Matrix> {
  const res = await f(`https://api.openrouteservice.org/v2/matrix/${ORS_PROFILE[mode]}`, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      locations: pts.map((p) => [p.lng, p.lat]),
      sources,
      metrics: ['duration', 'distance'],
      units: 'm',
    }),
  })
  if (!res.ok) throw new Error(`OpenRouteService ${mode} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = (await res.json()) as { durations?: (number | null)[][]; distances?: (number | null)[][] }
  if (!j.durations) throw new Error(`OpenRouteService ${mode}: no durations in response`)
  return { durations: j.durations, distances: j.distances ?? null }
}

async function osrmMatrix(f: typeof fetch, mode: Mode, pts: Pt[], sources: number[]): Promise<Matrix> {
  const coords = pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
  const url = `${OSRM_BASE[mode]}/${coords}?annotations=duration,distance&sources=${sources.join(';')}`
  const res = await f(url, { headers: { 'User-Agent': 'TripHub/0.1 (small private trip planner)' } })
  if (!res.ok) throw new Error(`OSRM ${mode} HTTP ${res.status}`)
  const j = (await res.json()) as { code: string; durations?: (number | null)[][]; distances?: (number | null)[][] }
  if (j.code !== 'Ok' || !j.durations) throw new Error(`OSRM ${mode}: ${j.code}`)
  return { durations: j.durations, distances: j.distances ?? null }
}

function chunks(n: number, size: number): number[][] {
  const out: number[][] = []
  for (let i = 0; i < n; i += size) out.push(Array.from({ length: Math.min(size, n - i) }, (_, k) => i + k))
  return out
}

async function matrixLegs(
  f: typeof fetch,
  mode: Mode,
  pts: Pt[],
  orsKey: string | undefined,
  providers: Set<Provider>,
  warnings: string[],
): Promise<Leg[]> {
  const legs: Leg[] = []
  const push = (m: Matrix, sources: number[], source: Provider) => {
    sources.forEach((si, row) => {
      pts.forEach((to, di) => {
        if (si === di) return
        const d = m.durations[row]?.[di]
        if (d == null) return // unroutable pair
        const dist = m.distances?.[row]?.[di]
        legs.push({ from: pts[si]!.id, to: to.id, mode, duration_s: Math.round(d), distance_m: dist == null ? null : Math.round(dist), source })
      })
    })
  }

  if (orsKey) {
    try {
      // Keep each request under ORS's routes-per-request limit by splitting the sources.
      const perRequest = Math.max(1, Math.floor(ORS_MAX_ROUTES / pts.length))
      for (const sources of chunks(pts.length, perRequest)) push(await orsMatrix(f, orsKey, mode, pts, sources), sources, 'ors')
      providers.add('ors')
      return legs
    } catch (e) {
      warnings.push(`${e instanceof Error ? e.message : String(e)}; falling back to OSRM`)
      legs.length = 0
    }
  }
  if (pts.length > OSRM_MAX_POINTS) {
    warnings.push(`Too many places (${pts.length}) for the public OSRM server; add an OpenRouteService key`)
    return legs
  }
  push(await osrmMatrix(f, mode, pts, pts.map((_, i) => i)), pts.map((_, i) => i), 'osrm')
  providers.add('osrm')
  return legs
}

export async function computeLegs(points: Pt[], opts: ComputeOptions = {}): Promise<ComputeResult> {
  const f = opts.fetchFn ?? fetch
  const providers = new Set<Provider>()
  const warnings: string[] = []
  const legs: Leg[] = []
  if (!opts.orsKey) warnings.push('ORS_API_KEY is not set; using the public OSRM server')
  if (points.length < 2) return { legs, providers: [], warnings }

  legs.push(...(await matrixLegs(f, 'drive', points, opts.orsKey, providers, warnings)))
  for (const group of walkGroups(points, opts.walkRadiusM ?? 4000)) {
    try {
      legs.push(...(await matrixLegs(f, 'walk', group, opts.orsKey, providers, warnings)))
    } catch (e) {
      warnings.push(`walking times: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { legs, providers: [...providers], warnings }
}
