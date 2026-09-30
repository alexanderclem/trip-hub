// Itinerary times are stored as wall-clock local time + the IANA zone where that end of the
// item happens (a flight departs in America/Guatemala and lands in America/Chicago). The
// absolute instant is derived. No function here reads the machine's time zone; callers pass
// the zone explicitly so behaviour (and tests) are identical on every device.

import { DateTime, IANAZone } from 'luxon'

/** 'yyyy-MM-ddTHH:mm' wall-clock time, no zone. */
export type LocalDateTime = string

export type LocalTimeCheck =
  | { kind: 'ok'; instant: string }
  | { kind: 'gap'; instant: string } // skipped by a DST spring-forward; shifted later
  | { kind: 'ambiguous'; instant: string; alternative: string } // repeated by a DST fall-back

const LOCAL_FMT = "yyyy-MM-dd'T'HH:mm"

export function deviceZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function isValidZone(zone: string): boolean {
  return IANAZone.isValidZone(zone)
}

function parseLocal(local: LocalDateTime) {
  const dt = DateTime.fromFormat(local, LOCAL_FMT, { zone: 'utc' })
  if (!dt.isValid) throw new Error(`Invalid local time "${local}"`)
  return dt
}

/**
 * Resolves a wall-clock time in a zone to a UTC instant, reporting DST problems.
 * A gap time (e.g. 02:30 on the US spring-forward day) doesn't exist; it's moved forward.
 * An ambiguous time (e.g. 01:30 on fall-back day) happens twice; the earlier one is chosen.
 */
export function checkLocalTime(local: LocalDateTime, zone: string): LocalTimeCheck {
  const z = IANAZone.create(zone)
  if (!z.isValid) throw new Error(`Invalid time zone "${zone}"`)
  const asUtcMs = parseLocal(local).toMillis()

  // Every offset in effect within ±1 day could apply to this wall time.
  const offsets = new Set<number>()
  for (const probe of [-26, 0, 26]) offsets.add(z.offset(asUtcMs + probe * 3_600_000))
  const candidates = [...offsets]
    .map((off) => asUtcMs - off * 60_000)
    .filter((ms) => asUtcMs - z.offset(ms) * 60_000 === ms)
    .sort((a, b) => a - b)

  const iso = (ms: number) => DateTime.fromMillis(ms, { zone: 'utc' }).toISO()!
  if (candidates.length === 1) return { kind: 'ok', instant: iso(candidates[0]!) }
  if (candidates.length >= 2) {
    return { kind: 'ambiguous', instant: iso(candidates[0]!), alternative: iso(candidates[1]!) }
  }
  // Gap: Luxon shifts nonexistent times forward by the size of the gap.
  const shifted = DateTime.fromFormat(local, LOCAL_FMT, { zone })
  return { kind: 'gap', instant: shifted.toUTC().toISO()! }
}

export function toInstant(local: LocalDateTime, zone: string): string {
  return checkLocalTime(local, zone).instant
}

/** Formats a UTC instant in the display zone. */
export function formatInZone(instant: string, zone: string, format = 'HH:mm'): string {
  return DateTime.fromISO(instant, { zone: 'utc' }).setZone(zone).toFormat(format)
}

/** The calendar day ('yyyy-MM-dd') an instant falls on, as seen from `zone`. */
export function dayKey(instant: string, zone: string): string {
  return DateTime.fromISO(instant, { zone: 'utc' }).setZone(zone).toISODate()!
}

/** Short zone label like "UTC−6" or "CDT" for the header chip. */
export function zoneLabel(zone: string, at: string): string {
  return DateTime.fromISO(at, { zone: 'utc' }).setZone(zone).toFormat('ZZZZ')
}

/** Every date from start to end inclusive, as 'yyyy-MM-dd'. */
export function tripDays(startDate: string, endDate: string): string[] {
  const days: string[] = []
  let d = DateTime.fromISO(startDate, { zone: 'utc' })
  const end = DateTime.fromISO(endDate, { zone: 'utc' })
  while (d <= end) {
    days.push(d.toISODate()!)
    d = d.plus({ days: 1 })
  }
  return days
}

export interface TimedItem {
  id: string
  start_at: string
  end_at: string | null
  all_day?: boolean
  status?: string
  kind?: string
  attendee_ids?: string[] | null // null = everyone
}

export const DEFAULT_DURATION_MS = 60 * 60_000

function interval(item: TimedItem): [number, number] {
  const s = Date.parse(item.start_at)
  const e = item.end_at ? Date.parse(item.end_at) : s + DEFAULT_DURATION_MS
  return [s, Math.max(e, s)]
}

function attendeesIntersect(a: TimedItem, b: TimedItem): boolean {
  if (!a.attendee_ids || !b.attendee_ids) return true
  const set = new Set(a.attendee_ids)
  return b.attendee_ids.some((m) => set.has(m))
}

function countsForConflicts(item: TimedItem): boolean {
  return !item.all_day && item.status !== 'cancelled' && item.kind !== 'lodging'
}

/** Pairs of item ids whose times overlap and share at least one attendee. */
export function findConflicts(items: TimedItem[]): [string, string][] {
  const relevant = items
    .filter(countsForConflicts)
    .map((it) => ({ it, iv: interval(it) }))
    .sort((a, b) => a.iv[0] - b.iv[0])
  const out: [string, string][] = []
  for (let i = 0; i < relevant.length; i++) {
    const a = relevant[i]!
    for (let j = i + 1; j < relevant.length; j++) {
      const b = relevant[j]!
      if (b.iv[0] >= a.iv[1]) break // sorted by start: nothing later can overlap a
      if (attendeesIntersect(a.it, b.it)) out.push([a.it.id, b.it.id])
    }
  }
  return out
}
