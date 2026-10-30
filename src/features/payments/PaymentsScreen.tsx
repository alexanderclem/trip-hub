// More → Payments, for a trip's organizer: connect Stripe, price the trip, publish its page, and see
// bookings and payouts. Travelers pay through the trip page (/go/:slug); money goes to the
// organizer's own Stripe account. Offers and bookings work offline (synced); Stripe needs signal.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Check, Copy, Download, ExternalLink } from 'lucide-react'
import { useTrip } from '@/data/hooks'
import { useTripAccess } from '@/data/device'
import { isStaff } from '@/data/access'
import type { Booking, TripOffer } from '@/data/types'
import { quote } from '@/lib/fees'
import { Button, Card, DateInput, ErrorNote, Field, Input, PageHeader, SectionTitle, Segmented, Status, Textarea } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'
import { syncNow } from '@/data/sync/controller'
import { connectStripe, loadOrganizerMoney, refreshStripe, saveOffer, setOfferStatus, type OrganizerMoney } from './api'
import { accountNotices, scheduleText, type Notice } from './notices'
import { bookingsCsv, useTripBookings, useTripOffer } from './data'

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const cents = (text: string) => Math.round((Number.parseFloat(text) || 0) * 100)
const STRIPE_LINKS = { dashboard: 'https://dashboard.stripe.com', disputes: 'https://dashboard.stripe.com/disputes' }

