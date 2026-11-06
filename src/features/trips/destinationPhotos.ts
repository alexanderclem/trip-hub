import photos from './destination-photos.json'

/** A freely licensed photo of a popular destination, shipped with the app (scripts/fetch-destination-photos.ts). */
export type DestinationPhoto = {
  id: string; name: string; aliases: string[]; radius: number; lat: number; lng: number
  width: number; height: number; author: string; license: string; licenseUrl: string | null; source: string
}
export const DESTINATION_PHOTOS = photos as DestinationPhoto[]

type Area = { name: string; lat?: unknown; lng?: unknown }
const norm = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const dLat = (bLat - aLat) * Math.PI / 180, dLng = (bLng - aLng) * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)))
}

/**
 * The photo for one destination. Coordinates decide when the area has them (the nearest photo
 * whose radius covers it, so "Antigua" in Guatemala never gets Antigua and Barbuda); a name-only
 * area matches a photo's name or alias, compared on the part before the first comma.
 */
export function photoForArea(area: Area, list: DestinationPhoto[] = DESTINATION_PHOTOS): DestinationPhoto | undefined {
  if (typeof area.lat === 'number' && typeof area.lng === 'number' && Number.isFinite(area.lat) && Number.isFinite(area.lng)) {
    const { lat, lng } = area as { lat: number; lng: number }
    return list.map((photo) => ({ photo, d: distanceKm(lat, lng, photo.lat, photo.lng) }))
      .filter(({ photo, d }) => d <= photo.radius).sort((a, b) => a.d - b.d)[0]?.photo
  }
  const name = norm(area.name.split(',')[0] ?? '')
  if (!name) return undefined
  return list.find((photo) => norm(photo.name) === name || photo.aliases.some((alias) => norm(alias) === name))
}

/** The first of the trip's destinations that has a photo, in the order the group listed them. */
export function destinationPhoto(settings: Record<string, unknown> | null | undefined): DestinationPhoto | undefined {
  const raw = settings?.areas
  if (!Array.isArray(raw)) return undefined
  for (const area of raw) {
    if (!area || typeof area !== 'object' || typeof (area as Area).name !== 'string') continue
    const photo = photoForArea(area as Area)
    if (photo) return photo
  }
  return undefined
}

export const photoCredit = (photo: DestinationPhoto) => `Photo: ${photo.author} · ${photo.license}`
