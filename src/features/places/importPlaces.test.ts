import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { db } from '@/data/db'
import { importPlaces } from './importPlaces'

const TRIP = '00000000-0000-4000-8000-0000000000aa'
const seed = JSON.parse(readFileSync('seed/guatemala-2027/places.json', 'utf8'))

describe('importPlaces', () => {
  it('imports the Guatemala seed into the idea pool, and re-importing adds nothing', async () => {
    const first = await importPlaces(TRIP, seed, 'ana')
    expect(first.added).toBe(seed.places.length)
    expect(await db.places.where('[trip_id+status]').equals([TRIP, 'catalog']).count()).toBe(seed.places.length)

    const again = await importPlaces(TRIP, seed, 'ben')
    expect(again).toEqual({ added: 0, skipped: seed.places.length, routesAdded: 0 })
    expect(await db.places.count()).toBe(seed.places.length)
  }, 30_000)

  it('keeps edits people made to imported places', async () => {
    const one = { places: [seed.places[0]] }
    const trip = '00000000-0000-4000-8000-0000000000bb'
    await importPlaces(trip, one, 'ana')
    const p = (await db.places.where('trip_id').equals(trip).first())!
    await db.places.update(p.id, { status: 'shortlist', notes: 'Must try' })
    await importPlaces(trip, one, 'ana')
    expect((await db.places.get(p.id))!.notes).toBe('Must try')
  })

  it("adds the pack's lancha/shuttle routes to the trip once, keeping the group's edits", async () => {
    const trip = '00000000-0000-4000-8000-0000000000cc'
    await db.trips.put({
      id: trip, name: 'T', timezone: 'America/Guatemala', start_date: null, end_date: null, base_currency: 'USD',
      local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'x',
      settings: { area_routes: [{ a: 'San Pedro La Laguna', b: 'Panajachel', mode: 'boat', min_min: 30, max_min: 30, note: 'ours' }] },
    })
    const r = await importPlaces(trip, seed, 'ana')
    expect(r.routesAdded).toBe(seed.area_routes.length - 1) // Panajachel↔San Pedro boat already existed
    const routes = (await db.trips.get(trip))!.settings.area_routes as { note?: string; a: string; b: string; mode: string }[]
    expect(routes.find((x) => x.mode === 'boat' && [x.a, x.b].includes('Panajachel') && [x.a, x.b].includes('San Pedro La Laguna'))!.note).toBe('ours')
    expect((await importPlaces(trip, seed, 'ana')).routesAdded).toBe(0)
  }, 30_000)

  it('rejects files that are not places files', async () => {
    await expect(importPlaces(TRIP, { hello: 1 }, 'ana')).rejects.toThrow(/Not a Stowaway places file/)
  })
})
