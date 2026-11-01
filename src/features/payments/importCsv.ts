// Moving to Stowaway from a spreadsheet or another tool: CSV files read on the phone. Past travelers
// go to the organizer's traveler list (consent never carries over); a plan becomes plan items.

import type { ItineraryItem } from '@/data/types'
import { newId } from '@/lib/ids'

/** Rows of a CSV file. Handles a byte-order mark, quoted fields with commas, quotes and line breaks,
 * CRLF, and files that use semicolons or tabs instead of commas (as European Excel does). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.slice(0, src.search(/\r?\n|$/))
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length] as const)
  const delimiter = counts.sort((a, b) => b[1] - a[1])[0]![0]
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++ } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === delimiter) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows.map((r) => r.map((x) => x.trim()))
}

export type Mapping<F extends string> = Record<F, number | null>

const HINTS = {
  name: ['name', 'full name', 'traveler', 'traveller', 'participant', 'guest'],
  first: ['first name', 'first', 'given name'],
  last: ['last name', 'last', 'surname', 'family name'],
  email: ['email', 'e mail', 'email address', 'e mail address'],
  tags: ['tags', 'tag', 'labels', 'group', 'segment'],
  date: ['date', 'day'],
  start: ['start', 'start time', 'time', 'from', 'begins'],
  end: ['end', 'end time', 'to', 'until', 'ends'],
  title: ['title', 'activity', 'what', 'event', 'name', 'item'],
  notes: ['notes', 'note', 'description', 'details'],
} as const

/** Guesses which column holds each field from the header row; anything unsure is left for the person. */
export function guessMapping<F extends keyof typeof HINTS>(header: string[], fields: readonly F[]): Mapping<F> {
  const norm = header.map((h) => h.toLowerCase().replace(/[_-]+/g, ' ').trim())
  const used = new Set<number>()
  const out = {} as Mapping<F>
  // Exact header names first, for every field; only then partial matches ("Traveler name").
  for (const exact of [true, false]) {
    for (const f of fields) {
      if (out[f] !== undefined && out[f] !== null) continue
      const hints = HINTS[f] as readonly string[]
      const at = norm.findIndex((h, i) => !used.has(i) && (exact ? hints.includes(h) : hints.some((x) => h.includes(x))))
      out[f] = at >= 0 ? at : null
      if (at >= 0) used.add(at)
    }
  }
  return out
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const cell = (row: string[], i: number | null) => (i === null ? '' : (row[i] ?? '').trim())

export interface ContactImport { name: string; email: string; tags: string[] }

/** Past travelers from CSV rows (header first). Rows without a valid email are reported, not imported. */
export function contactsFromCsv(rows: string[][], m: Mapping<'name' | 'first' | 'last' | 'email' | 'tags'>): { ok: ContactImport[]; skipped: number[] } {
  const ok: ContactImport[] = []
  const skipped: number[] = []
  const seen = new Set<string>()
  rows.slice(1).forEach((row, n) => {
    const email = cell(row, m.email).toLowerCase()
    const name = (cell(row, m.name) || `${cell(row, m.first)} ${cell(row, m.last)}`.trim() || email.split('@')[0] || '').slice(0, 80)
    if (!EMAIL.test(email) || seen.has(email)) { skipped.push(n + 2); return }
    seen.add(email)
    const tags = cell(row, m.tags).split(/[;,|]/).map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean).slice(0, 10)
    ok.push({ name, email, tags })
  })
  return { ok, skipped }
}

/** A date as yyyy-mm-dd from "2027-03-14", "3/14/2027" (US order) or "14.03.2027". */
export function parseDate(text: string): string | null {
  const t = text.trim()
  let y: number, mo: number, d: number
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) { y = +m[1]!; mo = +m[2]!; d = +m[3]! } else if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { mo = +m[1]!; d = +m[2]!; y = +m[3]! } else if ((m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) { d = +m[1]!; mo = +m[2]!; y = +m[3]! } else return null
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** A time as HH:mm from "14:30", "2:30 pm", "2pm" or "9.15". Empty means none; null means unreadable. */
export function parseTime(text: string): string | null | '' {
  const t = text.trim().toLowerCase().replace(/\s+/g, '')
  if (!t) return ''
  const m = t.match(/^(\d{1,2})(?:[:.](\d{2}))?(am|pm|a|p)?$/)
  if (!m) return null
  let h = +m[1]!
  const min = m[2] ? +m[2] : 0
  if (m[3]) { if (h < 1 || h > 12) return null; h = (h % 12) + (m[3].startsWith('p') ? 12 : 0) } else if (!m[2]) return null
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Plan items from CSV rows (header first), in the trip's zone. A row with no start time is all day. */
export function planFromCsv(rows: string[][], m: Mapping<'date' | 'start' | 'end' | 'title' | 'notes'>, tripId: string, zone: string): { ok: ItineraryItem[]; skipped: number[] } {
  const ok: ItineraryItem[] = []
  const skipped: number[] = []
  rows.slice(1).forEach((row, n) => {
    const date = parseDate(cell(row, m.date))
    const title = cell(row, m.title).slice(0, 200)
    const start = parseTime(cell(row, m.start))
    const end = parseTime(cell(row, m.end))
    if (!date || !title || start === null || end === null) { skipped.push(n + 2); return }
    const allDay = start === ''
    const startLocal = `${date}T${allDay ? '00:00' : start}`
    const endLocal = !allDay && end ? `${date}T${end}` : null
    if (endLocal && endLocal < startLocal) { skipped.push(n + 2); return }
    ok.push({
      id: newId(), trip_id: tripId, title, kind: 'activity', place_id: null, to_place_id: null, all_day: allDay,
      start_local: startLocal, start_tz: zone, end_local: endLocal, end_tz: endLocal ? zone : null, start_at: '', end_at: null,
      status: 'tentative', confirmation_code: null, attendee_ids: null, details: {}, notes: cell(row, m.notes).slice(0, 2000) || null,
      est_cost_minor: null, est_cost_currency: null,
    } as ItineraryItem)
  })
  return { ok, skipped }
}
