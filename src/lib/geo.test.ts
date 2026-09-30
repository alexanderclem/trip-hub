import { describe, expect, it } from 'vitest'
import { formatDistance, haversineM, parseCoordinates } from './geo'

describe('parseCoordinates', () => {
  it.each([
    ['https://www.google.com/maps/place/Caf%C3%A9+Sky/@14.5566,-90.7338,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d14.5561!4d-90.7331', 14.5561, -90.7331],
    ['https://www.google.com/maps/@14.5566,-90.7338,15z', 14.5566, -90.7338],
    ['https://www.google.com/maps/search/?api=1&query=14.6907,-91.2025', 14.6907, -91.2025],
    ['https://maps.apple.com/?ll=14.5586,-90.7295&q=Antigua', 14.5586, -90.7295],
    ['https://www.openstreetmap.org/?mlat=14.5586&mlon=-90.7295#map=17/14.5586/-90.7295', 14.5586, -90.7295],
    ['https://www.openstreetmap.org/#map=15/14.6907/-91.2025', 14.6907, -91.2025],
    ['14.5586, -90.7295', 14.5586, -90.7295],
  ])('%s', (input, lat, lng) => {
    expect(parseCoordinates(input)).toEqual({ lat, lng })
  })

  it('returns null when there are no coordinates', () => {
    expect(parseCoordinates('https://www.google.com/maps/place/Antigua')).toBeNull()
    expect(parseCoordinates('hello')).toBeNull()
    expect(parseCoordinates('95.0, 10.0')).toBeNull()
  })
})

describe('haversine', () => {
  it('Antigua to Panajachel is about 50 km as the crow flies', () => {
    const d = haversineM({ lat: 14.5586, lng: -90.7295 }, { lat: 14.7404, lng: -91.1590 })
    expect(d).toBeGreaterThan(48_000)
    expect(d).toBeLessThan(52_000)
    expect(formatDistance(d)).toMatch(/^\d+ km$/)
  })

  it('formats short distances in metres', () => {
    expect(formatDistance(347)).toBe('350 m')
    expect(formatDistance(2345)).toBe('2.3 km')
  })
})
