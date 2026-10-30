// What travelers see without an account: a trip's page (/go/:slug), the page Stripe sends them back to
// (/go/:slug/booked#t=…), and their booking (/b#t=…). The booking link's token stays in the URL
// fragment, which never reaches a server.

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Check, Copy } from 'lucide-react'
import { DateTime } from 'luxon'
import { quote } from '@/lib/fees'
import { supabase } from '@/lib/supabase'
import { useDevice } from '@/data/device'
import { fetchAccess } from '@/data/access'
import { WebsiteFrame } from '@/features/website/WebsiteFrame'
import { getBooking, getPublicOffer, payBalance, rememberBookingLink, startBooking, tokenFromHash, type BookingView, type PublicOffer } from './api'

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const date = (iso: string | null) => (iso ? DateTime.fromISO(iso).toLocaleString(DateTime.DATE_MED) : '')

function Page({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <WebsiteFrame>
      <section className="marketing-hero website-container" aria-labelledby="page-title">
        {eyebrow && <p className="website-eyebrow">{eyebrow}</p>}
        <h1 id="page-title">{title}</h1>
        <div className="mt-6 max-w-2xl space-y-6">{children}</div>
      </section>
    </WebsiteFrame>
  )
}

// ─── The trip page ──────────────────────────────────────────────────────────

export function PublicTripScreen() {
  const { slug } = useParams() as { slug: string }
  const [offer, setOffer] = useState<PublicOffer | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    getPublicOffer(slug).then(setOffer, (e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [slug])

  if (loadError) return <Page title="This trip page needs a connection">{<p>{navigator.onLine ? loadError : 'Connect to the internet to see the trip and book.'}</p>}</Page>
  if (offer === undefined) return <Page title="Loading the trip…">{null}</Page>
  if (offer === null) return <Page title="This trip page isn’t available">{<p>It may not be published yet, or bookings have closed. Ask the organizer for the latest link.</p>}</Page>

  const first = quote({ price: offer.deposit_minor || offer.price_minor, travelers: 1, deposit: 0, method: 'card', internationalShare: 0, feeMode: offer.fee_mode }).charges[0]!
  const dates = offer.trip.start_date ? `${date(offer.trip.start_date)}${offer.trip.end_date ? ` – ${date(offer.trip.end_date)}` : ''}` : ''
  return (
    <Page title={offer.title} eyebrow={`Organized by ${offer.organizer.name}`}>
      {dates && <p className="text-lg">{dates}</p>}
      {offer.summary && <p className="whitespace-pre-line text-muted">{offer.summary}</p>}
      <div className="marketing-plan">
        <p className="marketing-price">{usd(offer.price_minor)} <span className="marketing-muted" style={{ fontSize: '1rem', letterSpacing: 0 }}>per person</span></p>
        <p className="mt-2 text-sm">{offer.deposit_minor ? `${usd(offer.deposit_minor)} deposit now, the remaining ${usd(offer.price_minor - offer.deposit_minor)} by ${date(offer.balance_due_date)}.` : 'Paid in one payment.'}
          {first.bookingFee > 0 && ` Each payment includes a booking fee (${usd(first.bookingFee)} on the first).`}</p>
        <p className="mt-1 text-sm text-muted">{offer.spots_left > 0 ? `${offer.spots_left} ${offer.spots_left === 1 ? 'place' : 'places'} left.` : 'This trip is full.'}</p>
      </div>
      {offer.days.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold">The plan so far</h2>
          <ol className="mt-3 space-y-3">
            {offer.days.map((d) => <li key={d.date}><p className="font-semibold">{date(d.date)}</p><p className="text-sm text-muted">{d.items.join(' · ')}</p></li>)}
          </ol>
        </div>
      )}
      <details className="marketing-plan"><summary className="cursor-pointer font-semibold">Cancellation and refund policy</summary><p className="mt-2 whitespace-pre-line text-sm">{offer.cancellation_policy}</p></details>
      {offer.spots_left > 0 && <BookingForm offer={offer} firstCharge={first.charged} />}
      <p className="calc-note">Payments go to {offer.organizer.name} through Stripe. Stowaway never holds your money. Questions: <a className="underline" href={`mailto:${offer.organizer.email}`}>{offer.organizer.email}</a></p>
    </Page>
  )
}

