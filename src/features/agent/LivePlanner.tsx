// The live-price planner (docs/AGENT_PLANNER.md). Stowie opens it inside the chat; it is also a page
// at /t/:tripId/more/planner. It asks the Worker for a checked plan with real offers, shows it, and
// keeps the latest plan on this phone because each run spends paid provider calls.
// Nothing is booked here. "Add to plan" writes tentative items; "Email me a copy" queues the email.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { DateTime } from 'luxon'
import { Link, useParams } from 'react-router'
import { BedDouble, ExternalLink, MapPin, Plane, Sun, Ticket } from 'lucide-react'
import { useMembers, usePlaces, useTrip } from '@/data/hooks'
import { useMyMemberId } from '@/data/device'
import { tripAreas, tripDestination } from '@/features/destinations/destinations'
import { formatMoney } from '@/lib/money'
import { Button, ErrorNote, Field, Input, PageHeader, Segmented, Textarea } from '@/ui'
import { finalizeAgentPlan, requestAgentPlan, warmAgentPlan, type AgentRequest, type FinalPlan } from './client'
import { addPlanToTrip, removePlanFromTrip } from './addToPlan'

interface Saved { id: string; plan: FinalPlan; at: string; finalized?: string; added?: { ids: string[]; skipped: number; placeIds?: string[] } }
const storeKey = (tripId: string) => `live-plan:${tripId}`
function load(tripId: string): Saved | null {
  try { const raw = localStorage.getItem(storeKey(tripId)); return raw ? JSON.parse(raw) as Saved : null } catch { return null }
}
function store(tripId: string, saved: Saved | null) {
  try { if (saved) localStorage.setItem(storeKey(tripId), JSON.stringify(saved)); else localStorage.removeItem(storeKey(tripId)) } catch { /* private mode: the plan stays on screen only */ }
}

