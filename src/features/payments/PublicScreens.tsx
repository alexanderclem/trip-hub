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
import type { RefundTier } from '../../../supabase/functions/_shared/refunds'
import { getBooking, getHold, getPublicOffer, joinWaitlist, payBalance, rememberBookingLink, startBooking, tokenFromHash, updateBookingAnswers, type BookingView, type PublicOffer } from './api'
import { questionList } from './data'

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
  // A held waitlist place arrives as #hold=… (from the email); like booking links, it never reaches a server log.
  const [holdToken] = useState(() => new URLSearchParams(location.hash.replace(/^#/, '')).get('hold'))
  const [hold, setHold] = useState<Hold | null | undefined>(holdToken ? undefined : null)
  useEffect(() => {
    getPublicOffer(slug).then(setOffer, (e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)))
    if (holdToken) getHold(slug, holdToken).then((h) => setHold(h ? { ...h, token: holdToken } : null), () => setHold(null))
  }, [slug, holdToken])

  if (loadError) return <Page title="This trip page needs a connection">{<p>{navigator.onLine ? loadError : 'Connect to the internet to see the trip and book.'}</p>}</Page>
  if (offer === undefined || hold === undefined) return <Page title="Loading the trip…">{null}</Page>
  if (offer === null) return <Page title="This trip page isn’t available">{<p>It may not be published yet, or bookings have closed. Ask the organizer for the latest link.</p>}</Page>

  const first = quote({ price: offer.deposit_minor || offer.price_minor, travelers: 1, deposit: 0, method: 'card', internationalShare: 0, feeMode: offer.fee_mode }).charges[0]!
  const dates = offer.trip.start_date ? `${date(offer.trip.start_date)}${offer.trip.end_date ? ` – ${date(offer.trip.end_date)}` : ''}` : ''
  return (
    <Page title={offer.title} eyebrow={`Organized by ${offer.organizer.name}`}>
      {dates && <p className="text-lg">{dates}</p>}
      {offer.summary && <p className="whitespace-pre-line text-muted">{offer.summary}</p>}
      <div className="marketing-plan">
        <p className="marketing-price">{usd(offer.price_minor)} <span className="marketing-muted" style={{ fontSize: '1rem', letterSpacing: 0 }}>per person</span></p>
        <p className="mt-2 text-sm">{offer.schedule?.length
          ? `${usd(offer.deposit_minor || offer.price_minor)} ${offer.deposit_minor ? 'deposit ' : ''}now, then ${offer.schedule.map((s) => `${usd(s.amount_minor)} by ${date(s.due_date)}`).join(', ')}.`
          : offer.deposit_minor ? `${usd(offer.deposit_minor)} deposit now, the remaining ${usd(offer.price_minor - offer.deposit_minor)} by ${date(offer.balance_due_date)}.` : 'Paid in one payment.'}
          {first.bookingFee > 0 && ` Each payment includes a booking fee (${usd(first.bookingFee)} on the first).`}</p>
        {offer.rooms && offer.rooms.length > 0 && (
          <ul className="mt-2 text-sm">
            {offer.rooms.map((r) => <li key={r.id}>{r.label}{r.price_delta_minor > 0 ? ` (+${usd(r.price_delta_minor)})` : ''}: {r.left > 0 ? `${r.left} left` : 'none left'}</li>)}
          </ul>
        )}
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
      <details className="marketing-plan"><summary className="cursor-pointer font-semibold">Cancellation and refund policy</summary><p className="mt-2 whitespace-pre-line text-sm">{offer.cancellation_policy}</p><RefundSteps tiers={offer.refund_tiers} /></details>
      {hold && <p role="status" className="marketing-plan">Your place is held, {hold.name}, until {DateTime.fromISO(hold.hold_until).setZone(offer.trip.timezone).toFormat('cccc d LLLL, h:mm a')} ({offer.trip.timezone.split('/').pop()!.replace(/_/g, ' ')} time).</p>}
      {(offer.spots_left > 0 || hold) && <BookingForm offer={offer} hold={hold} />}
      {offer.spots_left === 0 && !hold && offer.waitlist && <WaitlistForm slug={offer.slug} />}
      <p className="calc-note">Payments go to {offer.organizer.name} through Stripe. Stowaway never holds your money. Questions: <a className="underline" href={`mailto:${offer.organizer.email}`}>{offer.organizer.email}</a></p>
    </Page>
  )
}

interface Hold { name: string; email: string; hold_until: string; token: string }

function BookingForm({ offer, hold }: { offer: PublicOffer; hold: Hold | null }) {
  const [name, setName] = useState(hold?.name ?? '')
  const [email, setEmail] = useState(hold?.email ?? '')
  const [accepted, setAccepted] = useState(false)
  const [consent, setConsent] = useState(false)
  const [room, setRoom] = useState(() => offer.rooms?.find((r) => r.left > 0)?.id ?? '')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const questions = questionList(offer.questions)
  const rooms = offer.rooms ?? []
  const price = offer.price_minor + (rooms.find((r) => r.id === room)?.price_delta_minor ?? 0)
  // The first payment is the deposit, or the whole price when there is none (as checkout-create does).
  const firstBase = offer.deposit_minor > 0 && offer.deposit_minor < price ? offer.deposit_minor : price
  const charge = quote({ price: firstBase, travelers: 1, deposit: 0, method: 'card', internationalShare: 0, feeMode: offer.fee_mode }).charges[0]!.charged
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await startBooking({ slug: offer.slug, name: name.trim(), email: email.trim(), policyVersion: offer.policy_version,
        extra: { answers, consent, ...(room ? { room_option: room } : {}), ...(hold ? { hold: hold.token } : {}) } })
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false) }
  }
  return (
    <form className="marketing-form" onSubmit={submit} aria-labelledby="book-title">
      <h2 id="book-title" className="text-xl font-semibold">Reserve your place</h2>
      <label htmlFor="book-name" className="website-eyebrow">Your name, as the group will see it</label>
      <input id="book-name" required maxLength={40} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="book-email" className="website-eyebrow">Email, for your receipt and booking link</label>
      <input id="book-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      {rooms.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="website-eyebrow">Room</legend>
          {rooms.map((r) => (
            <label key={r.id} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="radio" name="room" required className="size-5" value={r.id} checked={room === r.id} disabled={r.left <= 0} onChange={() => setRoom(r.id)} />
              <span>{r.label}{r.price_delta_minor > 0 ? ` (+${usd(r.price_delta_minor)})` : ''}{r.left <= 0 ? ' · none left' : ''}</span>
            </label>
          ))}
        </fieldset>
      )}
      {questions.map((q) => (
        <div key={q.id} className="contents">
          <label htmlFor={`q-${q.id}`} className="website-eyebrow">{q.label}{q.required ? '' : ' (optional)'}</label>
          <input id={`q-${q.id}`} required={q.required} maxLength={500} value={answers[q.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
        </div>
      ))}
      {questions.length > 0 && <p className="calc-note">Only {offer.organizer.name} and you see these answers. You can change them later from your booking link.</p>}
      <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" required className="mt-1 size-5" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />I’ve read and accept the cancellation and refund policy.</label>
      <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />Email me about future trips from {offer.organizer.name}. (Optional; unsubscribe any time.)</label>
      <button type="submit" className="website-button website-button-primary" disabled={busy}>{busy ? 'Opening secure checkout…' : `Pay ${usd(charge)} and reserve`}</button>
      <p className="calc-note">You’ll pay on Stripe’s secure page. No account needed; afterwards you join the trip’s plan straight away.</p>
      {error && <p role="alert" className="marketing-status">{error}</p>}
    </form>
  )
}