function BookingForm({ offer, firstCharge }: { offer: PublicOffer; firstCharge: number }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try { await startBooking({ slug: offer.slug, name: name.trim(), email: email.trim(), policyVersion: offer.policy_version }) } catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false) }
  }
  return (
    <form className="marketing-form" onSubmit={submit} aria-labelledby="book-title">
      <h2 id="book-title" className="text-xl font-semibold">Reserve your place</h2>
      <label htmlFor="book-name" className="website-eyebrow">Your name, as the group will see it</label>
      <input id="book-name" required maxLength={40} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="book-email" className="website-eyebrow">Email, for your receipt and booking link</label>
      <input id="book-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" required className="mt-1 size-5" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />I’ve read and accept the cancellation and refund policy.</label>
      <button type="submit" className="website-button website-button-primary" disabled={busy}>{busy ? 'Opening secure checkout…' : `Pay ${usd(firstCharge)} and reserve`}</button>
      <p className="calc-note">You’ll pay on Stripe’s secure page. No account needed; afterwards you join the trip’s plan straight away.</p>
      {error && <p role="alert" className="marketing-status">{error}</p>}
    </form>
  )
}

// ─── After paying ───────────────────────────────────────────────────────────

/** Puts the trip on this phone when its payment made this phone a traveler. */
async function openTrip(tripId: string): Promise<boolean> {
  const { data } = await supabase.from('trip_devices').select('member_id').eq('trip_id', tripId).maybeSingle()
  if (!data) return false
  useDevice.getState().rememberTrip(tripId, (data as { member_id: string | null }).member_id)
  const access = await fetchAccess(tripId)
  if (access !== 'unknown' && access.role) useDevice.getState().setAccess(tripId, access)
  return true
}

function BookingLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${location.origin}/b#t=${token}`
  return (
    <div className="marketing-plan">
      <p className="font-semibold">Your booking link</p>
      <p className="mt-1 text-sm text-muted">See what you’ve paid and pay your balance. We’ve emailed it to you too; keep it to yourself.</p>
      <p className="mt-2 select-all break-all font-mono text-xs">{url}</p>
      <button type="button" className="website-text-link" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true) } catch { /* select and copy */ } }}>
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}

export function BookedScreen() {
  const navigate = useNavigate()
  const token = tokenFromHash(location.hash)
  const [booking, setBooking] = useState<BookingView | null | undefined>(undefined)
  const [waitedOut, setWaitedOut] = useState(false)
  const [opening, setOpening] = useState(false)
  const [notHere, setNotHere] = useState(false)

  useEffect(() => {
    if (!token) return
    let stop = false
    const started = Date.now()
    const tick = async () => {
      const b = await getBooking(token).catch(() => undefined)
      if (stop) return
      if (b) { setBooking(b); rememberBookingLink(b.id, token) }
      const settled = b && (b.status === 'active' || b.status === 'paid' || b.processing)
      if (settled) return
      if (Date.now() - started > 90_000) { setWaitedOut(true); return }
      setTimeout(() => void tick(), 2000)
    }
    void tick()
    return () => { stop = true }
  }, [token])

  if (!token) return <Page title="This link is incomplete">{<p>Open the booking link from your confirmation email.</p>}</Page>
  const paid = booking && (booking.status === 'active' || booking.status === 'paid')
  if (paid) {
    return (
      <Page title={`You’re in, ${booking.traveler_name}`} eyebrow={booking.offer.title}>
        <p>{booking.organizer.name} received {usd(booking.paid_minor)}{booking.paid_minor < booking.price_minor ? `. The remaining ${usd(booking.price_minor - booking.paid_minor)} is due by ${date(booking.balance_due_date)}.` : '. You’ve paid in full.'}</p>
        <div className="website-actions">
          <button type="button" className="website-button website-button-primary" disabled={opening} onClick={async () => {
            setOpening(true)
            if (await openTrip(booking.trip_id)) navigate(`/t/${booking.trip_id}/overview`)
            else { setNotHere(true); setOpening(false) }
          }}>{opening ? 'Opening…' : 'Open the trip'}</button>
        </div>
        {notHere && <p role="status">This phone isn’t on the trip yet. Open the trip from the link in your confirmation email, on the phone you’ll travel with.</p>}
        <BookingLink token={token} />
      </Page>
    )
  }
  if (booking?.processing) {
    return <Page title="Your bank payment is on its way" eyebrow={booking.offer.title}>{<><p>Bank payments usually take about 4 business days. Your place is held, and we’ll email you when it arrives.</p><BookingLink token={token} /></>}</Page>
  }
  return (
    <Page title={waitedOut ? 'Still confirming your payment' : 'Confirming your payment…'}>
      <p role="status">{waitedOut ? 'Stripe hasn’t told us yet. If you were charged, we’ll email you as soon as it’s confirmed; you don’t need to pay again.' : 'This takes a few seconds.'}</p>
      <BookingLink token={token} />
    </Page>
  )
}

