export interface LatLng {
  lat: number
  lng: number
}

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

/**
 * Pulls coordinates out of whatever people paste: a Google Maps / Apple Maps / OSM URL,
 * or plain "14.5586, -90.7295". Returns null if none are found.
 */
export function parseCoordinates(input: string): LatLng | null {
  const s = decodeURIComponent(input.trim())
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // Google place pin (most precise; check first)
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, // Google map centre
    /[?&](?:q|query|ll|sll|daddr|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, // Google/Apple params
    /[?&]mlat=(-?\d+\.\d+)&mlon=(-?\d+\.\d+)/, // openstreetmap.org marker
    /#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/, // openstreetmap.org view
    /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/, // bare "lat, lng"
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m) {
      const lat = Number(m[1])
      const lng = Number(m[2])
      if (valid(lat, lng)) return { lat, lng }
    }
  }
  return null
}

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`
}

/** Google Maps search link (no API key needed). */
export function googleMapsUrl(name: string, area: string | null, at?: LatLng | null): string {
  const q = at ? `${at.lat},${at.lng}` : [name, area].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

export function tripadvisorUrl(name: string, area: string | null): string {
  return `https://www.tripadvisor.com/Search?q=${encodeURIComponent([name, area].filter(Boolean).join(' '))}`
}
