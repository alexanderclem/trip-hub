import { describe, expect, it } from 'vitest'
import { bookingDue, summarizeBookings, type BookingAmounts } from './bookingSummary'

const booking = (over: Partial<BookingAmounts> = {}): BookingAmounts => ({
  status: 'active', price_minor: 150000, paid_minor: 30000, refunded_minor: 0, ...over,
})

describe('operator booking totals', () => {
  it('retains cancellation income without counting the traveler or charging their balance', () => {
    expect(summarizeBookings([
      booking(),
      booking({ status: 'paid', paid_minor: 150000 }),
      booking({ status: 'cancelled', refunded_minor: 10000 }),
      booking({ status: 'refunded', refunded_minor: 30000 }),
      booking({ status: 'pending', paid_minor: 0 }),
      booking({ status: 'expired', paid_minor: 0 }),
    ])).toEqual({ booked: 2, collected: 200000, due: 120000 })
  })

  it('does not ask an active traveler to repay a partial refund', () => {
    expect(summarizeBookings([booking({ refunded_minor: 10000 })]))
      .toEqual({ booked: 1, collected: 20000, due: 120000 })
  })

  it('ignores deleted bookings and returns zero for an empty trip', () => {
    expect(summarizeBookings([booking({ deleted_at: '2026-11-03T00:00:00Z' })]))
      .toEqual({ booked: 0, collected: 0, due: 0 })
    expect(summarizeBookings([])).toEqual({ booked: 0, collected: 0, due: 0 })
  })

  it('does not export a balance due for a cancelled, refunded, pending or expired booking', () => {
    for (const status of ['cancelled', 'refunded', 'pending', 'expired'] as const) {
      expect(bookingDue(booking({ status }))).toBe(0)
    }
    expect(bookingDue(booking({ status: 'paid', paid_minor: 150001 }))).toBe(0)
  })
})