// ─── A booking, from its private link ───────────────────────────────────────

export function ManageBookingScreen() {
  const navigate = useNavigate()
  const token = tokenFromHash(location.hash)
  const [booking, setBooking] = useState<BookingView | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!token) return
    getBooking(token).then((b) => { setBooking(b); if (b) rememberBookingLink(b.id, token) }, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [token])

  if (!token) return <Page title="This link is incomplete">{<p>Open the booking link from your confirmation email.</p>}</Page>
  if (error) return <Page title="Your booking needs a connection">{<p>{error}</p>}</Page>
  if (booking === undefined) return <Page title="Loading your booking…">{null}</Page>
  if (booking === null) return <Page title="We couldn’t find this booking">{<p>Check that you opened the whole link from your email.</p>}</Page>
  const due = Math.max(0, booking.price_minor - booking.paid_minor)
  const owed = booking.status === 'active' && due > 0
  return (
    <Page title={booking.offer.title} eyebrow={`Booked by ${booking.traveler_name}`}>
      <div className="marketing-plan">
        <p className="marketing-price">{usd(booking.paid_minor)} <span className="marketing-muted" style={{ fontSize: '1rem', letterSpacing: 0 }}>of {usd(booking.price_minor)} paid</span></p>
        {booking.refunded_minor > 0 && <p className="mt-1 text-sm">{usd(booking.refunded_minor)} refunded.</p>}
        <p className="mt-2 text-sm">{booking.status === 'paid' ? 'Paid in full.' : booking.status === 'refunded' ? 'This booking was refunded.' : booking.status === 'cancelled' ? 'This booking was cancelled.' : booking.processing ? 'A bank payment is on its way.' : owed ? `${usd(due)} is due by ${date(booking.balance_due_date)}.` : 'Waiting for your first payment.'}</p>
      </div>
      {owed && !booking.processing && (
        <button type="button" className="website-button website-button-primary" disabled={busy} onClick={async () => { setBusy(true); try { await payBalance(token) } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false) } }}>
          {busy ? 'Opening secure checkout…' : `Pay the balance`}
        </button>
      )}
      <div className="website-actions">
        <button type="button" className="website-text-link" onClick={async () => { if (await openTrip(booking.trip_id)) navigate(`/t/${booking.trip_id}/overview`); else setError('This phone isn’t on the trip. Use the trip link from your confirmation email.') }}>Open the trip</button>
        <a className="website-text-link" href={`mailto:${booking.organizer.email}`}>Contact {booking.organizer.name}</a>
      </div>
      <p className="calc-note">Refunds follow the cancellation policy you accepted and are made by {booking.organizer.name}.</p>
      <p className="calc-note"><Link to={`/go/${booking.offer.slug}`} className="underline">The trip page</Link></p>
    </Page>
  )
}
