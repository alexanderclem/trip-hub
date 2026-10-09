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

/** Postgres returns "2027-03-21T07:10:00"; forms produce "2027-03-21T07:10". Accept both. */
export const normalizeLocal = (local: string): LocalDateTime => local.replace(' ', 'T').slice(0, 16)

function parseLocal(local: LocalDateTime) {
  const dt = DateTime.fromFormat(normalizeLocal(local), LOCAL_FMT, { zone: 'utc' })
  if (!dt.isValid) throw new Error(`Invalid local time "${local}"`)
  return dt
}

/**
 * Resolves a wall-clock time in a zone to a UTC instant, reporting DST problems.
 * A gap time (e.g. 02:30 on the US spring-forward day) doesn't exist; it's moved forward.
 * An ambiguous time (e.g. 01:30 on fall-back day) happens twice; the later (standard-time) one is
 * chosen, matching Postgres's `AT TIME ZONE` so an item doesn't shift when the server's copy syncs back.
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
    return { kind: 'ambiguous', instant: iso(candidates[1]!), alternative: iso(candidates[0]!) }
  }
  // Gap: Luxon shifts nonexistent times forward by the size of the gap.
  const shifted = DateTime.fromFormat(normalizeLocal(local), LOCAL_FMT, { zone })
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

/** A stored 'yyyy-MM-dd' as people read it ("Mar 13, 2027"); text that isn't a date is shown as it is. */
export function formatDate(date: string): string {
  const d = DateTime.fromISO(date)
  return d.isValid ? d.toLocaleString(DateTime.DATE_MED) : date
}

/** A trip's dates as one label, for headers and cards. */
export function dateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (start) return `${formatDate(start)}${end ? ` – ${formatDate(end)}` : ''}`
  return end ? `Until ${formatDate(end)}` : 'Dates to be decided'
}

/** Which part comes first when people here write a date in numbers: 6/4/2027 is June 4 or 6 April. */
export type DateOrder = 'MDY' | 'DMY' | 'YMD'

export function dateOrder(locale?: string): DateOrder {
  const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date(2027, 10, 22)).map((p) => p.type).filter((t) => t === 'year' || t === 'month' || t === 'day')
  return parts[0] === 'year' ? 'YMD' : parts[0] === 'day' ? 'DMY' : 'MDY'
}

const TYPED_FMT: Record<DateOrder, string> = { MDY: 'MM/dd/yyyy', DMY: 'dd/MM/yyyy', YMD: 'yyyy-MM-dd' }
const NAMED_FMTS = ['LLL d yyyy', 'LLLL d yyyy', 'd LLL yyyy', 'd LLLL yyyy']

/** A 'yyyy-MM-dd' date the way it's typed in this order; '' stays ''. */
export function formatTypedDate(date: string, order: DateOrder): string {
  const dt = DateTime.fromISO(date, { zone: 'utc' })
  return date && dt.isValid ? dt.toFormat(TYPED_FMT[order]) : ''
}

/**
 * Reads a typed or pasted date as 'yyyy-MM-dd', or null if it isn't one. Accepts 2027-06-04,
 * 6/4/2027 (also with dots or dashes, and a two-digit year) and "Jun 4, 2027" / "4 June 2027".
 */
export function parseTypedDate(text: string, order: DateOrder): string | null {
  const t = text.trim()
  const valid = (year: number, month: number, day: number) => {
    const dt = DateTime.fromObject({ year, month, day }, { zone: 'utc' })
    return dt.isValid ? dt.toISODate() : null
  }
  const iso = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (iso) return valid(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const numeric = t.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4}|\d{2})$/)
  if (numeric) {
    const [a, b, y] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])]
    const year = numeric[3]!.length === 2 ? 2000 + y : y
    return order === 'MDY' ? valid(year, a, b) : valid(year, b, a)
  }
  const named = t.replace(/[.,]/g, ' ').replace(/\s+/g, ' ')
  for (const fmt of NAMED_FMTS) {
    const dt = DateTime.fromFormat(named, fmt, { zone: 'utc', locale: 'en' })
    if (dt.isValid) return dt.toISODate()
  }
  return null
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
