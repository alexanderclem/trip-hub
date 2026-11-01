import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import type { Booking, BookingPayment, BookingQuestions, RoomAssignment, TripOffer } from '@/data/types'
import type { ContactRow, ReportRow } from './api'

/** The trip's payment page settings, as synced to this phone. */
export const useTripOffer = (tripId: string | undefined): TripOffer | null | undefined =>
  useLiveQuery(async () => (tripId ? (await db.trip_offers.where('trip_id').equals(tripId).first()) ?? null : undefined), [tripId])

/** The trip's bookings this phone may see: all of them for organizers, a traveler's own otherwise. */
export const useTripBookings = (tripId: string | undefined): Booking[] | undefined =>
  useLiveQuery(async () => (tripId ? (await db.bookings.where('trip_id').equals(tripId).toArray()).filter((b) => !b.deleted_at) : undefined), [tripId])

export const useTripPayments = (tripId: string | undefined): BookingPayment[] | undefined =>
  useLiveQuery(async () => (tripId ? db.booking_payments.where('trip_id').equals(tripId).toArray() : undefined), [tripId])

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  // Quote everything; neutralise spreadsheet formulas in names and emails.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`
}

/** Bookings as CSV, for the organizer's own records or another tool. */
export function bookingsCsv(bookings: Booking[]): string {
  const dollars = (cents: number) => (cents / 100).toFixed(2)
  const rows = [['Traveler', 'Email', 'Status', 'Trip price', 'Paid', 'Refunded', 'Still due', 'Balance due', 'Booked']]
  for (const b of [...bookings].sort((a, z) => (a.created_at ?? '').localeCompare(z.created_at ?? ''))) {
    if (b.status === 'expired') continue
    rows.push([b.traveler_name, b.traveler_email, b.status, dollars(b.price_minor), dollars(b.paid_minor), dollars(b.refunded_minor),
      dollars(Math.max(0, b.price_minor - b.paid_minor)), b.balance_due_date ?? '', (b.created_at ?? '').slice(0, 10)])
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

/** A period's per-trip money as CSV, one fixed column order for QuickBooks or Xero imports. */
export function reportCsv(from: string, to: string, trips: ReportRow[]): string {
  const dollars = (cents: number) => (cents / 100).toFixed(2)
  const rows = [['From', 'To', 'Trip', 'Collected', 'Stripe fees', 'Stowaway fees', 'Refunds', 'Net']]
  for (const r of trips) rows.push([from, to, r.title, dollars(r.collected), dollars(r.stripe_fees), dollars(r.stowaway_fees), dollars(r.refunds), dollars(r.net)])
  return rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

/** The questions an offer asks, in order, with the labels travelers see. */
export function questionList(q: BookingQuestions | undefined): { id: string; label: string; required: boolean }[] {
  const out: { id: string; label: string; required: boolean }[] = []
  if (q?.dietary) out.push({ id: 'dietary', label: 'Dietary needs', required: false })
  if (q?.accessibility) out.push({ id: 'accessibility', label: 'Accessibility needs', required: false })
  if (q?.emergency_contact) out.push({ id: 'emergency_contact', label: 'Emergency contact (name and phone)', required: false })
  for (const c of q?.custom ?? []) out.push(c)
  return out
}

const live = (b: Booking) => b.status === 'active' || b.status === 'paid'

/** Every live booking's answers, one column per question. */
export function answersCsv(bookings: Booking[], questions: BookingQuestions | undefined): string {
  const qs = questionList(questions)
  const rows = [['Traveler', 'Email', ...qs.map((q) => q.label)]]
  for (const b of bookings.filter(live).sort((a, z) => a.traveler_name.localeCompare(z.traveler_name))) {
    rows.push([b.traveler_name, b.traveler_email, ...qs.map((q) => b.answers?.[q.id] ?? '')])
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

/** The rooming list for the hotel: room, traveler, room type, dietary and accessibility needs. */
export function roomingCsv(bookings: Booking[], rooms: RoomAssignment[], offer: TripOffer): string {
  const roomOf = new Map(rooms.filter((r) => !r.deleted_at).map((r) => [r.booking_id, r.room_name]))
  const label = (id: string | null | undefined) => offer.room_options?.find((o) => o.id === id)?.label ?? ''
  const rows = [['Room', 'Traveler', 'Room type', 'Dietary needs', 'Accessibility needs']]
  const list = bookings.filter(live).map((b) => ({ b, room: roomOf.get(b.id) ?? '' }))
    .sort((x, y) => (x.room || '\uffff').localeCompare(y.room || '\uffff') || x.b.traveler_name.localeCompare(y.b.traveler_name))
  for (const { b, room } of list) rows.push([room || 'Unassigned', b.traveler_name, label(b.room_option), b.answers?.dietary ?? '', b.answers?.accessibility ?? ''])
  return rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

/** The traveler list as CSV (consent included, so imports keep it). */
export function contactsCsv(contacts: ContactRow[]): string {
  const rows = [['Name', 'Email', 'Trips', 'Total paid', 'Last trip', 'Tags', 'Emails OK', 'Notes']]
  for (const c of contacts) rows.push([c.name, c.email, String(c.trips), (c.total_paid_minor / 100).toFixed(2), c.last_trip_on ?? '', c.tags.join('; '), c.marketing_consent && !c.unsubscribed_at ? 'yes' : 'no', c.notes])
  return rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

/** Saves text as a file on this phone. */
export function downloadText(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
