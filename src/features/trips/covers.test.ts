import { describe, expect, it } from 'vitest'
import { coverChoice, coverPhoto, destinationCovers, tripCover, TRIP_COVERS } from './covers'

const trip = (settings: Record<string, unknown> = {}) => ({ id: 'trip', settings })
const area = (name: string, lat?: number, lng?: number) => ({ name, lat, lng })
describe('destination postcard selection', () => {
  it.each([
    ['Panajachel', 14.74, -91.16, 'lake'], ['Antigua', 14.56, -90.73, 'oldtown'],
    ['Kyoto', 35.01, 135.77, 'temples'], ['Moab', 38.57, -109.55, 'canyon'],
    ['Zermatt', 45.98, 7.75, 'snow'], ['Honolulu', 21.31, -157.86, 'islands'],
    ['Marrakech', 31.63, -7.98, 'desert'], ['Tikal', 17.22, -89.62, 'jungle'],
    ['Lisbon', 38.72, -9.14, 'oldtown'], ['Sydney', -33.87, 151.21, 'coast'],
    ['Queenstown', -45.03, 168.66, 'mountains'], ['Siena', 43.32, 11.33, 'countryside'],
  ])('matches %s using selected coordinates', (name, lat, lng, cover) => {
    expect(tripCover(trip({ areas: [area(name as string, lat as number, lng as number)] }))).toBe(cover)
  })
  it('follows the first destination automatically and suggests the rest without duplicates', () => {
    const settings = { areas: [area('Kyoto', 35.01, 135.77), area('Lake District'), area('Lake Como')] }
    expect(destinationCovers(trip(settings)).covers).toEqual(['temples', 'lake'])
    expect(tripCover(trip(settings))).toBe('temples')
    expect(tripCover(trip({ ...settings, areas: [...settings.areas].reverse() }))).toBe('lake')
  })
  it('uses a city for unrecognized selected destinations and water before one is chosen', () => {
    expect(tripCover(trip({ areas: [area('Somewhere new', 0, 0)] }))).toBe('city')
    expect(tripCover(trip())).toBe('coast')
    for (const areas of [null, {}, [null, 1, {}, { name: 9 }]]) expect(tripCover(trip({ areas }))).toBe('coast')
  })
  it('keeps manual and plain covers when destinations change, and restores automatic mode', () => {
    const settings = { areas: [area('Kyoto', 35.01, 135.77)] }
    expect(tripCover(trip({ ...settings, journal_cover: 'coast' }))).toBe('coast')
    expect(tripCover(trip({ ...settings, journal_cover: 'none' }))).toBe('none')
    expect(tripCover(trip({ ...settings, journal_cover: 'auto' }))).toBe('temples')
    expect(tripCover(trip({ ...settings, journal_cover: 'invalid' }))).toBe('temples')
    expect(TRIP_COVERS.filter((cover) => cover.id !== 'none')).toHaveLength(12)
  })
  it('accepts only bounded local JPEG photos and safely falls back for bad synced settings', () => {
    const photo = 'data:image/jpeg;base64,YWJj'
    expect(coverPhoto(trip({ journal_cover_image: photo }))).toBe(photo)
    expect(coverChoice(trip({ journal_cover: 'custom', journal_cover_image: photo }))).toBe('custom')
    for (const value of [undefined, 'https://example.com/photo.jpg', 'data:image/svg+xml;base64,YWJj', `${photo}!`, 'data:image/jpeg;base64,' + 'a'.repeat(400000)]) {
      expect(coverPhoto(trip({ journal_cover_image: value }))).toBeUndefined()
      expect(tripCover(trip({ journal_cover: 'custom', journal_cover_image: value }))).toBe('coast')
    }
  })
})
