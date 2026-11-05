import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { DateTime } from 'luxon'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import { applyIdea, saveProfile } from '@/features/discovery/data'
import { ideasSchema, type Draft } from '@/features/discovery/model'
import { ChevronDown, X } from 'lucide-react'
import { DestinationSearch } from '@/features/destinations/DestinationSearch'
import { currencyFor, lookupZone, MAX_AREAS, type Destination } from '@/features/destinations/destinations'
import { isValidZone } from '@/lib/time'
import { Button, ErrorNote, Field, Input, PageHeader, Select } from '@/ui'
import { DateRangePicker } from '@/ui/DateRangePicker'
import { createTrip } from './actions'
import { afterEntry } from '@/features/onboarding/profile'
import { LoadingState } from '@/ui/LoadingState'

const COMMON_ZONES = [
  'America/Guatemala',
  'America/Mexico_City',
  'America/Costa_Rica',
  'America/Bogota',
  'America/Lima',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
]

export function CreateTripScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const draftId = params.get('draft')
  const ideaIndex = Number(params.get('idea') ?? 0)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(!!draftId)
  const [createdTripId, setCreatedTripId] = useState<string | null>(null)
  const loaded = useRef(false)
  const [form, setForm] = useState({
    name: '',
    yourName: '',
    startDate: '',
    endDate: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    baseCurrency: 'USD',
    localCurrency: 'USD',
  })
  const [areas, setAreas] = useState<Destination[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!draftId || loaded.current) return
    loaded.current = true
    void db.ai_drafts.get(draftId).then((d) => {
      const idea = d && ideasSchema.parse(d.result).ideas[ideaIndex]
      if (!d || !idea || d.application) throw new Error('This idea is no longer available. Return to trip ideas and generate a new draft.')
      setDraft(d)
      setForm((f) => ({ ...f, name: idea.title, timezone: idea.timezone, baseCurrency: d.brief.currency, localCurrency: idea.currency,
        startDate: d.brief.startDate ?? '', endDate: d.brief.startDate ? DateTime.fromISO(d.brief.startDate).plus({ days: idea.days.length - 1 }).toISODate()! : '' }))
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load this draft.')).finally(() => setLoadingDraft(false))
  }, [draftId, ideaIndex])
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  function addDestination(d: Destination) {
    if (areas.some((a) => a.name === d.name) || areas.length >= MAX_AREAS) return
    setAreas([...areas, d])
    if (areas.length > 0) return
    // The first destination sets the trip's time zone and local currency; both stay editable.
    const currency = currencyFor(d.countryCode)
    if (currency) setForm((f) => ({ ...f, localCurrency: currency }))
    void lookupZone(d.lat, d.lng).then((zone) => {
      if (zone && isValidZone(zone)) setForm((f) => ({ ...f, timezone: zone }))
    })
  }
  const zones = COMMON_ZONES.includes(form.timezone) ? COMMON_ZONES : [form.timezone, ...COMMON_ZONES]

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isValidZone(form.timezone)) return setError('Unknown time zone')
    if (draft && !form.startDate) return setError('Pick when the trip starts, so the drafted days land on real dates.')
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      return setError('The trip ends before it starts')
    }
    setBusy(true)
    setError(null)
    try {
      const tripId = createdTripId ?? await createTrip({
        name: form.name,
        yourName: form.yourName,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        timezone: form.timezone,
        baseCurrency: form.baseCurrency.toUpperCase(),
        localCurrency: form.localCurrency.toUpperCase() || null,
        areas: areas.map((a) => ({ name: a.name, bbox: a.bbox, lat: a.lat, lng: a.lng, countryCode: a.countryCode })),
      })
      setCreatedTripId(tripId)
      if (draft) {
        const trip = await db.trips.get(tripId)
        const memberId = useDevice.getState().trips[tripId]?.memberId
        if (!trip || !memberId) throw new Error('Trip created. Open it to finish adding your draft.')
        const personal = useDevice.getState().travelProfile
        if (personal) await saveProfile(tripId, memberId, personal)
        await applyIdea(draft.id, ideaIndex, trip, memberId, form.startDate)
        navigate(`/t/${tripId}/plan`, { replace: true })
        return
      }
      navigate(await afterEntry(`/t/${tripId}/overview?created=1`), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <main className="min-h-full">
      <PageHeader title="New trip" back="/app" />
      {loadingDraft && <LoadingState title="Loading your trip idea…" />}
      <form onSubmit={submit} className="trip-create-form mx-auto max-w-xl space-y-5 p-5 sm:p-8">
        {draft && <p className="rounded-surface bg-brand-50 p-3 text-sm text-ink">Building {draft.result.ideas[ideaIndex]?.title}. Set the dates and your name. The itinerary is added as tentative items you can edit.</p>}
        <Field label="Trip name">
          <Input required maxLength={120} value={form.name} onChange={set('name')} placeholder="Paris with friends" />
        </Field>
        <Field label="Your name">
          <Input required maxLength={40} value={form.yourName} onChange={set('yourName')} />
        </Field>
        <details className="ui-disclosure rounded-surface border border-line bg-surface px-4 py-1" open={draft ? true : undefined}>
          <summary><span className="min-w-0 flex-1">{draft ? 'Trip dates & destination' : 'Add dates and destination (optional)'}</span><ChevronDown aria-hidden="true" className="ui-disclosure-chevron size-5 shrink-0" /></summary>
          <div className="mt-1 space-y-5 pb-4">
        <DateRangePicker start={form.startDate} end={form.endDate} fixedLength={draft ? draft.result.ideas[ideaIndex]!.days.length : undefined}
          onChange={(startDate, endDate) => setForm((f) => ({ ...f, startDate, endDate }))} />
        <div>
          <p className="text-sm font-medium text-ink">Where are you going?</p>
          {areas.length > 0 && (
            <ul aria-label="Destinations" className="mt-2 flex flex-wrap gap-2">
              {areas.map((a) => (
                <li key={a.name} className="inline-flex items-center rounded-full bg-brand-50 pl-3 text-sm text-ink">
                  {a.name}
                  <button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAreas(areas.filter((x) => x.name !== a.name))} className="flex size-11 items-center justify-center rounded-full hover:bg-brand-100">
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {areas.length < MAX_AREAS && <div className="mt-2"><DestinationSearch onPick={addDestination} placeholder={areas.length ? 'Add another town' : 'Search for a town or city'} /></div>}
        </div>
          </div>
        </details>
        <details className="ui-disclosure rounded-surface border border-line bg-surface px-4 py-1">
          <summary><span className="min-w-0 flex-1">Time zone & currencies<span className="block text-xs font-normal text-muted">{form.timezone.split('/').at(-1)?.replaceAll('_', ' ')} · {form.baseCurrency.toUpperCase()}{form.localCurrency !== form.baseCurrency ? ` / ${form.localCurrency.toUpperCase()}` : ''}</span></span><ChevronDown aria-hidden="true" className="ui-disclosure-chevron size-5 shrink-0" /></summary>
          <div className="space-y-4 pb-4 pt-2">
        <Field label="Destination time zone">
          <Select value={form.timezone} onChange={set('timezone')}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Settle-up currency">
            <Input required maxLength={3} value={form.baseCurrency} onChange={set('baseCurrency')} />
          </Field>
          <Field label="Local currency">
            <Input maxLength={3} value={form.localCurrency} onChange={set('localCurrency')} />
          </Field>
        </div>
          </div>
        </details>
        <ErrorNote error={error} />
        {createdTripId && error && <Link className="inline-flex min-h-11 items-center text-action" to={`/t/${createdTripId}/overview`}>Open the created trip →</Link>}
        <Button type="submit" className="w-full" disabled={busy || loadingDraft || (!!draftId && !draft)}>
          {busy ? 'Creating…' : 'Create trip'}
        </Button>
        {!draftId && <Link to="/inspire" className="ui-link">Need a starting point? Help me plan →</Link>}
      </form>
    </main>
  )
}
