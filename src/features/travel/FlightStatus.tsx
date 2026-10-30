import { useState } from 'react'
import { z } from 'zod'
import { useTravel } from './client'
import { flightSchema } from './model'
import { LookupStatus } from './LookupStatus'
import { Button, Card, Field, Input } from '@/ui'
import type { ItineraryItem } from '@/data/types'
import { save } from '@/data/repo'
import { useMyMemberId } from '@/data/device'

const flightsSchema = z.array(flightSchema)
export function FlightStatus({ item }: { item: ItineraryItem }) {
  const me = useMyMemberId(item.trip_id)
  const [number, setNumber] = useState(item.details.flight_iata ?? '')
  const [lookup, setLookup] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const result = useTravel(lookup ? { action: 'flight', tripId: item.trip_id, number: lookup, date: item.start_local.slice(0, 10) } : null, flightsSchema, 5 * 60000)
  return <Card><h2 className="font-semibold">Flight status</h2><p className="mt-1 text-sm text-muted">Use the airline’s flight number, such as UA123. Check with the airline before traveling.</p>
    <form className="mt-3 space-y-3" onSubmit={async (e) => { e.preventDefault(); setSaving(true); setError(''); const normalized = number.replace(/\s/g, '').toUpperCase(); try { await save('itinerary_items', { ...item, details: { ...item.details, flight_iata: normalized } }, me); setLookup(normalized); result.refresh() } catch { setError('Could not save the flight number. Try again.') } finally { setSaving(false) } }}>
      <Field label="Flight number" hint={`Departure date: ${item.start_local.slice(0, 10)}`}><Input required pattern="[A-Za-z0-9]{2}[ ]*[0-9]{1,4}[A-Za-z]?" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={10} /></Field><Button variant="secondary" disabled={saving || result.loading} type="submit">{result.loading ? 'Checking flight…' : 'Check flight status'}</Button>
    </form>{error && <p role="alert">{error}</p>}<LookupStatus {...result} />
    {result.data?.length === 0 && <p className="mt-2 text-sm">No matching flight returned for this date. Future flights may not be available yet.</p>}
    {result.data?.map((f, i) => <div key={i} className="mt-3 border-t border-line pt-3 text-sm"><p className="font-semibold">{f.number} · {f.departure} → {f.arrival}</p><p>Status: {f.status.replace(/_/g, ' ')}</p><p>Gate: {f.gate ?? 'Not reported'} · Terminal: {f.terminal ?? 'Not reported'}</p>{f.scheduled && <p>Scheduled departure: {f.scheduled}</p>}{f.estimated && <p>Estimated departure: {f.estimated}</p>}{f.delay != null && <p>Reported delay: {f.delay} min</p>}</div>)}
    <p className="mt-3 text-xs text-muted">Source: Aviationstack. Updates are checked on request; saved results may be out of date.</p>
  </Card>
}
