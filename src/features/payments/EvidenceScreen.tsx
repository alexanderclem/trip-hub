// A printable record for a card dispute (on the 1%): what the traveler agreed to and when, what they
// paid, when they joined the trip, and the plan they received. Built from this phone's synced data,
// plus the exact policy version from the server. Print it, or save it as PDF, and upload it in Stripe.

import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router'
import { DateTime } from 'luxon'
import { db } from '@/data/db'
import { useTrip } from '@/data/hooks'
import { Button, PageHeader } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'
import { getOfferPolicy } from './api'
import { useTripOffer } from './data'

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const when = (iso: string | null | undefined) => (iso ? DateTime.fromISO(iso).toUTC().toFormat("d LLL yyyy, HH:mm 'UTC'") : '–')

export function EvidenceScreen() {
  const { tripId, bookingId } = useParams() as { tripId: string; bookingId: string }
  const trip = useTrip(tripId)
  const offer = useTripOffer(tripId)
  const booking = useLiveQuery(() => db.bookings.get(bookingId), [bookingId])
  const payments = useLiveQuery(() => db.booking_payments.where('booking_id').equals(bookingId).toArray(), [bookingId])
  const member = useLiveQuery(async () => (booking?.member_id ? db.members.get(booking.member_id) : undefined), [booking?.member_id])
  const items = useLiveQuery(() => db.itinerary_items.where('trip_id').equals(tripId).toArray(), [tripId])
  const [policy, setPolicy] = useState<{ text: string; since: string } | null | 'offline'>(null)

  useEffect(() => {
    if (!offer || !booking) return
    getOfferPolicy(offer.id, booking.policy_version).then((p) => setPolicy(p), () => setPolicy('offline'))
  }, [offer, booking])

  if (!trip || !booking || !offer || !payments || !items) return <LoadingState fullScreen title="Gathering the record…" />
  const plan = items.filter((i) => !i.deleted_at && i.status !== 'cancelled').sort((a, b) => a.start_local.localeCompare(b.start_local))
  return (
    <div className="pb-10">
      <div className="print:hidden"><PageHeader title="Dispute evidence" back={`/t/${tripId}/more/payments`} /></div>
      <article className="mx-auto max-w-2xl space-y-5 p-4 text-sm leading-relaxed">
        <header>
          <h1 className="ui-section-title">{offer.title}: booking record</h1>
          <p className="text-muted">Prepared {when(new Date().toISOString())} from Stowaway, for a card dispute.</p>
        </header>
        <section>
          <h2 className="font-semibold">Traveler</h2>
          <p>{booking.traveler_name} · {booking.traveler_email}</p>
          <p>Booked {when(booking.created_at)}. Trip {trip.start_date ?? ''}{trip.end_date ? ` to ${trip.end_date}` : ''}.</p>
          {member?.created_at && <p>Joined the trip’s shared plan on {when(member.created_at)}.</p>}
        </section>
        <section>
          <h2 className="font-semibold">Cancellation and refund policy accepted</h2>
          <p>Version {booking.policy_version}, accepted {when(booking.policy_accepted_at)} by ticking “I’ve read and accept the cancellation and refund policy” before paying.</p>
          <blockquote className="mt-2 whitespace-pre-line border-l-2 border-line pl-3">{policy && policy !== 'offline' ? policy.text : policy === 'offline' ? 'Connect to the internet to include the exact policy text.' : 'Loading the policy…'}</blockquote>
        </section>
        <section>
          <h2 className="font-semibold">Payments</h2>
          <ul>{payments.filter((p) => p.paid_at).map((p) => <li key={p.id}>{when(p.paid_at)}: {usd(p.charged_minor)} ({p.kind}){p.refunded_minor > 0 ? `, ${usd(p.refunded_minor)} refunded` : ''}</li>)}</ul>
          <p>Trip price {usd(booking.price_minor)}; paid {usd(booking.paid_minor)}; refunded {usd(booking.refunded_minor)}.</p>
        </section>
        <section>
          <h2 className="font-semibold">The plan shared with the traveler</h2>
          <ul>{plan.map((i) => <li key={i.id}>{i.start_local.replace('T', ' ').slice(0, 16)} ({i.start_tz}): {i.title}</li>)}</ul>
        </section>
        <div className="print:hidden"><Button onClick={() => window.print()}>Print or save as PDF</Button></div>
      </article>
    </div>
  )
}