function WaitlistForm({ slug }: { slug: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [place, setPlace] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try { setPlace(await joinWaitlist(slug, name.trim(), email.trim())) } catch (err) { setError(err instanceof Error ? err.message : String(err)) } finally { setBusy(false) }
  }
  if (place !== null) {
    return <p role="status" className="marketing-plan">You’re on the waitlist{place > 0 ? `, number ${place}` : ''}. If a place opens, we’ll email you a link that holds it for you for 48 hours.</p>
  }
  return (
    <form className="marketing-form" onSubmit={submit} aria-labelledby="wait-title">
      <h2 id="wait-title" className="text-xl font-semibold">Join the waitlist</h2>
      <p className="text-sm">If someone cancels, the next person on the list gets an email and 48 hours to book the place. Nothing is charged until then.</p>
      <label htmlFor="wait-name" className="website-eyebrow">Your name</label>
      <input id="wait-name" required maxLength={40} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="wait-email" className="website-eyebrow">Email</label>
      <input id="wait-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" className="website-button website-button-primary" disabled={busy}>{busy ? 'Adding you…' : 'Join the waitlist'}</button>
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
        <p className="mt-2 text-sm">{booking.status === 'paid' ? 'Paid in full.' : booking.status === 'refunded' ? 'This booking was refunded.' : booking.status === 'cancelled' ? 'This booking was cancelled.' : booking.processing ? 'A bank payment is on its way.' : owed ? (booking.next_minor && booking.next_minor < due ? `Next: ${usd(booking.next_minor)}${booking.next_date ? ` by ${date(booking.next_date)}` : ''}. ${usd(due)} left in all.` : `${usd(due)} is due${booking.next_date || booking.balance_due_date ? ` by ${date(booking.next_date ?? booking.balance_due_date)}` : ''}.`) : 'Waiting for your first payment.'}</p>
        {booking.schedule && booking.schedule.length > 0 && <PlanList schedule={booking.schedule} />}
      </div>
      {owed && !booking.processing && (
        <div className="website-actions">
          <button type="button" className="website-button website-button-primary" disabled={busy} onClick={async () => { setBusy(true); try { await payBalance(token) } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false) } }}>
            {busy ? 'Opening secure checkout…' : booking.next_minor && booking.next_minor < due ? `Pay ${usd(booking.next_minor)} now` : 'Pay the balance'}
          </button>
          {!!booking.next_minor && booking.next_minor < due && <button type="button" className="website-text-link" disabled={busy} onClick={async () => { setBusy(true); try { await payBalance(token, true) } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false) } }}>Pay everything left ({usd(due)})</button>}
        </div>
      )}
      <div className="website-actions">
        <button type="button" className="website-text-link" onClick={async () => { if (await openTrip(booking.trip_id)) navigate(`/t/${booking.trip_id}/overview`); else setError('This phone isn’t on the trip. Use the trip link from your confirmation email.') }}>Open the trip</button>
        <a className="website-text-link" href={`mailto:${booking.organizer.email}`}>Contact {booking.organizer.name}</a>
      </div>
      <p className="calc-note">Refunds follow the cancellation policy you accepted and are made by {booking.organizer.name}.</p>
      {booking.offer.refund_tiers && booking.offer.refund_tiers.length > 0 && <div className="calc-note"><RefundSteps tiers={booking.offer.refund_tiers} /></div>}
      {questionList(booking.offer.questions).length > 0 && booking.status !== 'cancelled' && booking.status !== 'refunded' && <AnswersForm booking={booking} token={token} />}
      <p className="calc-note"><Link to={`/go/${booking.offer.slug}`} className="underline">The trip page</Link></p>
    </Page>
  )
}

