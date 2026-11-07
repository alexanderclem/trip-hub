import { describe, expect, it, vi } from 'vitest'
import type { Place } from '@/data/types'
import type { Bbox } from './osm'
import { findKnownPlace, locatePlace, needsPin, sameName, searchOsm, searchRegion } from './locate'

const place = (over: Partial<Place>): Place => ({ id: 'p', trip_id: 't', name: 'Place', category: 'activity', tags: [], lat: null, lng: null, address: null, area: null,
  status: 'planned', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'suggestion', ...over })
const antigua: Bbox = [14.53, -90.76, 14.58, -90.71]
const photon = (features: unknown[]) => vi.fn(async (_url: string) => Response.json({ features })) as unknown as typeof fetch & ReturnType<typeof vi.fn>
const hit = (name: string, lat: number, lng: number, extra: Record<string, unknown> = {}) => ({ geometry: { coordinates: [lng, lat] }, properties: { name, osm_type: 'N', osm_id: 42, ...extra } })

describe('sameName', () => {
  it('ignores case, accents, punctuation and a missing hotel prefix', () => {
    expect(sameName('Café Sombrerón', 'cafe sombreron')).toBe(true)
    expect(sameName('Casa Santo Domingo', 'Hotel Casa Santo Domingo')).toBe(true)
    expect(sameName('Cerro de la Cruz', 'Cerro de La Cruz Lookout')).toBe(true)
  })
  it('does not match on one shared word', () => {
    expect(sameName('Market', 'Mercado Central Market')).toBe(false)
    expect(sameName('Lake Atitlán', 'Lake Como')).toBe(false)
  })
})

describe('findKnownPlace', () => {
  it('prefers an exact name, then one with a location', () => {
    const pool = [place({ id: 'a', name: 'Hotel Casa Santo Domingo' }), place({ id: 'b', name: 'Casa Santo Domingo', lat: 14.5, lng: -90.7 }), place({ id: 'c', name: 'Casa Santo Domingo' })]
    expect(findKnownPlace('Casa Santo Domingo', pool)?.id).toBe('b')
    expect(findKnownPlace('Casa Santo Domingo', pool, 'b')?.id).toBe('c')
    expect(findKnownPlace('Somewhere else', pool)).toBeNull()
  })
})

describe('searchRegion', () => {
  it('uses the trip destinations, padded', () => {
    const r = searchRegion({ settings: { areas: [{ name: 'Antigua', bbox: antigua, lat: 14.55, lng: -90.73 }] } } as never, [])!
    expect(r[0]).toBeLessThan(antigua[0]); expect(r[3]).toBeGreaterThan(antigua[3])
  })
  it('falls back to where the trip’s places are, and to nothing', () => {
    expect(searchRegion(null, [{ lat: 14.5, lng: -90.7 }, { lat: 14.7, lng: -91.2 }])).toEqual([14.45, -91.325, 14.75, -90.575])
    expect(searchRegion(null, [{ lat: null, lng: null }])).toBeNull()
  })
})

describe('searchOsm', () => {
  it('takes the result whose name matches, inside the area, with its OSM id and address', async () => {
    const fetcher = photon([hit('Other Café', 14.55, -90.73), hit('Café Sombrerón', 14.556, -90.734, { street: '4a Avenida Norte', housenumber: '7', city: 'Antigua Guatemala' })])
    expect(await searchOsm({ name: 'Cafe Sombreron' }, antigua, fetcher)).toEqual({ lat: 14.556, lng: -90.734, address: '4a Avenida Norte 7, Antigua Guatemala', osm: 'node/42', name: 'Café Sombrerón' })
    const url = new URL(fetcher.mock.calls[0]![0] as string)
    expect(url.searchParams.get('bbox')).toBe('-90.76,14.53,-90.71,14.58')
  })
  it('refuses a same-named place outside the area or a different name', async () => {
    expect(await searchOsm({ name: 'Café Sombrerón' }, antigua, photon([hit('Café Sombrerón', 40.7, -74)]))).toBeNull()
    expect(await searchOsm({ name: 'Café Sombrerón' }, antigua, photon([hit('Parque Central', 14.55, -90.73)]))).toBeNull()
  })
  it('falls back to the address for an event venue', async () => {
    const fetcher = vi.fn(async (url: string) => Response.json({ features: url.includes('Teatro') ? [hit('Teatro', 14.55, -90.73)] : [] })) as unknown as typeof fetch
    expect((await searchOsm({ name: 'Jazz Night', address: 'Teatro Municipal' }, antigua, fetcher))?.lat).toBe(14.55)
  })
})

describe('locatePlace', () => {
  it('copies the pin, address and OSM id of the trip’s own place first, without searching', async () => {
    const fetcher = photon([])
    const pool = place({ id: 'osm', name: 'Café Sombrerón', lat: 14.556, lng: -90.734, address: '4a Av', status: 'catalog', external_ids: { osm: 'node/9' }, source: 'osm' })
    const patch = await locatePlace(place({ name: 'Cafe Sombreron' }), [pool], antigua, fetcher)
    expect(patch).toMatchObject({ lat: 14.556, lng: -90.734, address: '4a Av', external_ids: { osm: 'node/9', located: 'trip' } })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('marks a place it can’t find so no phone keeps asking', async () => {
    const patch = await locatePlace(place({ name: 'Nowhere' }), [], antigua, photon([]))
    expect(patch).toEqual({ external_ids: { located: 'none' } })
    expect(needsPin({ ...place({}), ...patch })).toBe(false)
  })
  it('only looks for picks without a pin', () => {
    expect(needsPin(place({}))).toBe(true)
    expect(needsPin(place({ status: 'catalog' }))).toBe(false)
    expect(needsPin(place({ lat: 1, lng: 2 }))).toBe(false)
  })
})
