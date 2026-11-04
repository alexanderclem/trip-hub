import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DateTime } from 'luxon'
import { useTripAccess, useMyMemberId } from '@/data/device'
import { can } from '@/data/access'
import { useLegContext, usePlaces, useTrip } from '@/data/hooks'
import { Button, ErrorNote, Field, Input, PageHeader, Select } from '@/ui'
import { TRAVEL_MODES, type TravelMode } from '@/data/types'
import { db } from '@/data/db'
import { saveMany } from '@/data/repo'
import { newId } from '@/lib/ids'
import { MODE_LABEL, SOURCE_LABEL, formatRange } from './legs'
import { routeItems, routePreview, type RouteStop } from './routePlan'

export function RouteScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId), places = usePlaces(tripId), ctx = useLegContext(tripId)
  const me = useMyMemberId(tripId), allowed = can(useTripAccess(tripId), 'plan'), navigate = useNavigate()
  const [local, setLocal] = useState(''), [choice, setChoice] = useState(''), [stops, setStops] = useState<RouteStop[]>([])
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const routeId = useRef(newId()), saving = useRef(false)
  let preview: ReturnType<typeof routePreview> = [], problem = ''
  if (stops.length >= 2 && local && trip && places && ctx) {
    try { preview = routePreview(stops, places, ctx, local, trip.timezone) } catch (e) { problem = e instanceof Error ? e.message : 'Check the route.' }
  }
  const move = (index: number, delta: number) => setStops((rows) => { const next = [...rows]; [next[index], next[index + delta]] = [next[index + delta]!, next[index]!]; return next })
  return <div className="pb-10"><PageHeader title="Build a route" back={`/t/${tripId}/more`} /><div className="mx-auto max-w-md space-y-4 p-4">
    <p className="text-sm text-muted">Order your stops, choose transport for each leg, and allow time at each place. Arrival estimates use the upper travel-time range. This creates tentative transport entries for everyone.</p>
    {!allowed ? <p>Ask an organizer to add a route.</p> : <>
      <Field label="Departure" hint={`Local time in ${trip?.timezone ?? 'the trip’s time zone'}.`}><Input type="datetime-local" value={local} disabled={busy} onChange={(e) => setLocal(e.target.value)} /></Field>
      <Field label="Add a stop"><Select value={choice} disabled={busy} onChange={(e) => setChoice(e.target.value)}><option value="">Choose a saved place</option>{places?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      <Button variant="secondary" disabled={!choice || busy || stops.length >= 20} onClick={() => { setStops((s) => [...s, { placeId: choice, mode: 'walk', stayMinutes: 0 }]); setChoice('') }}>Add stop</Button>
      <ol className="space-y-3">{stops.map((stop, index) => <li key={`${stop.placeId}:${index}`} className="space-y-3 rounded-surface border border-line p-3">
        <h2 className="wrap-anywhere font-semibold">{index + 1}. {places?.find((p) => p.id === stop.placeId)?.name ?? 'Unavailable place'}</h2>
        {index > 0 && <div className="grid grid-cols-2 gap-2"><Field label="Travel to this stop"><Select disabled={busy} value={stop.mode} onChange={(e) => setStops((s) => s.map((r, i) => i === index ? { ...r, mode: e.target.value as TravelMode } : r))}>{TRAVEL_MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m].label}</option>)}</Select></Field>
          <Field label="Time here (minutes)"><Input disabled={busy} type="number" min={0} max={1440} step={1} value={stop.stayMinutes} onChange={(e) => setStops((s) => s.map((r, i) => i === index ? { ...r, stayMinutes: Number(e.target.value) } : r))} /></Field></div>}
        <div className="flex flex-wrap gap-3"><button type="button" className="ui-link min-h-11" disabled={busy || index === 0} aria-label={`Move stop ${index + 1} up`} onClick={() => move(index, -1)}>Move up</button><button type="button" className="ui-link min-h-11" disabled={busy || index === stops.length - 1} aria-label={`Move stop ${index + 1} down`} onClick={() => move(index, 1)}>Move down</button><button type="button" className="ui-link min-h-11 text-danger-ink" disabled={busy} aria-label={`Remove stop ${index + 1}`} onClick={() => setStops((s) => s.filter((_, i) => i !== index))}>Remove</button></div>
      </li>)}</ol>
      {problem && <p role="status" className="text-sm text-warning-ink">{problem}</p>}
      {preview.length > 0 && <section aria-label="Route preview"><h2 className="font-semibold">Your route</h2><ol className="mt-2 divide-y divide-line">{preview.map((segment, i) => <li key={i} className="py-3 text-sm"><p className="wrap-anywhere font-medium">{segment.from.name} → {segment.to.name}</p><p>{DateTime.fromISO(segment.departure).setZone(trip!.timezone).toFormat('ccc HH:mm')} → {DateTime.fromISO(segment.arrival).setZone(trip!.timezone).toFormat('ccc HH:mm')}</p><p className="text-muted">{MODE_LABEL[segment.option.mode].label} · {formatRange(segment.option.minS, segment.option.maxS)} · {SOURCE_LABEL[segment.option.source]}</p></li>)}</ol></section>}
      <Button className="w-full" disabled={busy || !preview.length || !!problem} onClick={async () => {
        if (saving.current || !trip) return
        saving.current = true; setBusy(true); setError(null)
        try {
          const items = routeItems(tripId, routeId.current, preview, trip.timezone)
          await db.transaction('rw', [db.places, db.itinerary_items, db._outbox], async () => {
            const ids = [...new Set(items.flatMap((i) => [i.place_id!, i.to_place_id!]))]
            const current = await db.places.bulkGet(ids)
            const planned = current.filter((p) => p && !p.deleted_at && p.trip_id === tripId && (p.status === 'catalog' || p.status === 'shortlist')).map((p) => ({ ...p!, status: 'planned' as const }))
            if (planned.length) await saveMany('places', planned, me)
            await saveMany('itinerary_items', items, me)
          })
          navigate(`/t/${tripId}/plan?day=${local.slice(0, 10)}`)
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the route.'); saving.current = false; setBusy(false) }
      }}>{busy ? 'Saving route…' : 'Add route to plan'}</Button><ErrorNote error={error} />
      <Link className="ui-link" to={`/t/${tripId}/map`}>Check places on the trip map</Link>
    </>}
  </div></div>
}
