import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { DateTime } from 'luxon'
import { useMyMemberId } from '@/data/device'
import { useMembers, usePlaces, useTrip } from '@/data/hooks'
import { ITEM_KINDS, ITEM_STATUSES, type ItemKind, type ItineraryItem, type PlaceCategory } from '@/data/types'
import { newId } from '@/lib/ids'
import { minorUnits } from '@/lib/money'
import { checkLocalTime, isValidZone, normalizeLocal } from '@/lib/time'
import { Button, DateInput, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/ui'
import { PlacePicker } from '@/features/places/PlacePicker'
import { saveItem, useItem } from './data'
import { KIND_STYLE, STATUS_TEXT } from './kinds'

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
  return <p id={`${invalid.name}-problem`} role="alert" className="text-sm text-red-700">{invalid.message}</p>
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
}

export function ItemFormScreen() {
  const { tripId, itemId } = useParams() as { tripId: string; itemId?: string }
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const trip = useTrip(tripId)
  const loadedPlaces = usePlaces(tripId)
  const places = loadedPlaces ?? []
  const members = useMembers(tripId) ?? []
  const existing = useItem(itemId)
  const tripTz = trip?.timezone ?? 'America/New_York'
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<{ name: string; message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [f, setF] = useState<FormState | null>(null)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((cur) => (cur ? { ...cur, [k]: v } : cur))

  // Initialise once: from the item being edited, or from ?day=, ?place= and ?title= (a vote's winner).
  useEffect(() => {
    if (f || !trip) return
    if (itemId) {
      if (!existing) return
      const s = normalizeLocal(existing.start_local)
      const e = existing.end_local ? normalizeLocal(existing.end_local) : null
      setF({
        title: existing.title, kind: existing.kind, placeId: existing.place_id, toPlaceId: existing.to_place_id,
        allDay: existing.all_day, startDate: s.slice(0, 10), startTime: s.slice(11), endDate: e?.slice(0, 10) ?? s.slice(0, 10), endTime: e?.slice(11) ?? '',
        startTz: existing.start_tz, endTz: existing.end_tz ?? existing.start_tz, status: existing.status, code: existing.confirmation_code ?? '',
        everyone: !existing.attendee_ids, attendees: existing.attendee_ids ?? [], notes: existing.notes ?? '',
        cost: existing.est_cost_minor != null ? String(existing.est_cost_minor / 10 ** minorUnits(existing.est_cost_currency ?? 'USD')) : '',
        costCurrency: existing.est_cost_currency ?? trip.local_currency ?? trip.base_currency,
      })
      return
    }
    if (search.get('place') && !loadedPlaces) return // wait for places so the form can be prefilled
    const day = search.get('day') ?? trip.start_date ?? DateTime.now().toISODate()!
    const place = places.find((p) => p.id === search.get('place'))
    const kind = (place && KIND_FOR_CATEGORY[place.category]) ?? 'activity'
    const lodging = kind === 'lodging'
    const time = search.get('time')
    const asked = time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : null
    setF({
      title: place?.name ?? search.get('title')?.slice(0, 120) ?? '', kind, placeId: place?.id ?? null, toPlaceId: null, allDay: false,
      startDate: day, startTime: asked ?? (lodging ? '15:00' : kind === 'meal' ? '19:00' : '09:00'),
      endDate: lodging ? DateTime.fromISO(day).plus({ days: 1 }).toISODate()! : day, endTime: lodging ? '11:00' : '',
      startTz: tripTz, endTz: tripTz, status: 'confirmed', code: '', everyone: true, attendees: [], notes: '', cost: '',
      costCurrency: trip.local_currency ?? trip.base_currency,
    })
  }, [f, trip, itemId, existing, search, places, loadedPlaces, tripTz])

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
    if (![f.startTz, f.endTz].every(isValidZone)) return setError('Unknown time zone.')
    const start_local = `${f.startDate}T${f.allDay ? '00:00' : f.startTime || '00:00'}`
    const hasEnd = f.allDay ? f.endDate !== f.startDate : !!f.endTime
    const end_local = hasEnd ? `${f.endDate}T${f.allDay ? '00:00' : f.endTime}` : null
    const amount = f.cost.trim() ? Number(f.cost) : null
    if (amount != null && !(amount >= 0)) return setError('Cost must be a number.')
    const item: ItineraryItem = {
      ...(existing ?? {}),
      id: existing?.id ?? newId(),
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
      details: existing?.details ?? {},
      notes: f.notes.trim() || null,
      est_cost_minor: amount == null ? null : Math.round(amount * 10 ** minorUnits(f.costCurrency)),
      est_cost_currency: amount == null ? null : f.costCurrency,
    }
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      await saveItem(item, me)
      navigate(`/t/${tripId}/plan/${item.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      savingRef.current = false
      setSaving(false)
    }
  }

  const flag = (name: string) => (invalid?.name === name ? { 'aria-invalid': true, 'aria-describedby': `${name}-problem` } : {})
  const back = itemId ? `/t/${tripId}/plan/${itemId}` : `/t/${tripId}/plan?day=${f.startDate}`
  return (
    <div className="min-h-full pb-10">
      <PageHeader title={itemId ? 'Edit' : 'Add to plan'} back={back} />
      <form onSubmit={submit} noValidate onInput={() => setInvalid(null)} className="mx-auto max-w-md space-y-4 p-4">
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-4 gap-1.5">
          {ITEM_KINDS.map((k) => {
            const s = KIND_STYLE[k]
            return (
              <button key={k} type="button" role="radio" aria-checked={f.kind === k} onClick={() => set('kind', k)}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border text-xs ${f.kind === k ? `${s.bg} ${s.border} ${s.text} font-semibold` : 'border-stone-200 bg-white text-stone-600'}`}>
                <s.Icon aria-hidden="true" className="size-4" />{s.label}
              </button>
            )
          })}
        </div>

        <Field label={travel ? 'From' : 'Place'}>
          <PlacePicker places={places} value={f.placeId} label={travel ? 'From place' : 'Place'} onChange={(id) => {
            const p = places.find((x) => x.id === id)
            setF((cur) => cur && { ...cur, placeId: id, title: cur.title || p?.name || '' })
          }} />
        </Field>
        {travel && (
          <Field label="To">
            <PlacePicker places={places} value={f.toPlaceId} label="To place" onChange={(id) => set('toPlaceId', id)} />
          </Field>
        )}
        <Field label="Name">
          <Input value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={200} required placeholder={travel ? 'UA 1234 to New York' : 'Walk along the High Line'} />
        </Field>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={f.allDay} onChange={(e) => set('allDay', e.target.checked)} className="size-5 accent-brand-600" /> All day
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-stone-700">{f.kind === 'lodging' ? 'Check in' : travel ? 'Departs' : 'Starts'}</legend>
          <div className="grid grid-cols-2 gap-2">
            <DateInput name="startDate" aria-label="Start date" value={f.startDate} required {...flag('startDate')} onValue={(date) => setF((c) => c && { ...c, startDate: date, endDate: c.endDate < date ? date : c.endDate })} />
            {!f.allDay && <Input type="time" name="startTime" aria-label="Start time" value={f.startTime} required {...flag('startTime')} onChange={(e) => set('startTime', e.target.value)} />}
          </div>
          <FieldProblem invalid={invalid} names={['startDate', 'startTime']} />
          {showZones && !f.allDay && (
            <Select aria-label="Start time zone" value={f.startTz} onChange={(e) => setF((c) => c && { ...c, startTz: e.target.value, endTz: c.endTz === c.startTz ? e.target.value : c.endTz })}>
              {[...new Set([tripTz, ...ZONES])].map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
            </Select>
          )}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-stone-700">{f.kind === 'lodging' ? 'Check out' : travel ? 'Arrives' : 'Ends'} <span className="font-normal text-stone-500">(optional)</span></legend>
          <div className="grid grid-cols-2 gap-2">
            <DateInput name="endDate" aria-label="End date" value={f.endDate} min={f.startDate} {...flag('endDate')} onValue={(date) => set('endDate', date)} />
            {!f.allDay && <Input type="time" name="endTime" aria-label="End time" value={f.endTime} {...flag('endTime')} onChange={(e) => set('endTime', e.target.value)} />}
          </div>
          <FieldProblem invalid={invalid} names={['endDate', 'endTime']} />
          {showZones && !f.allDay && (
            <Select aria-label="End time zone" value={f.endTz} onChange={(e) => set('endTz', e.target.value)}>
              {[...new Set([tripTz, ...ZONES])].map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
            </Select>
          )}
        </fieldset>
        {!showZones && !f.allDay && (
          <button type="button" onClick={() => set('startTz', f.startTz === tripTz ? 'America/New_York' : f.startTz)} className="min-h-11 text-sm text-brand-700 underline underline-offset-4">
            Happens in a different time zone?
          </button>
        )}
        {dstWarning && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{dstWarning}</p>}

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

        <fieldset>
          <legend className="text-sm font-medium text-stone-700">Who's going</legend>
          <label className="mt-1 flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={f.everyone} onChange={(e) => set('everyone', e.target.checked)} className="size-5 accent-brand-600" /> Everyone
          </label>
          {!f.everyone && (
            <div className="grid grid-cols-2 gap-1">
              {members.map((m) => (
                <label key={m.id} className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={f.attendees.includes(m.id)} className="size-5 accent-brand-600"
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

        <ErrorNote error={error ?? (invalid && !DATE_TIME_FIELDS.includes(invalid.name) ? invalid.message : null)} />
        <Button type="submit" className="w-full" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </form>
    </div>
  )
}
