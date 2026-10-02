import { describe, expect, it } from 'vitest'
import { categoryOf, overpassQuery, toSeedPlaces, type OsmElement } from './osm'

describe('categoryOf', () => {
  it('sorts common tags, first match winning', () => {
    expect(categoryOf({ tourism: 'hotel' })).toBe('lodging')
    expect(categoryOf({ amenity: 'bar' })).toBe('drink')
    expect(categoryOf({ amenity: 'cafe' })).toBe('food')
    expect(categoryOf({ shop: 'bakery' })).toBe('food')
    expect(categoryOf({ historic: 'ruins' })).toBe('sight')
    expect(categoryOf({ man_made: 'pier', name: 'Muelle' })).toBe('transport')
    expect(categoryOf({ aeroway: 'aerodrome', tourism: 'attraction' })).toBe('flight')
    expect(categoryOf({ amenity: 'bank' })).toBeNull()
  })
})

describe('overpassQuery', () => {
  it('asks for the box as south,west,north,east', () => {
    const q = overpassQuery([14.54, -90.75, 14.575, -90.715], 25)
    expect(q).toContain('[timeout:25]')
    expect(q).toContain('(14.54,-90.75,14.575,-90.715)')
    expect(q.trim().endsWith('out center tags;')).toBe(true)
  })
})

describe('toSeedPlaces', () => {
  const elements: OsmElement[] = [
    { type: 'node', id: 1, lat: 14.5571234567, lon: -90.7334, tags: { name: 'Café Uno', amenity: 'cafe', cuisine: 'coffee_shop;breakfast', 'addr:street': '5a Avenida', 'addr:housenumber': '12', 'addr:city': 'Antigua', 'contact:phone': ' 555 ', website: 'https://uno.test' } },
    { type: 'way', id: 2, center: { lat: 14.56, lon: -90.73 }, tags: { name: 'Hotel Dos', tourism: 'hotel' } },
    { type: 'node', id: 3, lat: 14.56, lon: -90.73, tags: { amenity: 'cafe' } }, // no name
    { type: 'node', id: 4, lat: 14.56, lon: -90.73, tags: { name: 'Bank', amenity: 'bank' } }, // no category
    { type: 'relation', id: 5, tags: { name: 'Nowhere', tourism: 'museum' } }, // no position
  ]

  it('keeps named, located places it has a category for', () => {
    const places = toSeedPlaces(elements, 'Antigua')
    expect(places.map((p) => p.osm_id)).toEqual(['node/1', 'way/2'])
    expect(places[0]).toEqual({
      osm_id: 'node/1', name: 'Café Uno', category: 'food', lat: 14.557123, lng: -90.7334, area: 'Antigua',
      address: '5a Avenida 12, Antigua', phone: '555', website: 'https://uno.test', opening_hours: null,
      tags: ['coffee_shop', 'breakfast', 'cafe'],
    })
    expect(places[1]).toMatchObject({ category: 'lodging', lat: 14.56, lng: -90.73, address: null })
  })

  it('drops places centred outside the box when one is given', () => {
    const reserve: OsmElement = { type: 'relation', id: 9, center: { lat: 15.2, lon: -90.1 }, tags: { name: 'Big reserve', leisure: 'nature_reserve' } }
    expect(toSeedPlaces([...elements, reserve], 'Antigua').map((p) => p.osm_id)).toContain('relation/9')
    expect(toSeedPlaces([...elements, reserve], 'Antigua', new Set(), [14.54, -90.75, 14.575, -90.715]).map((p) => p.osm_id)).toEqual(['node/1', 'way/2'])
  })

  it('keeps a place in two overlapping areas only once', () => {
    const seen = new Set<string>()
    expect(toSeedPlaces(elements, 'Antigua', seen)).toHaveLength(2)
    expect(toSeedPlaces(elements, 'Next door', seen)).toHaveLength(0)
  })
})
