// Place packs built with scripts/overpass-seed.ts and shipped with the app, so nobody has to
// move a JSON file onto their phone. Fetched only when someone taps "Load".
import guatemala2027 from '../../../seed/guatemala-2027/places.json?url'

export interface StarterPack {
  id: string
  label: string
  description: string
  url: string
}

export const STARTER_PACKS: StarterPack[] = [
  {
    id: 'guatemala-2027',
    label: 'Guatemala: Antigua & Lake Atitlán',
    description: 'Restaurants, lodging, sights and lancha docks from OpenStreetMap',
    url: guatemala2027,
  },
]

export async function fetchStarterPack(pack: StarterPack): Promise<unknown> {
  const res = await fetch(pack.url)
  if (!res.ok) throw new Error(`Couldn't download starter places (HTTP ${res.status})`)
  return res.json()
}
