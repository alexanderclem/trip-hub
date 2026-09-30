import { describe, expect, it } from 'vitest'
import { computeLegs, walkGroups, type Pt } from './routing'

const antigua: Pt[] = [
  { id: 'cafe', lat: 14.5572, lng: -90.7317 },
  { id: 'hotel', lat: 14.5581, lng: -90.7352 },
]
const pana: Pt = { id: 'pana', lat: 14.7404, lng: -91.159 }
const all = [...antigua, pana]

type Call = { url: string; body?: { sources: number[]; locations: number[][] } }

function fakeFetch(handler: (c: Call) => { status?: number; body: unknown }) {
  const calls: Call[] = []
  const f = (async (url: string | URL, init?: RequestInit) => {
    const call = { url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined }
    calls.push(call)
    const r = handler(call)
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 })
  }) as typeof fetch
  return { f, calls }
}

/** A matrix answer where duration = 100 × (|i − j|) seconds for every source row. */
function matrixFor(n: number, sources: number[]) {
  const row = (i: number) => Array.from({ length: n }, (_, j) => 100 * Math.abs(i - j))
  return { durations: sources.map(row), distances: sources.map((i) => row(i).map((d) => d * 10)) }
}

describe('walkGroups', () => {
  it('groups nearby places and drops singletons', () => {
    const g = walkGroups(all, 4000)
    expect(g).toHaveLength(1)
    expect(g[0]!.map((p) => p.id).sort()).toEqual(['cafe', 'hotel'])
  })
})

describe('computeLegs', () => {
  it('uses OpenRouteService when a key is set: drive for all pairs, walk only nearby', async () => {
    const { f, calls } = fakeFetch((c) => ({ body: matrixFor(c.body!.locations.length, c.body!.sources) }))
    const r = await computeLegs(all, { orsKey: 'k', fetchFn: f })
    expect(r.providers).toEqual(['ors'])
    expect(calls.map((c) => c.url.split('/').pop())).toEqual(['driving-car', 'foot-walking'])
    expect(r.legs.filter((l) => l.mode === 'drive')).toHaveLength(6) // 3 × 2 directed pairs
    expect(r.legs.filter((l) => l.mode === 'walk').map((l) => `${l.from}>${l.to}`).sort()).toEqual(['cafe>hotel', 'hotel>cafe'])
    expect(r.legs.find((l) => l.from === 'cafe' && l.to === 'pana' && l.mode === 'drive')).toMatchObject({ duration_s: 200, distance_m: 2000, source: 'ors' })
    expect(r.warnings).toEqual([])
  })

  it('falls back to OSRM when ORS fails, and says so', async () => {
    const { f, calls } = fakeFetch((c) => {
      if (c.url.includes('openrouteservice')) return { status: 403, body: { error: 'quota' } }
      const n = c.url.split('/').pop()!.split('?')[0]!.split(';').length
      return { body: { code: 'Ok', ...matrixFor(n, [...Array(n).keys()]) } }
    })
    const r = await computeLegs(all, { orsKey: 'k', fetchFn: f })
    expect(r.providers).toEqual(['osrm'])
    expect(r.legs.every((l) => l.source === 'osrm')).toBe(true)
    expect(r.legs).toHaveLength(8)
    expect(r.warnings.join(' ')).toMatch(/OpenRouteService drive HTTP 403.*falling back/)
    expect(calls.some((c) => c.url.includes('routed-foot'))).toBe(true)
  })

  it('without a key goes straight to OSRM', async () => {
    const { f, calls } = fakeFetch((c) => {
      const n = c.url.split('/').pop()!.split('?')[0]!.split(';').length
      return { body: { code: 'Ok', ...matrixFor(n, [...Array(n).keys()]) } }
    })
    const r = await computeLegs(antigua, { fetchFn: f })
    expect(calls.every((c) => !c.url.includes('openrouteservice'))).toBe(true)
    expect(r.warnings[0]).toMatch(/ORS_API_KEY is not set/)
    expect(r.legs).toHaveLength(4)
  })

  it('skips unroutable pairs (null durations)', async () => {
    const { f } = fakeFetch(() => ({ body: { durations: [[0, null], [null, 0]], distances: null } }))
    const r = await computeLegs(antigua, { orsKey: 'k', fetchFn: f })
    expect(r.legs).toEqual([])
  })

  it('splits big requests to stay under the ORS routes-per-request limit', async () => {
    const many: Pt[] = Array.from({ length: 100 }, (_, i) => ({ id: `p${i}`, lat: 14 + i * 0.05, lng: -90 }))
    const { f, calls } = fakeFetch((c) => ({ body: matrixFor(c.body!.locations.length, c.body!.sources) }))
    const r = await computeLegs(many, { orsKey: 'k', fetchFn: f, walkRadiusM: 1 })
    const drive = calls.filter((c) => c.url.endsWith('driving-car'))
    expect(drive.length).toBeGreaterThan(1)
    for (const c of drive) expect(c.body!.sources.length * c.body!.locations.length).toBeLessThanOrEqual(3500)
    expect(r.legs).toHaveLength(100 * 99)
  })

  it('does nothing for fewer than two places', async () => {
    const r = await computeLegs([antigua[0]!], { orsKey: 'k' })
    expect(r.legs).toEqual([])
  })
})