const hhmm = (t: string) => (t.includes('T') ? t.split('T')[1]! : t).slice(0, 5)
const mapsLink = (...parts: (string | null | undefined)[]) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.filter(Boolean).join(', '))}`
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function LivePlanner({ tripId, onDone }: { tripId: string; onDone?(): void }) {
  const trip = useTrip(tripId)
  const members = useMembers(tripId)
  const [saved, setSaved] = useState<Saved | null>(() => load(tripId))
  const [editing, setEditing] = useState(!saved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  // Once the airport and destination look complete, start the slow searches while they finish the
  // form. Each combination is warmed once per visit.
  const warmed = useRef(new Set<string>())
  const showingForm = (editing || !saved) && !!trip?.start_date && !!trip?.end_date
  useEffect(() => {
    if (!showingForm) return
    const origin = form.origin.trim().toUpperCase(), countryCode = form.countryCode.trim().toUpperCase(), destination = form.destination.trim(), adults = Number(form.adults)
    if ((origin && !/^[A-Z]{3}$/.test(origin)) || !/^[A-Z]{2}$/.test(countryCode) || !destination || !Number.isInteger(adults) || adults < 1 || adults > 9) return
    const key = [origin, destination.toLowerCase(), countryCode, adults].join('|')
    if (warmed.current.has(key)) return
    const timer = setTimeout(() => { warmed.current.add(key); void warmAgentPlan({ tripId, origin: origin || null, destination: destination.slice(0, 80), countryCode, adults }) }, 900)
    return () => clearTimeout(timer)
  }, [showingForm, form.origin, form.destination, form.countryCode, form.adults, tripId])
  const keep = (next: Saved | null) => { store(tripId, next); setSaved(next) }

  const currency = trip?.base_currency ?? 'USD'
  const missingDates = !!trip && (!trip.start_date || !trip.end_date)

  async function run(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const origin = form.origin.trim().toUpperCase()
    const countryCode = form.countryCode.trim().toUpperCase()
    const adults = Number(form.adults)
    const budget = form.budget.trim() ? Number(form.budget.replace(/[, ]/g, '')) : null
    if (origin && !/^[A-Z]{3}$/.test(origin)) return setError('Use a three-letter airport code like JFK, or leave it blank if you don’t need flights.')
    if (!form.destination.trim()) return setError('Where are you going?')
    if (!/^[A-Z]{2}$/.test(countryCode)) return setError('Add the two-letter country code, like IT for Italy.')
    if (!Number.isInteger(adults) || adults < 1 || adults > 9) return setError('Plans can be for 1 to 9 travelers.')
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
      keep({ id: crypto.randomUUID(), plan, at: new Date().toISOString() })
      setEditing(false)
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Stowie couldn’t put a plan together. Try again.')
    } finally { setBusy(false) }
  }

  if (!trip) return <p role="status" className="p-4 text-sm text-muted">Loading the trip…</p>

  return (
    <section aria-label="Trip plan with real prices" className="flex flex-col gap-4 rounded-surface border border-line bg-surface p-4">
      <header>
        <h3 className="travel-heading text-2xl text-ink">{saved && !editing ? 'Your plan' : 'Plan it with real prices'}</h3>
        {(editing || !saved) && <p className="mt-1 text-sm text-muted">Stowie looks up real flights, hotels and tours and fits them around the places you’ve saved. Nothing gets booked.</p>}
      </header>

      {editing || !saved ? (
        missingDates ? (
          <div className="flex flex-col gap-3 rounded-surface bg-brand-50 p-3">
            <p className="text-sm"><strong>First, when are you going?</strong> Prices depend on your dates.</p>
            <Link to={`/t/${tripId}/more/dates`} className="inline-flex min-h-11 w-fit items-center rounded-control bg-action px-4 text-sm font-medium text-on-action">Set trip dates</Link>
          </div>
        ) : (
          <form onSubmit={run} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Going to"><Input value={form.destination} onChange={(e) => set('destination')(e.target.value)} maxLength={80} required /></Field>
              <Field label="Country code" hint="Like IT"><Input value={form.countryCode} onChange={(e) => set('countryCode')(e.target.value)} maxLength={2} autoCapitalize="characters" required /></Field>
              <Field label="Flying from" hint="Airport code, optional"><Input value={form.origin} onChange={(e) => set('origin')(e.target.value)} maxLength={3} autoCapitalize="characters" placeholder="JFK" /></Field>
              <Field label="Travelers"><Input value={form.adults} onChange={(e) => set('adults')(e.target.value)} inputMode="numeric" required /></Field>
            </div>
            <Field label={`Budget for everyone (${currency})`} hint="Optional"><Input value={form.budget} onChange={(e) => set('budget')(e.target.value)} inputMode="decimal" placeholder="2000" /></Field>
            <Field label="What are you in the mood for?"><Input value={form.vibe} onChange={(e) => set('vibe')(e.target.value)} maxLength={200} placeholder="Good food, slow mornings, one big hike" /></Field>
            <Field label="Anything else Stowie should know?" hint="Optional"><Textarea value={form.notes} onChange={(e) => set('notes')(e.target.value)} maxLength={1000} rows={2} /></Field>
            <Segmented label="Getting around" value={form.travelMode} onChange={(v) => setForm((f) => ({ ...f, travelMode: v }))} options={[{ value: 'DRIVE', label: 'Driving' }, { value: 'WALK', label: 'Walking' }]} />
            <p className="text-xs text-muted">Times are in {trip.timezone.replace(/_/g, ' ')}. <Link to={`/t/${tripId}/more/settings`} className="text-action underline">Change</Link></p>
            <ErrorNote error={error} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>{busy ? 'Looking up prices…' : 'Make my plan'}</Button>
              {busy && <Button type="button" variant="secondary" onClick={() => request.current?.abort()}>Stop</Button>}
              {!busy && saved && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Back to my plan</Button>}
              {!busy && onDone && <Button type="button" variant="ghost" onClick={onDone}>Close</Button>}
            </div>
            {busy && <p role="status" className="text-sm text-muted">Checking live flights, hotels and tours. Usually 10 to 20 seconds.</p>}
          </form>
        )
      ) : (
        <PlanView tripId={tripId} saved={saved} onChange={keep} onEdit={() => { setError(null); setEditing(true) }}
          onClear={() => { keep(null); setEditing(true) }} onDone={onDone} />
      )}
    </section>
  )
}

function Thumb({ src, icon }: { src?: string | null; icon: ReactNode }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-14 shrink-0 rounded-control object-cover" />
  return <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-control bg-brand-50 text-action">{icon}</span>
}

function Named({ href, to, children }: { href?: string | null; to?: string | null; children: ReactNode }) {
  if (to) return <Link to={to} className="font-medium text-ink underline decoration-line underline-offset-2 hover:text-action">{children}</Link>
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-baseline gap-1 font-medium text-ink underline decoration-line underline-offset-2 hover:text-action">{children}<ExternalLink aria-label="(opens in a new tab)" className="size-3.5 shrink-0 self-center text-muted" /></a>
  return <span className="font-medium text-ink">{children}</span>
}

type PlanItem = FinalPlan['days'][number]['items'][number]
/** A keyless search for the exact offer, so the group can book it themselves. */
function bookingLink(b: FinalPlan['bookable'][number], plan: FinalPlan, flights: PlanItem[], destination: string | undefined): string | null {
  if (b.kind === 'flight') {
    const legs = flights.filter((f) => f.ref === b.ref)
    const first = legs[0], last = legs.at(-1)
    if (!first?.depart || !first.arrive || !last?.depart) return null
    // The destination is where the longest gap between legs is (the stay), not a connection.
    const at = (end: { local: string; zone: string }) => DateTime.fromISO(end.local, { zone: end.zone }).toMillis()
    let stay = legs.length - 1
    for (let i = 0, longest = -1; i < legs.length - 1; i++) {
      const gap = at(legs[i + 1]!.depart!) - at(legs[i]!.arrive!)
      if (gap > longest) { longest = gap; stay = i }
    }
    const roundTrip = legs.length > 1 && last.arrive?.airport === first.depart.airport
    const back = roundTrip ? legs[stay + 1] : undefined
    const q = `Flights from ${first.depart.airport} to ${legs[stay]!.arrive!.airport} on ${first.depart.local.slice(0, 10)}${back?.depart ? ` returning ${back.depart.local.slice(0, 10)}` : ''}`
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`
  }
  if (b.kind === 'hotel') {
    const stay = plan.days.map((d) => d.stay).find((s) => s?.rateId === b.ref)
    return stay ? mapsLink(stay.name, stay.address ?? destination) : null
  }
  return plan.days.flatMap((d) => d.items).find((i) => i.ref === b.ref)?.url ?? null
}