export function PaymentsScreen() {
  const { tripId } = useParams() as { tripId: string }
  const [params, setParams] = useSearchParams()
  const trip = useTrip(tripId)
  const access = useTripAccess(tripId)
  const offer = useTripOffer(tripId)
  const bookings = useTripBookings(tripId)
  const [money, setMoney] = useState<OrganizerMoney | null>(null)
  const [moneyError, setMoneyError] = useState<string | null>(null)

  async function load() {
    setMoneyError(null)
    try { setMoney(await loadOrganizerMoney()) } catch (e) { setMoneyError(e instanceof Error ? e.message : String(e)) }
  }
  useEffect(() => {
    // Back from Stripe's onboarding: read the account's new status first.
    const back = params.get('stripe')
    void (back ? refreshStripe().catch(() => undefined) : Promise.resolve()).then(load)
    if (back) setParams({}, { replace: true })
  }, []) // once, on arrival

  if (!trip || offer === undefined) return <LoadingState fullScreen title="Loading payments…" />
  if (!isStaff(access)) {
    return (
      <div className="pb-10">
        <PageHeader title="Payments" back={`/t/${tripId}/more`} />
        <div className="mx-auto max-w-md p-4"><Card><p className="text-sm">Only the trip’s organizer collects payments. If you created this trip, become its organizer in <Link className="ui-link" to={`/t/${tripId}/more/settings`}>trip settings</Link>.</p></Card></div>
      </div>
    )
  }
  const account = money?.account ?? null
  const notices = money ? accountNotices(account, money.payouts, money.disputes) : []
  const canPublish = !!account?.charges_enabled && !account.disconnected_at

  return (
    <div className="pb-16">
      <PageHeader title="Payments" back={`/t/${tripId}/more`} />
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <Card>
          <SectionTitle>Stripe</SectionTitle>
          {!money && !moneyError && <p className="mt-2 text-sm text-muted">Checking your Stripe account…</p>}
          <div className="mt-2 empty:hidden"><ErrorNote error={moneyError} /></div>
          {money && <NoticeList notices={notices} tripId={tripId} />}
          {account && account.charges_enabled && <p className="mt-3 text-sm text-muted">Payouts reach your bank {scheduleText(account.payout_schedule)}. You can change this in Stripe.</p>}
        </Card>

        <OfferForm tripId={tripId} tripName={trip.name} offer={offer} />

        {offer && <PublishCard tripId={tripId} offer={offer} canPublish={canPublish} reviewed={money ? !!money.organizer?.reviewed_at : null} />}

        {offer && <BookingsCard bookings={bookings ?? []} capacity={offer.capacity} tripName={trip.name} />}

        {money && money.payouts.length > 0 && (
          <Card>
            <SectionTitle>Payouts</SectionTitle>
            <ul className="mt-2 divide-y divide-line text-sm">
              {money.payouts.map((p) => (
                <li key={p.stripe_payout_id} className="flex justify-between gap-3 py-2">
                  <span>{p.arrival_date ?? ''} <span className="text-muted">{p.status === 'paid' ? 'paid' : p.status === 'failed' ? 'didn’t arrive' : 'on its way'}</span></span>
                  <span className="tabular-nums">{usd(p.amount_minor)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}

function NoticeList({ notices, tripId }: { notices: Notice[]; tripId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!notices.length) return <p className="mt-2 flex items-center gap-2 text-sm text-success-ink"><Check aria-hidden="true" className="size-4" />Ready to take payments.</p>
  return (
    <ul className="mt-2 space-y-3">
      {notices.map((n) => (
        <li key={n.title} className="rounded-surface bg-mist/60 p-3">
          <p className="font-semibold text-ink">{n.tone !== 'info' && <Status tone={n.tone} className="mr-2">{n.tone === 'danger' ? 'Action needed' : 'To do'}</Status>}{n.title}</p>
          <p className="mt-1 text-sm text-muted">{n.body}</p>
          {n.action && (n.action.to === 'onboarding'
            ? <Button className="mt-2" disabled={busy} onClick={async () => { setBusy(true); setError(null); try { await connectStripe(`/t/${tripId}/more/payments`) } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false) } }}>{busy ? 'Opening Stripe…' : n.action.label}</Button>
            : <a className="ui-link mt-1 inline-flex min-h-11 items-center gap-1" href={STRIPE_LINKS[n.action.to]} target="_blank" rel="noopener noreferrer">{n.action.label}<ExternalLink aria-hidden="true" className="size-4" /><span className="sr-only"> (opens in a new tab)</span></a>)}
        </li>
      ))}
      <ErrorNote error={error} />
    </ul>
  )
}

function OfferForm({ tripId, tripName, offer }: { tripId: string; tripName: string; offer: TripOffer | null }) {
  const loaded = useRef(false)
  const [title, setTitle] = useState(tripName)
  const [summary, setSummary] = useState('')
  const [price, setPrice] = useState('')
  const [deposit, setDeposit] = useState('')
  const [due, setDue] = useState('')
  const [capacity, setCapacity] = useState('20')
  const [policy, setPolicy] = useState('')
  const [feeMode, setFeeMode] = useState<'absorb' | 'pass'>('absorb')
  const [allowBank, setAllowBank] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fill once (CLAUDE.md: forms never re-apply synced rows while someone types).
  useEffect(() => {
    if (loaded.current || !offer) return
    loaded.current = true
    setTitle(offer.title); setSummary(offer.summary); setPrice(String(offer.price_minor / 100)); setDeposit(offer.deposit_minor ? String(offer.deposit_minor / 100) : '')
    setDue(offer.balance_due_date ?? ''); setCapacity(String(offer.capacity)); setPolicy(offer.cancellation_policy); setFeeMode(offer.fee_mode); setAllowBank(offer.allow_bank)
  }, [offer])

  const q = quote({ price: cents(price), travelers: 1, deposit: cents(deposit), method: 'card', internationalShare: 0, feeMode })
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setMsg(null)
    try {
      await saveOffer(tripId, { title: title.trim(), summary: summary.trim(), priceMinor: cents(price), depositMinor: cents(deposit), balanceDueDate: cents(deposit) > 0 ? due || null : null,
        capacity: Math.max(1, Math.floor(Number(capacity) || 0)), cancellationPolicy: policy.trim(), feeMode, allowBank })
      await syncNow(tripId)
      setMsg('Saved.')
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) } finally { setBusy(false) }
  }

  return (
    <Card>
      <SectionTitle>Trip price</SectionTitle>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <Field label="Trip page title"><Input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="What’s included" hint="Shown on the trip page. Lodging, transport, meals, what to bring."><Textarea maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price per person ($)"><Input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
          <Field label="Places"><Input required inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></Field>
          <Field label="Deposit ($)" hint="Leave empty for one payment."><Input inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></Field>
          {cents(deposit) > 0 && <Field label="Balance due"><DateInput required value={due} onValue={setDue} /></Field>}
        </div>
        <Field label="Cancellation and refund policy" hint="Travelers accept it before paying. Changing it later applies to new bookings only."><Textarea required rows={4} maxLength={4000} value={policy} onChange={(e) => setPolicy(e.target.value)} /></Field>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>Who pays the fees</span>
          <Segmented label="Who pays the fees" value={feeMode} onChange={setFeeMode} options={[{ value: 'absorb', label: 'I do' }, { value: 'pass', label: 'Travelers' }]} className="w-48" />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5" checked={allowBank} onChange={(e) => setAllowBank(e.target.checked)} />Let travelers pay by bank transfer too (cheaper: 0.8%, at most $5)</label>
        {cents(price) > 0 && (
          <p role="status" className="rounded-surface bg-mist/60 p-3 text-sm">
            Each traveler pays {usd(q.perTraveler.charged)}{q.charges.length > 1 ? ` (${q.charges.map((c) => `${usd(c.charged)} ${c.label.toLowerCase()}`).join(', then ')})` : ''}. By card you keep about {usd(q.perTraveler.kept)} of it: Stripe {usd(q.perTraveler.stripeFee)}, Stowaway {usd(q.perTraveler.stowawayFee)}.
          </p>
        )}
        <ErrorNote error={error} />
        {msg && <p role="status" className="text-sm text-success-ink">{msg}</p>}
        <Button type="submit" variant="secondary" className="w-full" disabled={busy}>{busy ? 'Saving…' : offer ? 'Save changes' : 'Save price'}</Button>
      </form>
    </Card>
  )
}

function PublishCard({ tripId, offer, canPublish, reviewed }: { tripId: string; offer: TripOffer; canPublish: boolean; reviewed: boolean | null }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const url = `${location.origin}/go/${offer.slug}`
  async function set(status: TripOffer['status']) {
    setBusy(true); setError(null)
    try { await setOfferStatus(tripId, status); await syncNow(tripId) } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return (
    <Card>
      <SectionTitle>Trip page</SectionTitle>
      {offer.status === 'published' ? <>
        <p className="mt-2 text-sm">{reviewed === false ? 'Published. Stowaway checks new organizers before their first page goes live; until then the link shows “not available”.' : 'Travelers can book and pay here:'}</p>
        <p className="mt-2 select-all break-all rounded-surface bg-mist/60 p-3 font-mono text-xs">{url}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true) } catch { setError('Could not copy. Select the link and copy it.') } }}>{copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}{copied ? 'Copied' : 'Copy link'}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => void set('closed')}>Stop bookings</Button>
        </div>
      </> : <>
        <p className="mt-2 text-sm text-muted">{offer.status === 'closed' ? 'Bookings are stopped. Travelers who booked keep their place and can still pay their balance.' : canPublish ? 'Publish the page when the price and policy are right.' : 'Connect Stripe before publishing.'}</p>
        <Button className="mt-3 w-full" disabled={busy || !canPublish} onClick={() => void set('published')}>{offer.status === 'closed' ? 'Take bookings again' : 'Publish trip page'}</Button>
      </>}
      <div className="mt-2 empty:hidden"><ErrorNote error={error} /></div>
    </Card>
  )
}

