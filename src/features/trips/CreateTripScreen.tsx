import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { X } from 'lucide-react'
import { DestinationSearch } from '@/features/destinations/DestinationSearch'
import { currencyFor, lookupZone, MAX_AREAS, type Destination } from '@/features/destinations/destinations'
import { isValidZone } from '@/lib/time'
import { Button, ErrorNote, Field, Input, PageHeader, Select } from '@/ui'
import { createTrip } from './actions'

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
  const [form, setForm] = useState({
    name: '',
    yourName: '',
    startDate: '',
    endDate: '',
    timezone: 'America/Guatemala',
    baseCurrency: 'USD',
    localCurrency: 'GTQ',
  })
  const [areas, setAreas] = useState<Destination[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      return setError('The trip ends before it starts')
    }
    setBusy(true)
    setError(null)
    try {
      const tripId = await createTrip({
        name: form.name,
        yourName: form.yourName,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        timezone: form.timezone,
        baseCurrency: form.baseCurrency.toUpperCase(),
        localCurrency: form.localCurrency.toUpperCase() || null,
        areas: areas.map((a) => ({ name: a.name, bbox: a.bbox, lat: a.lat, lng: a.lng })),
      })
      navigate(`/t/${tripId}/more/settings`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader title="New trip" back="/" />
      <form onSubmit={submit} className="mx-auto max-w-md space-y-4 p-5">
        <Field label="Trip name">
          <Input required maxLength={120} value={form.name} onChange={set('name')} placeholder="Guatemala spring break 2027" />
        </Field>
        <Field label="Your name" hint="How the group will see you.">
          <Input required maxLength={40} value={form.yourName} onChange={set('yourName')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <Input type="date" value={form.startDate} onChange={set('startDate')} />
          </Field>
          <Field label="Ends">
            <Input type="date" value={form.endDate} onChange={set('endDate')} />
          </Field>
        </div>
        <div>
          <p className="text-sm font-medium text-stone-700">Where are you going?</p>
          <p className="mt-1 text-xs text-stone-500">Optional. Pick the towns you'll visit to set the time zone and currency, and to load places and an offline map later.</p>
          {areas.length > 0 && (
            <ul aria-label="Destinations" className="mt-2 flex flex-wrap gap-2">
              {areas.map((a) => (
                <li key={a.name} className="inline-flex items-center rounded-full bg-brand-50 pl-3 text-sm text-brand-900">
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
        <Field label="Destination time zone" hint="Trip times are shown in this zone unless you switch to your phone's time.">
          <Select value={form.timezone} onChange={set('timezone')}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Settle-up currency">
            <Input required maxLength={3} value={form.baseCurrency} onChange={set('baseCurrency')} />
          </Field>
          <Field label="Local currency">
            <Input maxLength={3} value={form.localCurrency} onChange={set('localCurrency')} />
          </Field>
        </div>
        <ErrorNote error={error} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create trip'}
        </Button>
      </form>
    </div>
  )
}
