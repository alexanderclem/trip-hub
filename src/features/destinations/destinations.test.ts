import { describe, expect, it } from 'vitest'
import { areaBbox, currencyFor, toDestinations, tripAreas, type PhotonFeature } from './destinations'

const feature = (name: string, osm_value: string, coordinates: [number, number], over: Partial<PhotonFeature['properties']> = {}): PhotonFeature => ({
  geometry: { coordinates },
  properties: { name, osm_key: 'place', osm_value, state: 'Quintana Roo', country: 'Mexico', countrycode: 'MX', ...over },
})

describe('toDestinations', () => {
  it('prefers the town over the municipality of the same name', () => {
    // Real shape of a search for "Tulum": the municipality comes first and is centred inland.
    const results = toDestinations([
      feature('Tulum', 'municipality', [-87.6529306, 20.429647], { extent: [-87.995, 20.516, -87.3026, 19.7773] }),
      feature('Tulum', 'town', [-87.4627649, 20.2111662], { extent: [-87.5445, 20.2752, -87.4153, 20.1684] }),
    ])
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ name: 'Tulum', label: 'Tulum, Quintana Roo, Mexico', countryCode: 'MX', lat: 20.2112, lng: -87.4628 })
  })

  it('leaves out streets, stations and boundaries, and repeats of the same label', () => {
    const results = toDestinations([
      feature('Paris', 'city', [2.3484, 48.8535], { state: 'Île-de-France', country: 'France', countrycode: 'fr' }),
      feature('Paris', 'administrative', [2.32, 48.8589], { osm_key: 'boundary', state: 'Île-de-France', country: 'France' }),
      feature('Rue de Paris', 'residential', [2.3, 48.8], { osm_key: 'highway' }),
      feature('Paris', 'city', [2.35, 48.85], { state: 'Île-de-France', country: 'France' }),
      feature('Paris', 'town', [-95.5555, 33.6618], { state: 'Texas', country: 'United States', countrycode: 'US' }),
    ])
    expect(results.map((r) => r.label)).toEqual(['Paris, Île-de-France, France', 'Paris, Texas, United States'])
    expect(results[0]!.countryCode).toBe('FR')
  })
})

describe('areaBbox', () => {
  it('uses the place\'s own extent when it is town-sized', () => {
    // Panajachel: extent is [west, north, east, south].
    expect(areaBbox(14.7422, -91.156, [-91.164062, 14.7674483, -91.1143187, 14.7273091])).toEqual([14.7221, -91.1809, 14.7623, -91.1311])
  })

  it('never goes below village size or above a large town centre', () => {
    const tiny = areaBbox(10, 20, [19.9999, 10.0001, 20.0001, 9.9999])
    expect(tiny).toEqual([9.988, 19.988, 10.012, 20.012])
    const huge = areaBbox(48.8535, 2.3484, [2.224122, 48.902156, 2.4697602, 48.8155755])
    expect(huge[2] - huge[0]).toBeCloseTo(0.0866, 3) // its real height, under the cap
    expect(huge[3] - huge[1]).toBeCloseTo(0.14, 3) // width capped
    expect(areaBbox(10, 20)).toEqual(tiny)
  })
})

describe('tripAreas', () => {
  it('reads valid areas and ignores anything malformed', () => {
    const good = { name: 'Antigua', bbox: [14.54, -90.75, 14.575, -90.715], lat: 14.55, lng: -90.73 }
    expect(tripAreas({ settings: { areas: [good, { name: 'Bad', bbox: [1, 2, 3] }, null, 'x'] } })).toEqual([good])
    expect(tripAreas({ settings: {} })).toEqual([])
    expect(tripAreas({ settings: { areas: 'nope' } })).toEqual([])
    expect(tripAreas(undefined)).toEqual([])
  })
})

describe('currencyFor', () => {
  it('knows common destinations and leaves the rest blank', () => {
    expect(currencyFor('gt')).toBe('GTQ')
    expect(currencyFor('FR')).toBe('EUR')
    expect(currencyFor('ZZ')).toBeNull()
    expect(currencyFor(null)).toBeNull()
  })
})
