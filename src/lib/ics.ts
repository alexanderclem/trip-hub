// Builds an iCalendar (.ics) file. Timed events are written as UTC instants, so a calendar shows
// them correctly whatever zone the phone is in (a flight's two ends included). All-day events
// are plain dates. Pure: the caller passes "now", so output is identical on every device.

import { DateTime } from 'luxon'

export interface IcsEvent {
  /** Stable across exports, so importing again updates the event instead of duplicating it. */
  uid: string
  title: string
  /** UTC instant for timed events; 'yyyy-MM-dd' for all-day events. */
  start: string
  /** Same form as `start`. For all-day events this is the last day, inclusive. */
  end?: string | null
  allDay?: boolean
  location?: string | null
  geo?: { lat: number; lng: number } | null
  description?: string | null
  url?: string | null
  tentative?: boolean
  /** UTC instant of the last change; newer exports win in the calendar. */
  updatedAt?: string | null
}

const CRLF = '\r\n'

/** RFC 5545 text escaping. */
export function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n')
}

/** Lines longer than 75 bytes continue on the next line after a space; never splits a character. */
export function foldLine(line: string): string {
  const bytes = (s: string) => new TextEncoder().encode(s).length
  if (bytes(line) <= 75) return line
  const out: string[] = []
  let current = ''
  let size = 0
  for (const ch of line) {
    const n = bytes(ch)
    // Continuation lines start with a space, which counts towards their 75 bytes.
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current)
      current = ''
      size = 0
    }
    current += ch
    size += n
  }
  out.push(current)
  return out.join(`${CRLF} `)
}

const utcStamp = (instant: string) => DateTime.fromISO(instant, { zone: 'utc' }).toFormat("yyyyMMdd'T'HHmmss'Z'")
const dateStamp = (date: string) => date.slice(0, 10).replace(/-/g, '')

export function buildIcs(events: IcsEvent[], calendarName: string, now: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stowaway//Trip plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ]
  for (const e of events) {
    const changed = e.updatedAt ?? now
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${utcStamp(now)}`, `LAST-MODIFIED:${utcStamp(changed)}`)
    // Seconds since 2020 keeps the number small while still growing with every edit.
    lines.push(`SEQUENCE:${Math.max(0, Math.floor(DateTime.fromISO(changed, { zone: 'utc' }).toSeconds()) - 1_577_836_800)}`)
    if (e.allDay) {
      const last = e.end && e.end.slice(0, 10) > e.start.slice(0, 10) ? e.end : e.start
      // DTEND is exclusive: the day after the last day.
      const after = DateTime.fromISO(last.slice(0, 10), { zone: 'utc' }).plus({ days: 1 }).toISODate()!
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(e.start)}`, `DTEND;VALUE=DATE:${dateStamp(after)}`)
    } else {
      lines.push(`DTSTART:${utcStamp(e.start)}`)
      if (e.end && e.end > e.start) lines.push(`DTEND:${utcStamp(e.end)}`)
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`)
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`)
    if (e.geo) lines.push(`GEO:${e.geo.lat.toFixed(6)};${e.geo.lng.toFixed(6)}`)
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`)
    if (e.url) lines.push(`URL:${e.url}`)
    lines.push(`STATUS:${e.tentative ? 'TENTATIVE' : 'CONFIRMED'}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join(CRLF) + CRLF
}
