import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

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
        <Field label="Destination time zone" hint="Trip times are shown in this zone unless you switch to your phone's time.">
          <Select value={form.timezone} onChange={set('timezone')}>
            {COMMON_ZONES.map((z) => (
              <option key={z} value={z}>
                {z.replace('_', ' ')}
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
