import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import type { Booking, BookingPayment, TripOffer } from '@/data/types'

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