const ICON = { flight: <Plane className="size-5" />, activity: <Ticket className="size-5" />, free: <Sun className="size-5" />, place: <MapPin className="size-5" />, hotel: <BedDouble className="size-5" /> }
const WHAT: Record<FinalPlan['bookable'][number]['kind'], string> = { flight: 'Flights', hotel: 'Hotel', activity: 'Tour' }

function PlanView({ tripId, saved, onChange, onEdit, onClear, onDone }: {
  tripId: string; saved: Saved; onChange(next: Saved): void; onEdit(): void; onClear(): void; onDone?(): void
}) {
  const { plan } = saved
  const trip = useTrip(tripId)
  const places = usePlaces(tripId)
  const memberId = useMyMemberId(tripId)
  const [busy, setBusy] = useState<null | 'add' | 'undo' | 'email'>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const destination = tripDestination(trip).city
  const placeName = (id: string | null | undefined) => (id ? places?.find((p) => p.id === id)?.name : undefined)

  const soonest = plan.bookable.map((b) => b.expiresAt).filter((x): x is string => !!x).sort()[0]
  const expired = !!soonest && DateTime.fromISO(soonest) < DateTime.now()
  const kinds = [...new Set(plan.bookable.map((b) => b.kind))]
  const covers = kinds.map((k) => (k === 'flight' ? 'flights' : k === 'hotel' ? 'hotel' : 'tours')).join(kinds.length > 2 ? ', ' : ' and ')
  // Only stops with a place can be routed; open free time has nothing to check.
  const unchecked = plan.days.some((d) => d.items.some((i) => !i.routed && (i.kind === 'activity' || !!i.placeId)))
  const flights = plan.days.flatMap((d) => d.items).filter((i) => i.kind === 'flight' && i.depart && i.arrive)

  async function add() {
    if (!trip || !memberId) return setError('Choose who you are on this trip first, then try again.')
    setError(null); setNote(null); setBusy('add')
    try {
      const result = await addPlanToTrip(plan, trip, saved.id, memberId, destination || null)
      onChange({ ...saved, added: { ids: result.ids, skipped: result.skipped, placeIds: result.placeIds } })
      if (!result.added) setNote('Everything in this plan clashes with things already in your trip, so nothing was added.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t add this to your plan. Try again.') } finally { setBusy(null) }
  }
  async function undo() {
    if (!saved.added || !memberId) return
    setError(null); setBusy('undo')
    try { await removePlanFromTrip(saved.added.ids, memberId, saved.added.placeIds); onChange({ ...saved, added: undefined }); setNote('Removed from your plan.') }
    catch { setError('Couldn’t undo that. Try again.') } finally { setBusy(null) }
  }
  async function email() {
    setError(null); setNote(null); setBusy('email')
    try {
      const result = await finalizeAgentPlan(tripId, saved.id, plan)
      if (result === 'limited') return setNote('You’ve hit today’s email limit. Try again tomorrow.')
      if (result === 'no_email') return setNote('Sign in with your email to get a copy.')
      onChange({ ...saved, finalized: new Date().toISOString() })
    } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t send the email. Try again.') } finally { setBusy(null) }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="leading-relaxed text-ink">{plan.summary}</p>
        {plan.totalMinor > 0 && <p className="mt-3 text-lg font-semibold">{formatMoney(plan.totalMinor, plan.currency)} <span className="text-sm font-normal text-muted">for {covers}</span></p>}
        {soonest && <p className={`text-sm ${expired ? 'text-danger' : 'text-muted'}`}>{expired ? 'Some of these prices have expired. Refresh the plan before you book.' : `Prices are held until ${DateTime.fromISO(soonest).toFormat('ccc d LLL, h:mm a')}.`}</p>}
      </div>

      <ol className="flex flex-col gap-5">
        {plan.days.map((day, index) => {
          const newStay = day.stay && day.stay.rateId !== plan.days[index - 1]?.stay?.rateId
          return (
            <li key={day.date} className="flex flex-col gap-3">
              <h4 className="font-semibold text-ink">{DateTime.fromISO(day.date).toFormat('cccc d LLLL')}</h4>
              {day.stay && newStay && (
                <div className="flex items-center gap-3 rounded-surface bg-brand-50 p-2.5">
                  <Thumb src={day.stay.photo} icon={ICON.hotel} />
                  <div className="min-w-0 text-sm">
                    <p className="text-muted">Staying at</p>
                    <Named href={mapsLink(day.stay.name, day.stay.address ?? destination)}>{day.stay.name}</Named>
                    <p className="text-xs text-muted">{day.stay.refundable ? 'Free cancellation' : 'Non-refundable'}</p>
                  </div>
                </div>
              )}
              {day.stay && !newStay && <p className="text-sm text-muted">{day.date === day.stay.checkout ? `Check out of ${day.stay.name}` : `Another night at ${day.stay.name}`}</p>}
              <ul className="flex flex-col gap-3">
                {day.items.map((item) => {
                  const saved = placeName(item.placeId)
                  return (
                    <li key={`${item.node}-${item.depart?.local ?? item.start}`} className="flex items-center gap-3">
                      <Thumb src={item.photo} icon={item.kind === 'flight' ? ICON.flight : item.kind === 'activity' ? ICON.activity : saved ? ICON.place : ICON.free} />
                      <div className="min-w-0 text-sm">
                        {item.depart && item.arrive
                          ? <p className="tabular-nums text-muted">{item.depart.airport} {hhmm(item.depart.local)} → {item.arrive.airport} {hhmm(item.arrive.local)}{item.arrive.local.slice(0, 10) > item.depart.local.slice(0, 10) ? <> <span aria-hidden="true">+1</span><span className="sr-only">, next day</span></> : null} <span className="text-xs">local times</span></p>
                          : <p className="tabular-nums text-muted">{hhmm(item.start)}–{hhmm(item.end)}</p>}
                        {item.kind === 'flight' ? <span className="font-medium text-ink">Flight {item.title}</span>
                          : saved ? <Named to={`/t/${tripId}/more/places/${item.placeId}`}>{item.title}</Named>
                          : item.kind === 'activity' ? <Named href={item.url ?? mapsLink(item.title, destination)}>{item.title}</Named>
                          : <span className="font-medium text-ink">{item.title}</span>}
                      </div>
                    </li>
                  )
                })}
                {!day.items.length && <li className="text-sm text-muted">A free day.</li>}
              </ul>
            </li>
          )
        })}
      </ol>
      {unchecked && <p className="text-xs text-muted">Travel times between a few stops couldn’t be checked, so leave some slack.</p>}

      {!!plan.bookable.length && (
        <div>
          <h4 className="font-semibold">What it costs</h4>
          <ul className="mt-1 text-sm">
            {plan.bookable.map((b) => (
              <li key={`${b.kind}-${b.ref}`} className="flex justify-between gap-3 border-b border-line py-2">
                <span className="min-w-0"><span className="text-muted">{WHAT[b.kind]}</span>{b.label && <span className="block"><Named href={bookingLink(b, plan, flights, destination)}>{b.label}</Named></span>}</span>
                <span className="shrink-0 tabular-nums">{formatMoney(b.totalMinor, plan.currency)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 py-2 font-semibold"><span>Total</span><span className="tabular-nums">{formatMoney(plan.totalMinor, plan.currency)}</span></li>
          </ul>
          <p className="text-xs text-muted">You’ll book these yourself for now: each link opens a search for that exact flight, hotel or tour. Booking through Stowaway is coming soon.</p>
        </div>
      )}

      {!!plan.assumptions.length && (
        <div>
          <h4 className="font-semibold">Good to know</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{plan.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}

      <ErrorNote error={error} />
      {saved.added && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-surface bg-brand-50 p-3 text-sm">
          <span>Added {plural(saved.added.ids.length, 'item')} to your plan{saved.added.skipped ? `. ${plural(saved.added.skipped, 'item')} clashed with plans you already had, so we left them out` : ''}.</span>
          <Link to={`/t/${tripId}/plan`} className="font-medium text-action underline">See the plan</Link>
          <button type="button" onClick={() => void undo()} disabled={!!busy} className="font-medium text-action underline">{busy === 'undo' ? 'Undoing…' : 'Undo'}</button>
        </div>
      )}
      {saved.finalized && <p role="status" className="rounded-surface bg-brand-50 p-3 text-sm">We’ll email you a copy of this plan.</p>}
      {note && <p role="status" className="rounded-surface bg-brand-50 p-3 text-sm">{note}</p>}

      <div className="flex flex-wrap gap-2">
        {!saved.added && <Button onClick={() => void add()} disabled={!!busy}>{busy === 'add' ? 'Adding…' : 'Add to plan'}</Button>}
        {!saved.finalized && <Button variant="secondary" onClick={() => void email()} disabled={!!busy || expired}>{busy === 'email' ? 'Sending…' : 'Email me a copy'}</Button>}
        <Button variant="secondary" onClick={onEdit} disabled={!!busy}>Change details</Button>
        <Button variant="ghost" onClick={onClear} disabled={!!busy}>Start over</Button>
        {onDone && <Button variant="ghost" onClick={onDone}>Close</Button>}
      </div>
    </div>
  )
}

/** The planner as its own page: a trip's More → Plan with real prices. */
export function LivePlannerScreen() {
  const { tripId } = useParams()
  if (!tripId) return null
  return (
    <div>
      <PageHeader title="Plan with real prices" back={`/t/${tripId}/more/ideas`} />
      <div className="mx-auto max-w-2xl px-4 py-4"><LivePlanner tripId={tripId} /></div>
    </div>
  )
}
