// The live-price planner (docs/AGENT_PLANNER.md). Stowie opens it inside the chat; it is also a page
// at /t/:tripId/more/planner. It asks the Worker for a checked plan with real offers, shows it, and
// keeps the latest plan on this phone because each run spends paid provider calls.
// Nothing is booked here: offers are listed with their expiry, and Finalize only queues the email.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DateTime } from 'luxon'
import { Link, useParams } from 'react-router'
import { useMembers, useTrip } from '@/data/hooks'
import { tripAreas, tripDestination } from '@/features/destinations/destinations'
import { formatMoney } from '@/lib/money'
import { Button, ErrorNote, Field, Input, PageHeader, Segmented, Textarea } from '@/ui'
import { finalizeAgentPlan, requestAgentPlan, type AgentRequest, type FinalPlan } from './client'

interface Saved { id: string; plan: FinalPlan; at: string; finalized?: string }
const storeKey = (tripId: string) => `live-plan:${tripId}`
function load(tripId: string): Saved | null {
  try { const raw = localStorage.getItem(storeKey(tripId)); return raw ? JSON.parse(raw) as Saved : null } catch { return null }
}
function store(tripId: string, saved: Saved | null) {
  try { if (saved) localStorage.setItem(storeKey(tripId), JSON.stringify(saved)); else localStorage.removeItem(storeKey(tripId)) } catch { /* private mode: the plan stays on screen only */ }
}

const KIND: Record<FinalPlan['bookable'][number]['kind'], string> = { flight: 'Flight', hotel: 'Hotel', activity: 'Tour' }
const time = (iso: string) => DateTime.fromISO(iso, { setZone: true }).toFormat('HH:mm')

