import { useState } from 'react'
import { useMyMemberId } from '@/data/device'
import { Button, Card, ErrorNote, SectionTitle } from '@/ui'
import { bookingLink, payBalance } from './api'
import { useTripBookings } from './data'

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

/** A traveler's own booking on the Money screen: what's paid, what's due, and paying the balance. */
export function MyBookingCard({ tripId }: { tripId: string }) {
  const me = useMyMemberId(tripId)
  const mine = useTripBookings(tripId)?.find((b) => b.member_id === me && (b.status === 'active' || b.status === 'paid'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!mine) return null
  const due = Math.max(0, mine.price_minor - mine.paid_minor)
  const token = bookingLink(mine.id)
  return (
    <Card>
      <SectionTitle>Your booking</SectionTitle>
      <p className="mt-1 text-sm">{mine.status === 'paid' ? `Paid in full: ${usd(mine.paid_minor)}.` : `${usd(mine.paid_minor)} of ${usd(mine.price_minor)} paid. ${usd(due)} due by ${mine.balance_due_date ?? 'the due date'}.`}</p>
      {mine.status === 'active' && due > 0 && (token
        ? <Button className="mt-3 w-full" disabled={busy} onClick={async () => { setBusy(true); setError(null); try { await payBalance(token) } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false) } }}>{busy ? 'Opening secure checkout…' : `Pay ${usd(due)}`}</Button>
        : <p className="mt-2 text-sm text-muted">Pay it from the booking link in your confirmation email.</p>)}
      <div className="mt-2 empty:hidden"><ErrorNote error={error} /></div>
    </Card>
  )
}
