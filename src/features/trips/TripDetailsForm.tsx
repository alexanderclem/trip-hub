import { useState, type FormEvent } from 'react'
import type { Trip } from '@/data/types'
import { save } from '@/data/repo'
import { isValidZone } from '@/lib/time'
import { Button, DateInput, ErrorNote, Field, Input } from '@/ui'

/** Mounted only after the trip loads. Live sync must never replace the draft someone is editing. */
export function TripDetailsForm({ trip, memberId }: { trip: Trip; memberId: string | null }) {
  const [name, setName] = useState(trip.name)
  const [start, setStart] = useState(trip.start_date ?? '')
  const [end, setEnd] = useState(trip.end_date ?? '')
  const [zone, setZone] = useState(trip.timezone)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaved(false)
    if (!name.trim()) return setError('Give your trip a name.')
    if (end && !start) return setError('Add a start date before an end date.')
    if (start && end && end < start) return setError('The end date must be on or after the start date.')
    if (!isValidZone(zone.trim())) return setError('Enter a valid time zone, such as America/New_York.')
    setBusy(true)
    try {
      await save('trips', { ...trip, name: name.trim(), start_date: start || null, end_date: end || null, timezone: zone.trim() }, memberId)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save trip details. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return <form onSubmit={submit} onChange={() => setSaved(false)} className="mt-3 space-y-4">
    <Field label="Trip name"><Input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></Field>
    <div className="grid grid-cols-2 gap-3">
      <Field label="Starts"><DateInput value={start} onValue={(value) => { setStart(value); setSaved(false) }} /></Field>
      <Field label="Ends"><DateInput min={start || undefined} value={end} onValue={(value) => { setEnd(value); setSaved(false) }} /></Field>
    </div>
    <Field label="Destination time zone" hint="Use an IANA time zone, such as America/New_York. Existing itinerary items keep their own time zones.">
      <Input required value={zone} onChange={(e) => setZone(e.target.value)} />
    </Field>
    <p className="text-xs leading-relaxed text-stone-600">Settle-up currency: {trip.base_currency}. It stays the same so existing balances keep their meaning.</p>
    <ErrorNote error={error} />
    {saved && <p role="status" className="text-sm text-brand-900">Trip details saved on this phone. They’ll sync when connected.</p>}
    <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save trip details'}</Button>
  </form>
}
