import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { DateTime } from 'luxon'
import { useMyMemberId, useTripAccess } from '@/data/device'
import { can } from '@/data/access'
import { useMembers, usePlaces, useTrip } from '@/data/hooks'
import { ITEM_KINDS, ITEM_STATUSES, type ItemKind, type ItineraryItem, type PlaceCategory } from '@/data/types'
import { newId, stableId } from '@/lib/ids'
import { minorUnits } from '@/lib/money'
import { checkLocalTime, isValidZone, normalizeLocal } from '@/lib/time'
import { Button, DateInput, Disclosure, ErrorNote, Field, Input, LinkButton, PageHeader, Select, Textarea } from '@/ui'
import { PlacePicker } from '@/features/places/PlacePicker'
import { saveItem, useItem } from './data'
import { KIND_STYLE, STATUS_TEXT } from './kinds'
import { PlaceIdentity } from '@/features/places/PlaceIdentity'
import { useToast } from '@/ui/ToastProvider'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { ticketPlanDraft } from '@/features/tickets/toPlan'
import { duplicateEndDate, undoDuplicate } from './reschedule'

const ZONES = [
  'America/Guatemala', 'America/Mexico_City', 'America/El_Salvador', 'America/Costa_Rica', 'America/Panama',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix',
  'Europe/London', 'Europe/Madrid', 'UTC',
]

const KIND_FOR_CATEGORY: Partial<Record<PlaceCategory, ItemKind>> = {
  lodging: 'lodging', food: 'meal', drink: 'meal', flight: 'flight', transport: 'transport', reservation: 'reservation',
}

const DATE_TIME_FIELDS = ['startDate', 'startTime', 'endDate', 'endTime']

/** Why a field can't be saved, in words: "End time isn't valid. Finish typing it or clear it." */
function fieldProblem(el: HTMLInputElement): string {
  const what = el.getAttribute('aria-label') ?? 'This field'
  if (el.validity.valueMissing) return `${what} is needed.`
  if (el.validity.badInput) return `${what} isn't valid. Finish typing it or clear it.`
  return el.validity.customError ? `${what} isn't valid. ${el.validationMessage}` : `${what} isn't valid.`
}

function FieldProblem({ invalid, names }: { invalid: { name: string; message: string } | null; names: string[] }) {
  if (!invalid || !names.includes(invalid.name)) return null
  return <p id={`${invalid.name}-problem`} role="alert" className="text-sm text-danger-ink">{invalid.message}</p>
}

interface FormState {
  title: string
  kind: ItemKind
  placeId: string | null
  toPlaceId: string | null
  allDay: boolean
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  startTz: string
  endTz: string
  status: ItineraryItem['status']
  code: string
  everyone: boolean
  attendees: string[]
  notes: string
  cost: string
  costCurrency: string
  journey: string
  journeyLocation: string
  journeyStay: string
  journeyTransfer: string
}