function PlanList({ schedule }: { schedule: { due_date: string; amount_minor: number }[] }) {
  return (
    <ul className="mt-2 text-sm">
      {schedule.map((s) => <li key={s.due_date}>{usd(s.amount_minor)} by {date(s.due_date)}</li>)}
    </ul>
  )
}

function RefundSteps({ tiers }: { tiers?: RefundTier[] }) {
  if (!tiers?.length) return null
  const sorted = [...tiers].sort((a, b) => b.days_before - a.days_before)
  return (
    <ul className="mt-2 text-sm">
      {sorted.map((t) => <li key={t.days_before}>{t.percent}% back if you cancel {t.days_before} or more days before the trip</li>)}
      {!sorted.some((t) => t.days_before === 0) && <li>Later than that, no refund unless the policy above says otherwise.</li>}
    </ul>
  )
}

function AnswersForm({ booking, token }: { booking: BookingView; token: string }) {
  const questions = questionList(booking.offer.questions)
  const [answers, setAnswers] = useState<Record<string, string>>(booking.answers ?? {})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try { setAnswers(await updateBookingAnswers(token, answers)); setMsg('Saved. Your organizer sees the change.') } catch (err) { setMsg(err instanceof Error ? err.message : String(err)) } finally { setBusy(false) }
  }
  return (
    <form className="marketing-form" onSubmit={submit} aria-labelledby="answers-title">
      <h2 id="answers-title" className="text-xl font-semibold">What {booking.organizer.name} asked</h2>
      {questions.map((q) => (
        <div key={q.id} className="contents">
          <label htmlFor={`a-${q.id}`} className="website-eyebrow">{q.label}{q.required ? '' : ' (optional)'}</label>
          <input id={`a-${q.id}`} required={q.required} maxLength={500} value={answers[q.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
        </div>
      ))}
      <button type="submit" className="website-button" disabled={busy}>{busy ? 'Saving…' : 'Save answers'}</button>
      {msg && <p role="status" className="marketing-status">{msg}</p>}
    </form>
  )
}
