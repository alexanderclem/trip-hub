// An organizer refunds or cancels one booking. The policy's refund steps suggest an amount; the
// organizer decides. Refunds run on their own Stripe account; our 1% on it comes back automatically.

import { useState } from 'react'
import { Link } from 'react-router'
import { DateTime } from 'luxon'
import type { Booking, TripOffer } from '@/data/types'
import { syncNow } from '@/data/sync/controller'
import { Dialog } from '@/ui/Dialog'
import { Button, ErrorNote, Field, Input } from '@/ui'
import { daysBefore, suggestRefund } from '../../../supabase/functions/_shared/refunds'
import { refundBooking } from './api'

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

export function RefundSheet({ booking, offer, tripStart, tripZone, onClose }: { booking: Booking; offer: TripOffer; tripStart: string | null; tripZone: string; onClose: () => void }) {
  const refundable = booking.paid_minor - booking.refunded_minor
  const today = DateTime.now().setZone(tripZone).toISODate()!
  const days = tripStart ? daysBefore(tripStart, today) : null
  const suggestion = days === null ? null : suggestRefund(refundable, offer.refund_tiers ?? [], days)
  const [amount, setAmount] = useState(suggestion ? String(suggestion.amount / 100) : '')
  const [busy, setBusy] = useState<'refund' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const cents = Math.round((Number.parseFloat(amount) || 0) * 100)

  async function go(cancel: boolean) {
    setBusy(cancel ? 'cancel' : 'refund'); setError(null)
    try {
      await refundBooking(booking.id, cents, cancel)
      await syncNow(booking.trip_id)
      setDone(`${cents > 0 ? `${usd(cents)} is on its way back to ${booking.traveler_name}. ` : ''}${cancel ? 'The booking is cancelled and the place is free again.' : ''}`)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }

  return (
    <Dialog open onClose={onClose} title={`${booking.traveler_name}’s booking`}>
      {done ? <><p role="status" className="text-sm">{done} Refunds usually reach the card in 5 to 10 days.</p><Button className="mt-4 w-full" onClick={onClose}>Done</Button></> : <div className="space-y-4">
        <p className="text-sm">Paid {usd(booking.paid_minor)}{booking.refunded_minor > 0 ? `, ${usd(booking.refunded_minor)} already refunded` : ''}. {booking.traveler_email}</p>
        {suggestion && <p className="rounded-surface bg-mist/60 p-3 text-sm">{days} days before the trip, your policy gives back {suggestion.percent}%: {usd(suggestion.amount)}.</p>}
        <Field label="Refund ($)" hint={`Up to ${usd(refundable)}. You decide; the policy only suggests.`}>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <ErrorNote error={error} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy !== null || cents <= 0 || cents > refundable} onClick={() => void go(false)}>{busy === 'refund' ? 'Refunding…' : 'Refund only'}</Button>
          <Button variant="danger" disabled={busy !== null || cents > refundable} onClick={() => void go(true)}>{busy === 'cancel' ? 'Cancelling…' : cents > 0 ? 'Refund and cancel' : 'Cancel booking'}</Button>
        </div>
        <Link className="ui-link inline-flex min-h-11 items-center" to={`/t/${booking.trip_id}/more/payments/evidence/${booking.id}`}>Evidence for a dispute</Link>
      </div>}
    </Dialog>
  )
}
