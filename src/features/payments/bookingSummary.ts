import type { Booking } from '@/data/types'

export type BookingAmounts = Pick<Booking, 'status' | 'price_minor' | 'paid_minor' | 'refunded_minor' | 'deleted_at'>

/** Only confirmed travelers owe a balance. A cancellation never creates another payment due. */
export function bookingDue(booking: BookingAmounts): number {
  return !booking.deleted_at && (booking.status === 'active' || booking.status === 'paid')
    ? Math.max(0, booking.price_minor - booking.paid_minor)
    : 0
}

/** Occupancy uses confirmed bookings; collected money also includes retained cancellation payments. */
export function summarizeBookings(bookings: readonly BookingAmounts[]) {
  let booked = 0
  let collected = 0
  let due = 0
  for (const booking of bookings) {
    if (booking.deleted_at) continue
    if (booking.status === 'active' || booking.status === 'paid') booked++
    collected += booking.paid_minor - booking.refunded_minor
    due += bookingDue(booking)
  }
  return { booked, collected, due }
}