export function LivePlanner({ tripId, onDone }: { tripId: string; onDone?(): void }) {
  const trip = useTrip(tripId)
  const members = useMembers(tripId)
  const [saved, setSaved] = useState<Saved | null>(() => load(tripId))
  const [editing, setEditing] = useState(!saved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  const { country, city } = tripDestination(trip)
  const [form, setForm] = useState({ origin: '', destination: '', countryCode: '', adults: '', budget: '', vibe: '', notes: '', travelMode: 'DRIVE' as 'DRIVE' | 'WALK' })
  // Fill from the trip once it loads, without overwriting what they typed.
  useEffect(() => {
    if (!trip) return
    setForm((f) => ({
      ...f,
      destination: f.destination || city || tripAreas(trip)[0]?.name || '',
      countryCode: f.countryCode || country,
      adults: f.adults || String(Math.min(9, Math.max(1, members?.length ?? 1))),
    }))
  }, [trip, members, city, country])
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const currency = trip?.base_currency ?? 'USD'
  const missingDates = !!trip && (!trip.start_date || !trip.end_date)

  async function run(e: FormEvent) {
    e.preventDefault()
    setError(null); setNote(null)
    const origin = form.origin.trim().toUpperCase()
    const countryCode = form.countryCode.trim().toUpperCase()
    const adults = Number(form.adults)
    const budget = form.budget.trim() ? Number(form.budget) : null
    if (origin && !/^[A-Z]{3}$/.test(origin)) return setError('Use a three-letter airport code, such as JFK, or leave it blank to skip flights.')
    if (!form.destination.trim()) return setError('Add a destination.')
    if (!/^[A-Z]{2}$/.test(countryCode)) return setError('Use a two-letter country code, such as IT.')
    if (!Number.isInteger(adults) || adults < 1 || adults > 9) return setError('Choose between 1 and 9 travelers.')
    if (budget !== null && !(budget > 0)) return setError('Enter a budget above zero, or leave it blank.')
    const input: AgentRequest = {
      tripId, origin: origin || null, destination: form.destination.trim().slice(0, 80), countryCode, adults,
      budgetMinor: budget === null ? null : Math.round(budget * 100), vibe: form.vibe.trim().slice(0, 200), notes: form.notes.trim().slice(0, 1000), travelMode: form.travelMode,
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    try {
      const plan = await requestAgentPlan(input, controller.signal)
      const next: Saved = { id: crypto.randomUUID(), plan, at: new Date().toISOString() }
      store(tripId, next); setSaved(next); setEditing(false)
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'The trip agent could not finish this plan.')
    } finally { setBusy(false) }
  }

  async function finalize() {
    if (!saved) return
    setError(null); setBusy(true)
    try {
      const result = await finalizeAgentPlan(tripId, saved.id, saved.plan)
      if (result === 'limited') { setNote('Too many itinerary emails today. Try again tomorrow.'); return }
      const next = { ...saved, finalized: new Date().toISOString() }
      store(tripId, next); setSaved(next)
      setNote(result === 'no_email' ? 'Plan finalized. Sign in to get your itinerary by email.' : 'Plan finalized. Your itinerary email is on its way.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not finalize this plan.') } finally { setBusy(false) }
  }

  if (!trip) return <p role="status" className="p-4 text-sm text-muted">Loading the trip…</p>

  return (
    <section aria-label="Live-price plan" className="flex flex-col gap-4 rounded-surface border border-line bg-surface p-4">
      <header>
        <p className="text-sm font-medium text-action">Live prices</p>
        <h3 className="travel-heading text-2xl text-ink">Plan with real offers</h3>
        <p className="mt-1 text-sm text-muted">Stowie checks real flights, hotels and tours, then fits them around your saved places. Nothing is booked.</p>
      </header>

      {missingDates ? (
        <div className="flex flex-col gap-3 rounded-surface bg-brand-50 p-3">
          <p className="text-sm"><strong>This trip has no dates yet.</strong> Live prices depend on when you travel, so add the dates first.</p>
          <Link to={`/t/${tripId}/more/settings`} className="inline-flex min-h-11 w-fit items-center rounded-control bg-action px-4 text-sm font-medium text-on-action">Set trip dates</Link>
        </div>
      ) : (
        <p className="text-xs text-muted">Times use the trip’s time zone, {trip.timezone.replace(/_/g, ' ')}. <Link to={`/t/${tripId}/more/settings`} className="text-action underline">Change</Link></p>
      )}

      {editing || !saved ? (
        <form onSubmit={run} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Destination"><Input value={form.destination} onChange={(e) => set('destination')(e.target.value)} maxLength={80} required /></Field>
            <Field label="Country code" hint="Two letters, such as IT"><Input value={form.countryCode} onChange={(e) => set('countryCode')(e.target.value)} maxLength={2} autoCapitalize="characters" required /></Field>
            <Field label="Flying from" hint="Airport code, optional"><Input value={form.origin} onChange={(e) => set('origin')(e.target.value)} maxLength={3} autoCapitalize="characters" placeholder="JFK" /></Field>
            <Field label="Travelers"><Input value={form.adults} onChange={(e) => set('adults')(e.target.value)} inputMode="numeric" required /></Field>
          </div>
          <Field label={`Total budget (${currency})`} hint="Optional"><Input value={form.budget} onChange={(e) => set('budget')(e.target.value)} inputMode="decimal" placeholder="2000" /></Field>
          <Field label="What kind of trip?"><Input value={form.vibe} onChange={(e) => set('vibe')(e.target.value)} maxLength={200} placeholder="Food, slow mornings, one big hike" /></Field>
          <Field label="Anything else?" hint="Optional"><Textarea value={form.notes} onChange={(e) => set('notes')(e.target.value)} maxLength={1000} rows={2} /></Field>
          <Segmented label="Getting around" value={form.travelMode} onChange={(v) => setForm((f) => ({ ...f, travelMode: v }))} options={[{ value: 'DRIVE', label: 'Driving' }, { value: 'WALK', label: 'Walking' }]} />
          <ErrorNote error={error} />
          <div className="flex flex-wrap gap-2">
            {!missingDates && <Button type="submit" disabled={busy}>{busy ? 'Checking live prices…' : 'Find a plan'}</Button>}
            {busy && <Button type="button" variant="secondary" onClick={() => request.current?.abort()}>Stop</Button>}
            {!busy && saved && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Back to the plan</Button>}
            {!busy && onDone && <Button type="button" variant="ghost" onClick={onDone}>Close</Button>}
          </div>
          {busy && <p role="status" className="text-sm text-muted">This can take up to a minute.</p>}
        </form>
      ) : (
        <PlanView saved={saved} busy={busy} error={error} note={note}
          onFinalize={() => void finalize()} onRedo={() => { setNote(null); setEditing(true) }}
          onClear={() => { store(tripId, null); setSaved(null); setEditing(true) }} onDone={onDone} />
      )}
    </section>
  )
}

function PlanView({ saved, busy, error, note, onFinalize, onRedo, onClear, onDone }: {
  saved: Saved; busy: boolean; error: string | null; note: string | null
  onFinalize(): void; onRedo(): void; onClear(): void; onDone?(): void
}) {
  const { plan } = saved
  const soonest = plan.bookable.map((b) => b.expiresAt).filter((x): x is string => !!x).sort()[0]
  const expired = !!soonest && DateTime.fromISO(soonest) < DateTime.now()
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm leading-relaxed text-ink">{plan.summary}</p>
        <p className="mt-2 text-sm font-medium">{plan.days.length} {plan.days.length === 1 ? 'day' : 'days'} · {formatMoney(plan.totalMinor, plan.currency)} in live offers</p>
        <p className="text-xs text-muted">Checked {DateTime.fromISO(saved.at).toRelative()}{soonest ? ` · ${expired ? 'Some offers have expired, so run it again before booking' : `Prices held until ${DateTime.fromISO(soonest).toLocaleString(DateTime.DATETIME_SHORT)}`}` : ''}</p>
      </div>

      <ol className="flex flex-col gap-4">
        {plan.days.map((day) => (
          <li key={day.date}>
            <h4 className="font-semibold">{DateTime.fromISO(day.date).toFormat('ccc d LLL')}</h4>
            {day.stay && <p className="text-sm text-muted">Stay: {day.stay.name}{day.stay.refundable ? ' · Refundable' : ' · Non-refundable'}</p>}
            <ul className="mt-2 flex flex-col gap-1.5">
              {day.items.map((item) => (
                <li key={`${item.node}-${item.start}`} className="flex gap-3 text-sm">
                  <span className="w-11 shrink-0 tabular-nums text-muted">{time(item.start)}</span>
                  <span>{item.title}{!item.routed && <span className="text-muted"> · travel time not checked</span>}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {!!plan.bookable.length && (
        <div>
          <h4 className="font-semibold">Offers to book</h4>
          <ul className="mt-1 text-sm">
            {plan.bookable.map((b) => <li key={`${b.kind}-${b.ref}`} className="flex justify-between gap-3 border-b border-line py-1.5 last:border-0"><span>{KIND[b.kind]}</span><span className="tabular-nums">{formatMoney(b.totalMinor, plan.currency)}</span></li>)}
          </ul>
          <p className="mt-1 text-xs text-muted">Booking each offer is a separate step and isn’t available yet.</p>
        </div>
      )}
      {!!plan.assumptions.length && <p className="text-xs text-muted"><strong>Assumptions:</strong> {plan.assumptions.join(' · ')}</p>}

      <ErrorNote error={error} />
      {note && <p role="status" className="rounded-surface bg-brand-50 p-3 text-sm">{note}</p>}
      <div className="flex flex-wrap gap-2">
        {!saved.finalized && <Button onClick={onFinalize} disabled={busy || expired}>{busy ? 'Finalizing…' : 'Finalize plan'}</Button>}
        <Button variant="secondary" onClick={onRedo} disabled={busy}>Change and re-run</Button>
        <Button variant="ghost" onClick={onClear} disabled={busy}>Clear</Button>
        {onDone && <Button variant="ghost" onClick={onDone}>Close</Button>}
      </div>
    </div>
  )
}

/** The planner as its own page: a trip's More → Live-price plan. */
export function LivePlannerScreen() {
  const { tripId } = useParams()
  if (!tripId) return null
  return (
    <div>
      <PageHeader title="Live-price plan" back={`/t/${tripId}/more/ideas`} />
      <div className="mx-auto max-w-2xl px-4 py-4"><LivePlanner tripId={tripId} /></div>
    </div>
  )
}
