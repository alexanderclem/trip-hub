// Place packs built with scripts/overpass-seed.ts and shipped with the app, so nobody has to
// move a JSON file onto their phone. Fetched only when someone taps "Load".
import guatemala2027 from '../../../seed/guatemala-2027/places.json?url'
import type { OfflinePack } from '@/features/map/offline/packs'

export interface StarterPack {
  id: string
  label: string
  description: string
  url: string
  /** Offline map for the same region (files in public/packs, cut by scripts/basemap-extract.ps1). */
  map?: OfflinePack
}

export const STARTER_PACKS: StarterPack[] = [
  {
    id: 'guatemala-2027',
    label: 'Guatemala: Antigua & Lake Atitlán',
    description: 'Restaurants, lodging, sights and lancha docks from OpenStreetMap',
    url: guatemala2027,
    map: {
      id: 'guatemala-2027',
      label: 'Guatemala: Antigua, Lake Atitlán, airport + country overview',
      version: '20260930',
      overview: { name: 'guatemala-2027-overview.pmtiles', url: '/packs/guatemala-2027-overview.pmtiles', bytes: 6449250 },
      detail: { name: 'guatemala-2027-detail.pmtiles', url: '/packs/guatemala-2027-detail.pmtiles', bytes: 9197744 },
    },
  },
]

export async function fetchStarterPack(pack: StarterPack): Promise<unknown> {
  const res = await fetch(pack.url)
  if (!res.ok) throw new Error(`Couldn't download starter places (HTTP ${res.status})`)
  return res.json()
}
