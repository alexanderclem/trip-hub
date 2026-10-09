// "Ideas for this day": picks places from the trip's own idea pool for the parts of a day that are
// still free. Worked out on the phone from rows it already has; no network and no model. Pure, so
// it is unit-tested; the live query is in data.ts.

import type { Place, PlaceCategory } from '@/data/types'
import type { Axis, Scores } from '@/features/discovery/model'
import type { DayLayout } from '@/features/itinerary/layout'
import { haversineM, type LatLng } from '@/lib/geo'

export const SLOTS = ['breakfast', 'lunch', 'afternoon', 'dinner', 'evening'] as const
export type Slot = (typeof SLOTS)[number]

export interface Suggestion {
  place: Place
  slot: Slot
  /** 0–100; only meaningful against other suggestions for the same slot. */
  score: number
  /** Straight-line distance from where the day happens, when both are known. */
  distanceM: number | null
  /** Why it was picked, in words for the card. */
  reasons: string[]
  /** A sensible start for the plan form, "12:30". */
  startTime: string
}

export interface SuggestInput {
  day: string
  places: Place[]
  layout: DayLayout
  /** Where the day happens: where the group sleeps, else its first stop. */
  anchor: LatLng | null
  /** Whether that is where the group is staying, which changes how distance is worded. */
  staying?: boolean
  /** The group's mean travel style; null when nobody has saved one. */
  group: Scores | null
  /** Mean group stars per place id. */
  ratings: Map<string, number>
  rainy: boolean
  /** Places already on the plan, on any day. */
  plannedPlaceIds: Set<string>
}

const SLOT: Record<Slot, { label: string; from: number; to: number; start: string; categories: PlaceCategory[] }> = {
  breakfast: { label: 'Breakfast', from: 7 * 60, to: 10 * 60, start: '08:30', categories: ['food'] },
  lunch: { label: 'Lunch', from: 12 * 60, to: 14 * 60, start: '12:30', categories: ['food'] },
  afternoon: { label: 'Free time', from: 9 * 60, to: 18 * 60, start: '15:00', categories: ['sight', 'activity', 'shopping'] },
  dinner: { label: 'Dinner', from: 18 * 60 + 30, to: 21 * 60, start: '19:00', categories: ['food'] },
  evening: { label: 'Evening', from: 21 * 60, to: 24 * 60, start: '21:00', categories: ['drink'] },
}
export const slotLabel = (slot: Slot) => SLOT[slot].label

const MEALS: Slot[] = ['breakfast', 'lunch', 'dinner']
const FREE_STRETCH_MIN = 120
const NIGHT_OWLS = 60
/** Beyond this the place is a trip of its own, not something to drop into a free slot. */
const NEAR_M = 4_000
const DETOUR = 1.3 // streets are longer than the straight line
const WALK_KMH = 4.5
const WALKABLE_MIN = 25
const LIKES = 65

/** The longest stretch of [from, to) that nothing timed covers, and when it starts. */
function longestGap(layout: DayLayout, from: number, to: number): { length: number; start: number } {
  let best = { length: 0, start: from }
  let cursor = from
  for (const b of [...layout.blocks].sort((a, c) => a.startMin - c.startMin)) {
    if (b.endMin <= cursor) continue
    if (b.startMin >= to) break
    if (b.startMin - cursor > best.length) best = { length: b.startMin - cursor, start: cursor }
    cursor = Math.max(cursor, b.endMin)
  }
  if (to - cursor > best.length) best = { length: to - cursor, start: cursor }
  return best
}

/** The parts of the day still open, in the order they come. */
export function freeSlots(layout: DayLayout, group: Scores | null = null): Slot[] {
  const busy = (slot: Slot, only?: (kind: string) => boolean) =>
    layout.blocks.some((b) => b.startMin < SLOT[slot].to && b.endMin > SLOT[slot].from && (!only || only(b.item.kind)))
  return SLOTS.filter((slot) => {
    // A meal is covered by a meal, or by anything that fills the whole window (a flight, a hike).
    if (MEALS.includes(slot)) return !busy(slot, (kind) => kind === 'meal') && longestGap(layout, SLOT[slot].from, SLOT[slot].to).length >= 45
    if (slot === 'afternoon') return longestGap(layout, SLOT.afternoon.from, SLOT.afternoon.to).length >= FREE_STRETCH_MIN
    return (group?.nightlife ?? 0) >= NIGHT_OWLS && !busy(slot)
  })
}

const INDOOR = new Set(['museum', 'gallery', 'marketplace', 'cafe', 'restaurant'])
const OUTDOOR = new Set(['viewpoint', 'attraction', 'park', 'nature_reserve', 'beach_resort', 'historic', 'artwork'])
const TAG_AXES: Record<string, Axis[]> = {
  museum: ['culture'], gallery: ['culture'], historic: ['culture'], artwork: ['culture'], marketplace: ['culture', 'food'],
  viewpoint: ['nature'], park: ['nature', 'relaxation'], nature_reserve: ['nature', 'adventure'], beach_resort: ['relaxation'],
  attraction: ['adventure'], cafe: ['relaxation', 'food'], fast_food: ['budget'], nightclub: ['nightlife'], bar: ['nightlife'], pub: ['nightlife'],
}
const CATEGORY_AXES: Partial<Record<PlaceCategory, Axis[]>> = {
  food: ['food'], drink: ['nightlife'], sight: ['culture'], activity: ['adventure', 'nature'], shopping: ['culture'],
}
const AXIS_WORD: Record<Axis, string> = {
  adventure: 'adventure', nature: 'nature', culture: 'culture', food: 'food', nightlife: 'nightlife', relaxation: 'downtime', comfort: 'comfort', budget: 'saving money',
}

