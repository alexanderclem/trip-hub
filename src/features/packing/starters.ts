// Suggested packing items for any destination, plus a few that depend on the trip's weather.
// Keys are part of each item's stable id: don't rename them.

import type { PackingKind } from '@/data/types'
import type { DailyWeather } from '@/lib/weather'

export interface Starter {
  key: string
  title: string
  kind: PackingKind
  category: string
}

const BASE: Starter[] = [
  { key: 'passport', title: 'Passport', kind: 'everyone', category: 'Documents' },
  { key: 'id-cards', title: 'Driver’s licence or ID, bank cards', kind: 'everyone', category: 'Documents' },
  { key: 'insurance', title: 'Travel insurance details', kind: 'everyone', category: 'Documents' },
  { key: 'cash', title: 'Some cash in small notes', kind: 'everyone', category: 'Documents' },
  { key: 'meds', title: 'Personal medication', kind: 'everyone', category: 'Health' },
  { key: 'charger', title: 'Phone charger and cable', kind: 'everyone', category: 'Tech' },
  { key: 'power-bank', title: 'Power bank', kind: 'everyone', category: 'Tech' },
  { key: 'adapter', title: 'Plug adapter (check the socket type)', kind: 'everyone', category: 'Tech' },
  { key: 'water-bottle', title: 'Reusable water bottle', kind: 'everyone', category: 'Gear' },
  { key: 'day-bag', title: 'Day bag', kind: 'everyone', category: 'Gear' },
  { key: 'walking-shoes', title: 'Comfortable walking shoes', kind: 'everyone', category: 'Clothes' },
  { key: 'toiletries', title: 'Toiletries', kind: 'everyone', category: 'Toiletries' },
  { key: 'first-aid', title: 'First-aid kit', kind: 'group', category: 'Health' },
  { key: 'speaker', title: 'Bluetooth speaker', kind: 'group', category: 'Tech' },
  { key: 'cards-game', title: 'Card or travel game', kind: 'group', category: 'Gear' },
  { key: 'power-strip', title: 'Power strip', kind: 'group', category: 'Tech' },
]

/** The starter list, with extras for rain, cold or heat when the weather for the trip suggests them. */
export function suggestedStarters(days: DailyWeather[]): Starter[] {
  const out = [...BASE]
  if (days.some((d) => (d.rainPct ?? 0) >= 40 || (d.rainMm ?? 0) >= 2)) {
    out.push({ key: 'rain-jacket', title: 'Rain jacket', kind: 'everyone', category: 'Clothes' })
    out.push({ key: 'dry-bag', title: 'Dry bag for phones', kind: 'group', category: 'Gear' })
  }
  if (days.some((d) => d.lo < 10)) out.push({ key: 'warm-layer', title: 'Warm layer for cold mornings', kind: 'everyone', category: 'Clothes' })
  if (days.some((d) => d.hi > 28)) {
    out.push({ key: 'sun-hat', title: 'Sun hat', kind: 'everyone', category: 'Clothes' })
    out.push({ key: 'sunscreen', title: 'Sunscreen', kind: 'group', category: 'Health' })
  }
  return out
}