function BookingsCard({ bookings, capacity, tripName }: { bookings: Booking[]; capacity: number; tripName: string }) {
  const live = bookings.filter((b) => b.status === 'active' || b.status === 'paid')
  const collected = live.reduce((a, b) => a + b.paid_minor - b.refunded_minor, 0)
  const due = live.reduce((a, b) => a + Math.max(0, b.price_minor - b.paid_minor), 0)
  function download() {
    const blob = new Blob([bookingsCsv(bookings)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${tripName.replace(/[^\w-]+/g, '-').toLowerCase()}-bookings.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <Card>
      <SectionTitle>Bookings ({live.length} of {capacity})</SectionTitle>
      <p className="mt-1 text-sm text-muted">Collected {usd(collected)} · still due {usd(due)}</p>
      {live.length > 0 && (
        <ul className="mt-2 divide-y divide-line text-sm">
          {live.map((b) => (
            <li key={b.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="min-w-0 break-words">{b.traveler_name}</span>
              <span className="tabular-nums">{b.status === 'paid' ? <span className="text-success-ink">Paid {usd(b.paid_minor)}</span> : <>{usd(b.paid_minor)} of {usd(b.price_minor)}{b.balance_due_date ? <span className="text-muted"> · due {b.balance_due_date}</span> : null}</>}</span>
            </li>
          ))}
        </ul>
      )}
      {bookings.length > 0 && <button type="button" className="ui-link mt-2 inline-flex min-h-11 items-center gap-2" onClick={download}><Download aria-hidden="true" className="size-4" />Download as CSV</button>}
      <p className="mt-2 text-xs text-muted">Refunds and disputes are handled in your Stripe Dashboard; they show here automatically, and we return our 1% on refunds.</p>
    </Card>
  )
}
