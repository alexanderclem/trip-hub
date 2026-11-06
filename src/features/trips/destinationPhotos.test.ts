import { describe, expect, it } from 'vitest'
import { DESTINATION_PHOTOS, destinationPhoto, photoForArea, type DestinationPhoto } from './destinationPhotos'
import { autoPhoto } from './covers'

const photo = (id: string, name: string, lat: number, lng: number, radius: number, aliases: string[] = []): DestinationPhoto =>
  ({ id, name, aliases, lat, lng, radius, width: 1280, height: 853, author: 'A. Photographer', license: 'CC BY-SA 4.0', licenseUrl: null, source: 'https://commons.wikimedia.org/' })
const list = [
  photo('antigua-guatemala', 'Antigua Guatemala', 14.5586, -90.7295, 15, ['antigua']),
  photo('lake-atitlan', 'Lake Atitlán', 14.69, -91.2, 25, ['atitlan', 'panajachel']),
  photo('paris', 'Paris', 48.8566, 2.3522, 30),
]

describe('destination photos', () => {
  it('matches by coordinates, nearest first', () => {
    expect(photoForArea({ name: 'Panajachel', lat: 14.74, lng: -91.16 }, list)?.id).toBe('lake-atitlan')
    expect(photoForArea({ name: 'Antigua', lat: 14.56, lng: -90.73 }, list)?.id).toBe('antigua-guatemala')
  })

  it('lets coordinates overrule a familiar name', () => {
    // Antigua and Barbuda, not Antigua Guatemala; Paris, Texas, not Paris, France.
    expect(photoForArea({ name: 'Antigua', lat: 17.07, lng: -61.8 }, list)).toBeUndefined()
    expect(photoForArea({ name: 'Paris, Texas', lat: 33.66, lng: -95.56 }, list)).toBeUndefined()
  })

  it('matches name-only destinations by name or alias, ignoring accents and the region after a comma', () => {
    expect(photoForArea({ name: 'Lake Atitlan' }, list)?.id).toBe('lake-atitlan')
    expect(photoForArea({ name: 'panajachel, Sololá' }, list)?.id).toBe('lake-atitlan')
    expect(photoForArea({ name: 'Paris, France' }, list)?.id).toBe('paris')
    expect(photoForArea({ name: 'Somewhere else' }, list)).toBeUndefined()
  })

  it('uses the first listed destination that has a photo, and only for an automatic cover', () => {
    const areas = [{ name: 'Nowhere in particular' }, { name: 'Paris' }]
    const first = DESTINATION_PHOTOS.find((p) => p.id === 'paris')
    expect(destinationPhoto({ areas })?.id).toBe(first ? 'paris' : undefined)
    expect(destinationPhoto({ areas: 'not a list' })).toBeUndefined()
    expect(autoPhoto({ id: 't', settings: { areas, journal_cover: 'mountains' } })).toBeUndefined()
  })

  it('ships 100 credited, freely licensed photos', () => {
    expect(DESTINATION_PHOTOS).toHaveLength(100)
    expect(new Set(DESTINATION_PHOTOS.map((p) => p.id)).size).toBe(100)
    for (const p of DESTINATION_PHOTOS) {
      expect(p.author, p.id).not.toBe('')
      expect(p.license, p.id).toMatch(/^(CC0|Public domain|PD|CC BY|CC-BY|Attribution|GFDL|FAL)/i)
      expect(p.source, p.id).toMatch(/^https:\/\/commons\.wikimedia\.org\//)
    }
  })
})
