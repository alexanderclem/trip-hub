import { describe, expect, it } from 'vitest'
import type { Booking } from '@/data/types'
import { bookingsCsv } from './data'

const b = (over: Partial<Booking>): Booking => ({
  id: 'b', trip_id: 't', offer_id: 'o', organizer_id: 'g', member_id: null, traveler_name: 'Ola', traveler_email: 'ola@example.com', status: 'active',
  price_minor: 150000, deposit_minor: 30000, paid_minor: 30000, refunded_minor: 0, balance_due_date: '2027-02-01', fee_mode: 'absorb', policy_version: 1,
  policy_accepted_at: '2026-11-01T00:00:00Z', started_by_user: null, created_at: '2026-11-01T10:00:00Z', ...over,
})

describe('bookings CSV', () => {
  it('lists bookings with what is paid and due, oldest first, without expired holds', () => {
    const csv = bookingsCsv([b({ traveler_name: 'Zed', created_at: '2026-11-02T00:00:00Z', paid_minor: 150000, status: 'paid' }), b({}), b({ traveler_name: 'Gone', status: 'expired' })])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('"Traveler","Email","Status","Trip price","Paid","Refunded","Still due","Balance due","Booked"')
    expect(lines[1]).toBe('"Ola","ola@example.com","active","1500.00","300.00","0.00","1200.00","2027-02-01","2026-11-01"')
    expect(lines[2]).toContain('"Zed"')
    expect(lines).toHaveLength(3)
  })

  it('keeps a traveler’s name from running as a spreadsheet formula', () => {
    expect(bookingsCsv([b({ traveler_name: '=HYPERLINK("x")' })]).split('\r\n')[1]).toMatch(/^"'=HYPERLINK\(""x""\)"/)
  })
})
