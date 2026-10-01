// Lays out one day of the itinerary for display in a chosen time zone. Pure (zone passed in).
import { DateTime } from 'luxon'
import type { ItineraryItem } from '@/data/types'
import { DEFAULT_DURATION_MS, findConflicts, tripDays } from '@/lib/time'

export interface Block {
  item: ItineraryItem
  startMin: number // minutes after midnight (display zone), clipped to the day
  endMin: number
  lane: number
  lanes: number // lanes in this block's overlap cluster
  continuesBefore: boolean // started the previous day (overnight bus)
  continuesAfter: boolean
  conflict: boolean
}

export interface DayLayout {
  day: string
  stays: ItineraryItem[] // lodging covering this day: shown as a "Staying at" banner
  allDay: ItineraryItem[]
  blocks: Block[]
  fromHour: number
  toHour: number
}

const DAY_MIN = 24 * 60
const isTimed = (i: ItineraryItem) => !i.all_day && i.kind !== 'lodging'
const live = (i: ItineraryItem) => !i.deleted_at

function endMs(i: ItineraryItem): number {
  const s = Date.parse(i.start_at)
  return i.end_at ? Math.max(Date.parse(i.end_at), s) : s + DEFAULT_DURATION_MS
}

/** [start, end) of a calendar day in the zone, as epoch ms. */
function dayBounds(day: string, zone: string): [number, number] {
  const start = DateTime.fromISO(day, { zone }).startOf('day')
  return [start.toMillis(), start.plus({ days: 1 }).toMillis()]
}

/** Does the item touch this day? Lodging covers nights: check-in day up to (not incl.) check-out day. */
export function onDay(i: ItineraryItem, day: string, zone: string): boolean {
  if (!live(i)) return false
  if (i.all_day) {
    const first = i.start_local.slice(0, 10)
    const last = (i.end_local ?? i.start_local).slice(0, 10)
    return day >= first && day <= last
  }
  const [d0, d1] = dayBounds(day, zone)
  const s = Date.parse(i.start_at)
  const e = endMs(i)
  if (i.kind === 'lodging') return s < d1 && e > d0 && DateTime.fromMillis(e, { zone }).toISODate() !== day
  return s < d1 && (e > d0 || s >= d0)
}

export function layoutDay(items: ItineraryItem[], day: string, zone: string): DayLayout {
  const todays = items.filter((i) => onDay(i, day, zone) && i.status !== 'cancelled')
  const [d0] = dayBounds(day, zone)
  const conflictIds = new Set(findConflicts(todays).flat())

  const timed = todays
    .filter(isTimed)
    .map((item) => {
      const s = Date.parse(item.start_at)
      const e = endMs(item)
      const startMin = Math.max(0, Math.round((s - d0) / 60_000))
      const rawEnd = Math.round((e - d0) / 60_000)
      return {
        item,
        startMin,
        endMin: Math.min(DAY_MIN, Math.max(rawEnd, startMin + 30)), // at least 30 min tall to be tappable
        continuesBefore: s < d0,
        continuesAfter: rawEnd > DAY_MIN,
      }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  // Greedy lane assignment within clusters of overlapping blocks.
  const blocks: Block[] = []
  let cluster: Block[] = []
  let clusterEnd = -1
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((b) => b.lane + 1))
    for (const b of cluster) b.lanes = lanes
    blocks.push(...cluster)
    cluster = []
  }
  for (const t of timed) {
    if (t.startMin >= clusterEnd && cluster.length) flush()
    const used = new Set(cluster.filter((b) => b.endMin > t.startMin).map((b) => b.lane))
    let lane = 0
    while (used.has(lane)) lane++
    cluster.push({ ...t, lane, lanes: 1, conflict: conflictIds.has(t.item.id) })
    clusterEnd = Math.max(clusterEnd, t.endMin)
  }
  if (cluster.length) flush()

  const earliest = Math.min(6 * 60, ...blocks.map((b) => b.startMin))
  const latest = Math.max(22 * 60, ...blocks.map((b) => b.endMin))
  return {
    day,
    stays: todays.filter((i) => i.kind === 'lodging' && !i.all_day),
    allDay: todays.filter((i) => i.all_day),
    blocks,
    fromHour: Math.floor(earliest / 60),
    toHour: Math.min(24, Math.ceil(latest / 60)),
  }
}

/** Days to show: the trip's dates, widened to include any item outside them. */
export function planDays(start: string | null, end: string | null, items: ItineraryItem[], zone: string): string[] {
  const keys = items.filter(live).map((i) => (i.all_day ? i.start_local.slice(0, 10) : DateTime.fromISO(i.start_at, { zone: 'utc' }).setZone(zone).toISODate()!))
  const all = [...keys, ...(start ? [start] : []), ...(end ? [end] : [])].sort()
  if (!all.length) return [DateTime.now().setZone(zone).toISODate()!]
  return tripDays(all[0]!, all[all.length - 1]!)
}