export function ItemFormScreen() {
  const { tripId, itemId } = useParams() as { tripId: string; itemId?: string }
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const notify = useToast()
  const [draftItemId] = useState(newId)
  const me = useMyMemberId(tripId)
  const mayPlan = can(useTripAccess(tripId), 'plan')
  const trip = useTrip(tripId)
  const loadedPlaces = usePlaces(tripId)
  const places = loadedPlaces ?? []
  const members = useMembers(tripId) ?? []
  const existing = useItem(itemId)
  const copyId = !itemId ? search.get('copy') : null
  const copy = useLiveQuery(async () => copyId ? (await db.itinerary_items.get(copyId)) ?? null : undefined, [copyId])
  const ticketId = !itemId ? search.get('ticket') : null
  const sourceTicket = useLiveQuery(async () => ticketId ? (await db.attachments.get(ticketId)) ?? null : undefined, [ticketId])
  const ticketItem = useItem(sourceTicket?.item_id ?? undefined)
  const tripTz = trip?.timezone ?? 'America/New_York'
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<{ name: string; message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [more, setMore] = useState<boolean | null>(null)
  const savingRef = useRef(false)
  const [f, setF] = useState<FormState | null>(null)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((cur) => (cur ? { ...cur, [k]: v } : cur))

  // Initialise once: from the item being edited, or from ?day=, ?place= and ?title= (a vote's winner).
  useEffect(() => {
    if (f || !trip) return
    if (itemId || copyId) {
      const source = itemId ? existing : copy
      if (!source || source.deleted_at || source.trip_id !== tripId) return
      const s = normalizeLocal(source.start_local)
      const e = source.end_local ? normalizeLocal(source.end_local) : null
      setF({
        journey: source.details?.journey_direction ?? '', journeyLocation: source.details?.journey_location ?? '', journeyStay: source.details?.journey_stay ?? '', journeyTransfer: source.details?.journey_transfer ?? '',
        title: source.title, kind: source.kind, placeId: source.place_id, toPlaceId: source.to_place_id,
        allDay: source.all_day, startDate: s.slice(0, 10), startTime: s.slice(11), endDate: e?.slice(0, 10) ?? s.slice(0, 10), endTime: e?.slice(11) ?? '',
        startTz: source.start_tz, endTz: source.end_tz ?? source.start_tz, status: copyId ? 'tentative' : source.status, code: copyId ? '' : source.confirmation_code ?? '',
        everyone: !source.attendee_ids, attendees: source.attendee_ids ?? [], notes: source.notes ?? '',
        cost: source.est_cost_minor != null ? String(source.est_cost_minor / 10 ** minorUnits(source.est_cost_currency ?? 'USD')) : '',
        costCurrency: source.est_cost_currency ?? trip.local_currency ?? trip.base_currency,
      })
      return
    }
    if (ticketId) {
      if (!sourceTicket || sourceTicket.deleted_at || sourceTicket.trip_id !== tripId) return
      const draft = ticketPlanDraft(sourceTicket, trip)
      setF({ journey: '', journeyLocation: '', journeyStay: '', journeyTransfer: '', ...draft, placeId: null, toPlaceId: null, allDay: false, status: 'tentative', everyone: true, attendees: [], cost: '', costCurrency: trip.local_currency ?? trip.base_currency })
      return
    }
    if (search.get('place') && !loadedPlaces) return // wait for places so the form can be prefilled
    const attendee = search.get('attendee')
    if (attendee && !members.length) return
    const selectedAttendee = members.find((m) => m.id === attendee)
    const place = places.find((p) => p.id === search.get('place'))
    const importedEvent = !!place?.external_ids.ticketmaster
    const day = search.get('day') ?? (importedEvent ? place?.external_ids.event_date : undefined) ?? trip.start_date ?? DateTime.now().toISODate()!
    const journey = ['arrival', 'departure'].includes(search.get('journey') ?? '') ? search.get('journey')! : ''
    const kind = journey ? 'flight' : (place && KIND_FOR_CATEGORY[place.category]) ?? 'activity'
    const lodging = kind === 'lodging'
    const time = search.get('time') ?? (importedEvent ? place?.external_ids.event_time : undefined)
    const asked = time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : null
    let eventZone = tripTz
    const requestedZone = search.get('zone') ?? (importedEvent ? place?.external_ids.event_zone : undefined)
    if (requestedZone) { try { new Intl.DateTimeFormat('en', { timeZone: requestedZone }).format(); eventZone = requestedZone } catch { /* Keep the trip zone for invalid links. */ } }
    setF({
      journey, journeyLocation: '', journeyStay: '', journeyTransfer: '',
      title: place?.name ?? search.get('title')?.slice(0, 120) ?? '', kind, placeId: place?.id ?? null, toPlaceId: null, allDay: importedEvent && !asked,
      startDate: day, startTime: asked ?? (lodging ? '15:00' : kind === 'meal' ? '19:00' : '09:00'),
      endDate: lodging ? DateTime.fromISO(day).plus({ days: 1 }).toISODate()! : day, endTime: lodging ? '11:00' : '',
      startTz: eventZone, endTz: eventZone, status: search.get('decision') || journey || importedEvent || place && !['booked', 'visited'].includes(place.status) ? 'tentative' : 'confirmed', code: '', everyone: !selectedAttendee, attendees: selectedAttendee ? [selectedAttendee.id] : [], notes: importedEvent ? `Event suggestion from Ticketmaster. Check availability and book separately.${!asked ? ' Start time to be announced.' : ''}` : place?.notes ?? '', cost: '',
      costCurrency: trip.local_currency ?? trip.base_currency,
    })
  }, [f, trip, tripId, itemId, existing, copyId, copy, ticketId, sourceTicket, search, places, loadedPlaces, tripTz, members])

  const travel = f?.kind === 'flight' || f?.kind === 'transport'
  const showZones = travel || (f && (f.startTz !== tripTz || f.endTz !== tripTz))
  const dstWarning = useMemo(() => {
    if (!f || f.allDay || !f.startTime) return null
    const checks = [checkLocalTime(`${f.startDate}T${f.startTime}`, f.startTz)]
    if (f.endTime) checks.push(checkLocalTime(`${f.endDate}T${f.endTime}`, f.endTz))
    if (checks.some((c) => c.kind === 'gap')) return "That time doesn't exist (clocks spring forward); it'll be saved an hour later."
    if (checks.some((c) => c.kind === 'ambiguous')) return 'That time happens twice (clocks fall back); the second one is used.'
    return null
  }, [f])

  if (ticketId && (sourceTicket === null || sourceTicket && (sourceTicket.deleted_at || sourceTicket.trip_id !== tripId)) || copyId && (copy === null || copy && (copy.deleted_at || copy.trip_id !== tripId))) return <><PageHeader title="Add to itinerary" back={`/t/${tripId}/plan`} /><p className="p-4">The source was removed or is unavailable.</p></>
  if ((ticketId || copyId) && !mayPlan) return <><PageHeader title="Itinerary" back={`/t/${tripId}/plan`} /><p className="p-4">You do not have permission to edit this itinerary.</p></>
  if (ticketId && ticketItem && !ticketItem.deleted_at && ticketItem.trip_id === tripId) return <><PageHeader title="Ticket" back={`/t/${tripId}/tickets/${ticketId}`} /><div className="space-y-4 p-4"><p>Already linked to {ticketItem.title}.</p><LinkButton to={`/t/${tripId}/plan/${ticketItem.id}`}>View itinerary item</LinkButton></div></>
  if (!f) return <PageHeader title={itemId ? 'Edit' : 'Add to plan'} back={`/t/${tripId}/plan`} />

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!f || !trip || savingRef.current) return
    if (!f.title.trim()) return setError('Give it a name.')
    // The form checks its own fields (noValidate). The browser's message bubble doesn't show
    // everywhere, and a half-typed time then made Save do nothing at all.
    const bad = [...e.currentTarget.elements].find((el): el is HTMLInputElement => el instanceof HTMLInputElement && !el.validity.valid)
    if (bad) {
      setError(null)
      setInvalid({ name: bad.name, message: fieldProblem(bad) })
      bad.focus()
      return
    }
    if (!mayPlan) return setError('Only the trip’s organizers can change this itinerary.')
    if (travel && f.journey && (f.allDay || !f.everyone && !f.attendees.length)) return setError('Travel on the board needs a time and at least one traveler.')
    if (travel && f.journey === 'arrival' && !f.endTime) return setError('Add the arrival time so the group knows when you get in.')
    if (![f.startTz, f.endTz].every(isValidZone)) return setError('Unknown time zone.')
    const start_local = `${f.startDate}T${f.allDay ? '00:00' : f.startTime || '00:00'}`
    const hasEnd = f.allDay ? f.endDate !== f.startDate : !!f.endTime
    const end_local = hasEnd ? `${f.endDate}T${f.allDay ? '00:00' : f.endTime}` : null
    const amount = f.cost.trim() ? Number(f.cost) : null
    if (amount != null && !(amount >= 0)) return setError('Cost must be a number.')
    const item: ItineraryItem = {
      ...(existing ?? {}),
      id: existing?.id ?? (search.get('decision') && search.get('option') && !copyId ? stableId(tripId, 'decision-plan', search.get('option')!) : draftItemId),
      trip_id: tripId,
      title: f.title.trim(),
      kind: f.kind,
      place_id: f.placeId,
      to_place_id: travel ? f.toPlaceId : null,
      all_day: f.allDay,
      start_local,
      start_tz: f.allDay ? tripTz : f.startTz,
      end_local,
      end_tz: end_local ? (f.allDay ? tripTz : f.endTz) : null,
      start_at: '',
      end_at: null,
      status: f.status,
      confirmation_code: f.code.trim() || null,
      attendee_ids: f.everyone ? null : f.attendees,
      details: { ...existing?.details, journey_direction: travel ? f.journey : '', journey_location: f.journeyLocation.trim(), journey_stay: f.journeyStay.trim(), journey_transfer: f.journeyTransfer.trim(), ...(!itemId && !copyId && search.get('decision') && search.get('option') ? { decision_poll_id: search.get('decision')!, decision_option_id: search.get('option')! } : {}) },
      notes: f.notes.trim() || null,
      est_cost_minor: amount == null ? null : Math.round(amount * 10 ** minorUnits(f.costCurrency)),
      est_cost_currency: amount == null ? null : f.costCurrency,
    }
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      await saveItem(item, me, ticketId ?? undefined)
      if (!itemId && search.get('decision')) {
        notify({ message: 'Added to the plan on this phone. It will sync when connected.' })
        navigate(`/t/${tripId}/more/vote/${search.get('decision')}`, { replace: true })
        return
      }
      if (copyId) {
        const saved = await db.itinerary_items.get(item.id)
        notify({ message: 'Item duplicated.', undo: saved ? () => undoDuplicate(saved, me) : undefined })
      } else if (ticketId) notify({ message: 'Added to itinerary.' })
      if (!itemId && search.get('place')) {
        notify({ message: `${item.title} added to itinerary.` })
        navigate(`/t/${tripId}/plan?day=${f.startDate}`, { replace: true })
      } else navigate(`/t/${tripId}/plan/${item.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      savingRef.current = false
      setSaving(false)
    }
  }

  const flag = (name: string) => (invalid?.name === name ? { 'aria-invalid': true, 'aria-describedby': `${name}-problem` } : {})
  // Who's going, cost and notes are optional: closed for a new item, open when any of them is already filled in.
  const hasOptional = !f.everyone || !!f.cost || !!f.notes
  const sourcePlace = !itemId && search.get('place') ? places.find((place) => place.id === f.placeId) : undefined
  const back = itemId ? `/t/${tripId}/plan/${itemId}` : ticketId ? `/t/${tripId}/tickets/${ticketId}` : copyId ? `/t/${tripId}/plan/${copyId}` : `/t/${tripId}/plan?day=${f.startDate}`
  const nameField = <Field label="Name"><Input value={f.title} onChange={(event) => set('title', event.target.value)} maxLength={200} required placeholder={travel ? 'UA 1234 to New York' : 'Walk along the High Line'} /></Field>
  const activityFields = <div className="space-y-4">
    <div role="radiogroup" aria-label="Type" className="grid grid-cols-4 gap-1.5">
      {ITEM_KINDS.map((kind) => {
        const style = KIND_STYLE[kind]
        return <button key={kind} type="button" role="radio" aria-checked={f.kind === kind} onClick={() => set('kind', kind)}
          className={`ui-press flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-control border text-xs ${f.kind === kind ? `${style.bg} ${style.border} ${style.text} font-semibold` : 'border-line bg-surface text-muted'}`}>
          <style.Icon aria-hidden="true" className="size-4" />{style.label}
        </button>
      })}
    </div>
    <Field label={travel ? 'From' : 'Place'}>
      <PlacePicker places={places} value={f.placeId} label={travel ? 'From place' : 'Place'} onChange={(id) => {
        const place = places.find((place) => place.id === id)
        setF((current) => current && { ...current, placeId: id, title: current.title || place?.name || '' })
      }} />
    </Field>
    {travel && <Field label="To"><PlacePicker places={places} value={f.toPlaceId} label="To place" onChange={(id) => set('toPlaceId', id)} /></Field>}
    {!ticketId && nameField}
  </div>
  return (
    <div className="min-h-full">
      <PageHeader title={itemId ? 'Edit' : copyId ? 'Duplicate item' : ticketId ? 'Review itinerary item' : 'Add to plan'} back={sourcePlace ? `/t/${tripId}/more/places/${sourcePlace.id}` : back} />
      <form onSubmit={submit} noValidate onInput={() => setInvalid(null)} className="mx-auto max-w-md space-y-4 p-4 pb-0">
        {sourceTicket && ticketId && <section className="plan-source-place" aria-label="Source ticket"><p className="ui-label">Ticket</p><Link to={`/t/${tripId}/tickets/${sourceTicket.id}`} className="ui-link">{sourceTicket.title}</Link></section>}
        {sourcePlace && <section className="plan-source-place" aria-label="Your saved place"><p className="notebook-label mb-3">From your saved places</p><PlaceIdentity place={sourcePlace} members={members} compact /></section>}
        {ticketId ? <>{nameField}<Disclosure summary={`${KIND_STYLE[f.kind].label} · Type and locations`}>{activityFields}</Disclosure></> : sourcePlace ? <Disclosure summary="Edit place, name & activity type">{activityFields}</Disclosure> : activityFields}

        {travel && <section className="space-y-3 rounded-surface border border-line p-4" aria-label="Group travel details">
          <Field label="Show on arrivals & departures"><Select value={f.journey} onChange={(e) => set('journey', e.target.value)}><option value="">Local travel / not on the board</option><option value="arrival">Arrival</option><option value="departure">Departure</option></Select></Field>
          {f.journey && <>
            <p className="text-sm text-muted">Shared with the group. Enter departure and arrival times in each location’s time zone. Choose travelers under More options.</p>
            <Field label={f.journey === 'arrival' ? 'Arrival airport or station' : 'Departure airport or station'} hint="Optional if you selected a place above. Use the same name to find possible shared rides."><Input value={f.journeyLocation} onChange={(e) => set('journeyLocation', e.target.value)} maxLength={200} /></Field>
            <Field label="Staying at"><Input value={f.journeyStay} onChange={(e) => set('journeyStay', e.target.value)} maxLength={200} placeholder="Hotel or accommodation" /></Field>
            <Field label="Transfer / meeting point"><Textarea value={f.journeyTransfer} onChange={(e) => set('journeyTransfer', e.target.value)} maxLength={2000} placeholder="Who’s arranging the ride, where to meet…" /></Field>
          </>}
        </section>}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={f.allDay} onChange={(e) => set('allDay', e.target.checked)} className="ui-check" /> All day
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">{f.kind === 'lodging' ? 'Check in' : travel ? 'Departs' : 'Starts'}</legend>
          <div className="grid grid-cols-2 gap-2">
            <DateInput name="startDate" aria-label="Start date" value={f.startDate} required {...flag('startDate')} onValue={(date) => setF((c) => c && { ...c, startDate: date, endDate: copy ? duplicateEndDate(copy, date) : c.endDate < date ? date : c.endDate })} />
            {!f.allDay && <Input type="time" name="startTime" aria-label="Start time" value={f.startTime} required {...flag('startTime')} onChange={(e) => set('startTime', e.target.value)} />}
          </div>
          <FieldProblem invalid={invalid} names={['startDate', 'startTime']} />
          {showZones && !f.allDay && (
            <Select aria-label="Start time zone" value={f.startTz} onChange={(e) => setF((c) => c && { ...c, startTz: e.target.value, endTz: c.endTz === c.startTz ? e.target.value : c.endTz })}>
              {[...new Set([tripTz, f.startTz, f.endTz, ...ZONES])].map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
            </Select>
          )}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">{f.kind === 'lodging' ? 'Check out' : travel ? 'Arrives' : 'Ends'} <span className="font-normal text-muted">{travel && f.journey === 'arrival' ? '(required for the board)' : '(optional)'}</span></legend>
          <div className="grid grid-cols-2 gap-2">
            <DateInput name="endDate" aria-label="End date" required={travel && f.journey === 'arrival'} value={f.endDate} min={f.startDate} {...flag('endDate')} onValue={(date) => set('endDate', date)} />
            {!f.allDay && <Input type="time" name="endTime" aria-label="End time" required={travel && f.journey === 'arrival'} value={f.endTime} {...flag('endTime')} onChange={(e) => set('endTime', e.target.value)} />}
          </div>
          <FieldProblem invalid={invalid} names={['endDate', 'endTime']} />
          {showZones && !f.allDay && (
            <Select aria-label="End time zone" value={f.endTz} onChange={(e) => set('endTz', e.target.value)}>
              {[...new Set([tripTz, f.startTz, f.endTz, ...ZONES])].map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
            </Select>
          )}
        </fieldset>
        {!showZones && !f.allDay && (
          <button type="button" onClick={() => set('startTz', f.startTz === tripTz ? 'America/New_York' : f.startTz)} className="ui-link">
            Happens in a different time zone?
          </button>
        )}
        {dstWarning && <p className="rounded-surface bg-warning px-3 py-2 text-sm text-warning-ink">{dstWarning}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set('status', e.target.value as ItineraryItem['status'])}>
              {ITEM_STATUSES.map((s) => <option key={s} value={s}>{STATUS_TEXT[s]}</option>)}
            </Select>
          </Field>
          <Field label="Confirmation code">
            <Input value={f.code} onChange={(e) => set('code', e.target.value)} autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
          </Field>
        </div>

        <Disclosure summary="More options" open={more ?? hasOptional} onToggle={setMore}>
          <div className="space-y-4">
          <fieldset>
            <legend className="text-sm font-medium text-ink">Who's going</legend>
            <label className="mt-1 flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={f.everyone} onChange={(e) => set('everyone', e.target.checked)} className="ui-check" /> Everyone
            </label>
            {!f.everyone && (
              <div className="grid grid-cols-2 gap-1">
                {members.map((m) => (
                  <label key={m.id} className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.attendees.includes(m.id)} className="ui-check"
                      onChange={(e) => set('attendees', e.target.checked ? [...f.attendees, m.id] : f.attendees.filter((x) => x !== m.id))} />
                    {m.display_name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <Field label="Estimated cost (per group)">
              <Input inputMode="decimal" value={f.cost} onChange={(e) => set('cost', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Currency">
              <Select value={f.costCurrency} onChange={(e) => set('costCurrency', e.target.value)}>
                {[...new Set([trip?.local_currency, trip?.base_currency].filter(Boolean) as string[])].map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Meeting point, what to bring, who booked it…" />
          </Field>
          </div>
        </Disclosure>

        <div className="ui-form-actions">
          <ErrorNote error={error ?? (invalid && !DATE_TIME_FIELDS.includes(invalid.name) ? invalid.message : null)} />
          <Button type="submit" className="w-full" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : sourcePlace ? 'Add to the plan' : ticketId ? 'Add to itinerary' : copyId ? 'Add copy' : 'Save'}</Button>
        </div>
      </form>
    </div>
  )
}
