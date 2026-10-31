import type { Trip } from '@/data/types'

export const TRIP_COVERS = [
  { id: 'coast', label: 'By the water' },
  { id: 'mountains', label: 'Into the mountains' },
  { id: 'city', label: 'Around the city' },
  { id: 'countryside', label: 'The scenic route' },
  { id: 'lake', label: 'Lakeside mornings' },
  { id: 'islands', label: 'Island time' },
  { id: 'desert', label: 'Desert light' },
  { id: 'jungle', label: 'Into the green' },
  { id: 'snow', label: 'Alpine air' },
  { id: 'oldtown', label: 'Old town wandering' },
  { id: 'canyon', label: 'Canyon country' },
  { id: 'temples', label: 'Quiet temples' },
  { id: 'none', label: 'Just the essentials' },
] as const
export type IllustratedCover = Exclude<(typeof TRIP_COVERS)[number]['id'], 'none'>
export type TripCover = IllustratedCover | 'none' | 'custom'
export type CoverChoice = TripCover | 'auto'
type CoverTrip = Pick<Trip, 'id' | 'settings'>

// Curated inspiration around destination coordinates, not claims about a place's terrain.
// The closest match wins. Coordinates also disambiguate places sharing a name.
const INSPIRATION: [number, number, IllustratedCover, number][] = [
  [14.74, -91.16, 'lake', 45], [14.56, -90.73, 'oldtown', 35], [17.22, -89.62, 'jungle', 100],
  [21.16, -86.85, 'coast', 100], [20.21, -87.47, 'coast', 90], [9.43, -84.16, 'jungle', 100],
  [21.31, -157.86, 'islands', 100], [20.8, -156.33, 'islands', 100], [-8.65, 115.22, 'islands', 100],
  [36.39, 25.46, 'islands', 80], [7.88, 98.39, 'islands', 90],
  [35.2, -111.65, 'canyon', 120], [38.57, -109.55, 'canyon', 110],
  [31.63, -7.98, 'desert', 100], [25.2, 55.27, 'desert', 100], [24.58, -3.98, 'desert', 150],
  [45.98, 7.75, 'snow', 100], [39.19, -106.82, 'snow', 70], [46.85, 9.53, 'snow', 90],
  [51.18, -115.57, 'mountains', 100], [-45.03, 168.66, 'mountains', 100], [27.72, 85.32, 'mountains', 100],
  [35.01, 135.77, 'temples', 45], [13.41, 103.87, 'temples', 60],
  [38.72, -9.14, 'oldtown', 60], [41.9, 12.5, 'oldtown', 60], [43.77, 11.26, 'oldtown', 45],
  [43.32, 11.33, 'countryside', 40], [44.84, -0.58, 'countryside', 80],
  [47.56, 13.65, 'lake', 60], [39.1, -120.03, 'lake', 60], [45.99, 9.26, 'lake', 40],
  [32.72, -117.16, 'coast', 70], [41.39, 2.17, 'coast', 70], [-33.87, 151.21, 'coast', 80],
]

function destinationCover(area: { name: string; lat?: unknown; lng?: unknown }): IllustratedCover {
  if (typeof area.lat === 'number' && typeof area.lng === 'number' && Number.isFinite(area.lat) && Number.isFinite(area.lng)) {
    const latitude = area.lat, longitude = area.lng
    const nearby = INSPIRATION.map(([lat, lng, cover, radius]) => {
      const dLat = (latitude - lat) * Math.PI / 180, dLng = (longitude - lng) * Math.PI / 180
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
      return { cover, radius, distance: 12742 * Math.asin(Math.sqrt(Math.min(1, h))) }
    }).filter((place) => place.distance <= place.radius).sort((a, b) => a.distance - b.distance)
    if (nearby[0]) return nearby[0].cover
  }
  const name = area.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/\b(lake|lago|loch)\b/.test(name)) return 'lake'
  if (/\b(island|islands|isla|islas|isle|maui|maldives)\b/.test(name)) return 'islands'
  if (/\b(beach|coast|playa|seaside)\b/.test(name)) return 'coast'
  if (/\b(alps|ski|alpine)\b/.test(name)) return 'snow'
  if (/\b(canyon|mesa)\b/.test(name)) return 'canyon'
  if (/\b(desert|sahara)\b/.test(name)) return 'desert'
  if (/\b(mount|mountain|mountains|highlands)\b/.test(name)) return 'mountains'
  if (/\b(forest|jungle|rainforest)\b/.test(name)) return 'jungle'
  if (/\b(valley|countryside|vineyard)\b/.test(name)) return 'countryside'
  return 'city'
}

export function destinationCovers(trip: CoverTrip): { covers: IllustratedCover[]; destinations: string[] } {
  const raw = trip.settings?.areas
  const areas = Array.isArray(raw) ? raw.filter((area): area is { name: string; lat?: unknown; lng?: unknown } =>
    !!area && typeof area === 'object' && typeof area.name === 'string' && !!area.name.trim()) : []
  const covers = [...new Set(areas.map(destinationCover))]
  return { covers: covers.length ? covers : ['coast'], destinations: areas.map((area) => area.name) }
}

export function coverPhoto(trip: CoverTrip): string | undefined {
  const photo = trip.settings?.journal_cover_image
  return typeof photo === 'string' && photo.length <= 400000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo) ? photo : undefined
}

export function coverChoice(trip: CoverTrip): CoverChoice {
  const saved = trip.settings?.journal_cover
  if (saved === 'auto') return 'auto'
  if (saved === 'custom' && coverPhoto(trip)) return 'custom'
  if (TRIP_COVERS.some((cover) => cover.id === saved)) return saved as TripCover
  return 'auto'
}

export function tripCover(trip: CoverTrip): TripCover {
  const choice = coverChoice(trip)
  return choice === 'auto' ? destinationCovers(trip).covers[0]! : choice
}
