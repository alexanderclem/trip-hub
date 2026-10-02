import type { ItineraryItem, Place } from '@/data/types'
import { dayKey } from '@/lib/time'
import { travelOptions, type LegContext, type TravelOption } from '@/features/routing/legs'

export interface Transfer {
  from: ItineraryItem
  to: ItineraryItem
  fromPlace: Place
  toPlace: Place
  option: TravelOption
  gapS: number | null
  leaveAt: number
  memberIds: string[]
}

export function scheduledItems(items: ItineraryItem[]) {
  return items.filter((i) => !i.deleted_at && !i.all_day && i.status !== 'cancelled' && i.kind !== 'lodging')
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at) || a.id.localeCompare(b.id))
}

export function nextItem(items: ItineraryItem[], memberId: string | null, now: number) {
  return scheduledItems(items).find((i) => Date.parse(i.start_at) >= now
    && (i.attendee_ids === null || (memberId !== null && i.attendee_ids.includes(memberId))))
}

/** Follow each person's consecutive stops, then merge pairs shared by the group.
 * Unknown locations break the chain; missing end times never invent a free interval.
 */
export function planTransfers(items: ItineraryItem[], places: Place[], ctx: LegContext, zone: string, members: string[]): Transfer[] {
  const sorted = scheduledItems(items)
  const people = new Set([...members, ...sorted.flatMap((i) => i.attendee_ids ?? [])])
  if (!people.size) people.add('everyone')
  const byPlace = new Map(places.filter((p) => !p.deleted_at).map((p) => [p.id, p]))
  const pairs = new Map<string, Transfer>()
  for (const person of people) {
    const personal = sorted.filter((i) => i.attendee_ids === null || i.attendee_ids.includes(person))
    for (let n = 1; n < personal.length; n++) {
      const from = personal[n - 1]!
      const to = personal[n]!
      if (dayKey(from.end_at ?? from.start_at, zone) !== dayKey(to.start_at, zone)) continue
      const fromPlace = byPlace.get(from.to_place_id ?? from.place_id ?? '')
      const toPlace = byPlace.get(to.place_id ?? '')
      if (!fromPlace || !toPlace || fromPlace.id === toPlace.id) continue
      const key = `${from.id}:${to.id}`
      const existing = pairs.get(key)
      if (existing) { existing.memberIds.push(person); continue }
      const options = travelOptions(fromPlace, toPlace, ctx)
      // Prefer saved evidence over a straight-line guess; allow the upper end of its range.
      const known = options.filter((o) => o.source !== 'estimate')
      const option = [...(known.length ? known : options)].sort((a, b) => a.maxS - b.maxS)[0]
      if (!option) continue
      pairs.set(key, {
        from, to, fromPlace, toPlace, option, memberIds: [person],
        gapS: from.end_at ? (Date.parse(to.start_at) - Date.parse(from.end_at)) / 1000 : null,
        leaveAt: Date.parse(to.start_at) - option.maxS * 1000,
      })
    }
  }
  return [...pairs.values()].sort((a, b) => Date.parse(a.to.start_at) - Date.parse(b.to.start_at))
}

export function needsTravelBuffer(t: Transfer) {
  // Actual overlaps already have a separate warning in the plan.
  return t.gapS !== null && t.gapS >= 0 && t.gapS < t.option.maxS
}