/** What a place is about: its tags when they say something, else its category. */
function axesOf(place: Place): Axis[] {
  const fromTags = place.tags.flatMap((t) => TAG_AXES[t] ?? [])
  return [...new Set(fromTags.length ? fromTags : (CATEGORY_AXES[place.category] ?? []))]
}
const outdoors = (place: Place) => place.tags.some((t) => OUTDOOR.has(t)) || (place.category === 'activity' && !place.tags.some((t) => INDOOR.has(t)))
const indoors = (place: Place) => place.tags.some((t) => INDOOR.has(t))

/** A small, stable number in [0, 1) from a string, so equal scores fall in the same order on every phone. */
function hash01(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

function distanceWords(m: number, staying: boolean): string {
  const from = staying ? 'where you’re staying' : 'the day’s first stop'
  const walk = Math.max(1, Math.round(((m * DETOUR) / 1000 / WALK_KMH) * 60))
  return walk <= WALKABLE_MIN ? `About ${walk} min walk from ${from}` : `${(m / 1000).toFixed(1)} km from ${from}`
}

function rate(place: Place, slot: Slot, input: SuggestInput): Suggestion {
  const reasons: string[] = []
  const at = place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null
  const distanceM = input.anchor && at ? haversineM(input.anchor, at) : null

  // Nearness is worth up to 45, falling to nothing at the edge of "near".
  let score = distanceM === null ? 20 : 45 * Math.max(0, 1 - distanceM / NEAR_M)
  if (distanceM !== null) reasons.push(distanceWords(distanceM, !!input.staying))

  // How well it fits the group is worth up to 30; with no saved styles every place gets the middle.
  const axes = axesOf(place)
  const fit = input.group && axes.length ? Math.max(...axes.map((a) => input.group![a])) : 50
  score += 30 * (fit / 100)
  const loved = input.group ? axes.filter((a) => input.group![a] >= LIKES).sort((a, b) => input.group![b] - input.group![a])[0] : undefined
  if (loved) reasons.push(`Your group is big on ${AXIS_WORD[loved]}`)

  const stars = input.ratings.get(place.id)
  if (stars !== undefined) {
    score += (stars - 3) * 6 // a 5 adds 12, a 1 takes 12 away
    if (stars >= 4) reasons.push(`The group rated it ${stars.toFixed(1)} ★`)
  }
  if (place.status === 'shortlist') {
    score += 10
    reasons.push('On your shortlist')
  }
  if (input.rainy && slot === 'afternoon') {
    if (outdoors(place)) score -= 20
    else if (indoors(place)) {
      score += 8
      reasons.push('Indoors, and rain is likely')
    }
  }
  // Under a point, so it only ever settles ties, and differently each day.
  score += hash01(`${input.day}:${place.id}`)
  return { place, slot, score: Math.max(0, Math.min(100, score)), distanceM, reasons, startTime: SLOT[slot].start }
}

const two = (n: number) => String(n).padStart(2, '0')

/** The best few places for each free part of the day. A place is offered for one slot only. */
export function suggestForDay(input: SuggestInput, perSlot = 2): Suggestion[] {
  const pool = input.places.filter((p) => !p.deleted_at && (p.status === 'catalog' || p.status === 'shortlist') && !input.plannedPlaceIds.has(p.id))
  const used = new Set<string>()
  const out: Suggestion[] = []
  for (const slot of freeSlots(input.layout, input.group)) {
    const rated = pool.filter((p) => SLOT[slot].categories.includes(p.category)).map((p) => rate(p, slot, input))
    // Once we know where the day happens, only places on the map count, and far ones are offered only when the pool has nothing near.
    const located = input.anchor ? rated.filter((s) => s.distanceM !== null) : rated
    const near = located.filter((s) => s.distanceM !== null && s.distanceM <= NEAR_M)
    const picks = (near.length ? near : located).filter((s) => !used.has(s.place.id))
      .sort((a, b) => b.score - a.score || a.place.id.localeCompare(b.place.id)).slice(0, perSlot)
    // An afternoon idea starts when the free stretch does, not at a fixed hour.
    const gap = slot === 'afternoon' ? longestGap(input.layout, SLOT.afternoon.from, SLOT.afternoon.to) : null
    const start = gap && gap.start > SLOT.afternoon.from ? `${two(Math.floor(gap.start / 60))}:${two(gap.start % 60)}` : null
    for (const s of picks) {
      used.add(s.place.id)
      out.push(start ? { ...s, startTime: start } : s)
    }
  }
  return out
}
