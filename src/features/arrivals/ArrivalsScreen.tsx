import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { DateTime } from 'luxon'
import { PlaneLanding, PlaneTakeoff } from 'lucide-react'
import { can } from '@/data/access'
import { useMyMemberId, useTripAccess } from '@/data/device'
import { useMembers, usePlaces, useTrip } from '@/data/hooks'
import { useItems } from '@/features/itinerary/data'
import { useAttachments } from '@/features/tickets/files'
import { TravelerLink } from '@/features/trips/TravelerLink'
import { Card, LinkButton, PageHeader, Status } from '@/ui'
import { ListSkeleton } from '@/ui/collection'
import { boardRows, journeyDirection, journeyLocation, journeyTime, missingTravelers, rideMatches, type JourneyDirection } from './model'

export function ArrivalsScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const items = useItems(tripId)
  const members = useMembers(tripId)
  const places = usePlaces(tripId) ?? []
  const tickets = useAttachments(tripId) ?? []
  const me = useMyMemberId(tripId)
  const mayPlan = can(useTripAccess(tripId), 'plan')
  const [direction, setDirection] = useState<JourneyDirection>('arrival')
  const root = `/t/${tripId}`
  if (!trip || !items || !members) return <><PageHeader title="Arrivals & departures" back={`${root}/more`} /><ListSkeleton label="Loading travel plans…" className="p-4" /></>
  const rows = boardRows(items, direction)
  const missing = missingTravelers(items, members, direction)
  const other = items.filter((i) => !i.deleted_at && i.status !== 'cancelled' && ['flight', 'transport'].includes(i.kind) && !journeyDirection(i))
  return <div className="pb-10">
    <PageHeader title="Arrivals & departures" back={`${root}/more`} />
    <div className="mx-auto max-w-2xl space-y-5 p-4">
      <p className="text-sm text-muted">Who’s getting in, who’s heading home, and how to meet up. Shared with everyone on this trip.</p>
      <div className="ui-segmented grid-cols-2" role="group" aria-label="Travel direction">
        {(['arrival', 'departure'] as const).map((value) => <button key={value} type="button" aria-pressed={direction === value} onClick={() => setDirection(value)} className={`min-h-11 rounded-control ${direction === value ? 'bg-ink text-on-action' : ''}`}>{value === 'arrival' ? 'Arrivals' : 'Departures'}</button>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">{rows.length} travel {rows.length === 1 ? 'plan' : 'plans'} · Times local to each airport or station</p>{mayPlan && <LinkButton to={`${root}/plan/new?journey=${direction}${me ? `&attendee=${me}` : ''}`}>Add {direction}</LinkButton>}</div>
      {!rows.length && <Card><h2 className="ui-section-title">{direction === 'arrival' ? 'How’s everyone getting there?' : 'When’s everyone heading home?'}</h2><p className="mt-2 text-sm text-muted">Add a flight, train, bus or other journey. It will also appear in the itinerary.</p>{!mayPlan && <p className="mt-2 text-sm text-muted">Ask an organizer to add your travel details.</p>}</Card>}
      <ul className="space-y-4" aria-label={direction === 'arrival' ? 'Arrival plans' : 'Departure plans'}>{rows.map((item) => {
        const at = journeyTime(item)
        const zone = direction === 'arrival' ? item.end_tz ?? item.start_tz : item.start_tz
        const local = at ? DateTime.fromISO(at).setZone(zone) : null
        const who = item.attendee_ids === null ? members : members.filter((m) => item.attendee_ids!.includes(m.id))
        const matches = rideMatches(item, items, places)
        const attachments = tickets.filter((t) => t.att.item_id === item.id)
        const Icon = direction === 'arrival' ? PlaneLanding : PlaneTakeoff
        return <li key={item.id}><Card>
          <div className="flex items-start gap-3"><Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-action" /><div className="min-w-0 flex-1"><h2 className="ui-section-title break-words"><Link to={`${root}/plan/${item.id}`} className="hover:underline">{item.title}</Link></h2><p className="mt-1 text-sm">{journeyLocation(item, places)}</p><p className="mt-2 text-lg font-semibold tabular-nums">{local?.isValid ? local.toFormat('ccc d LLL · HH:mm') : 'Time to be added'}</p><p className="text-xs text-muted break-words">{zone.replace(/_/g, ' ')}</p></div><Status tone={item.status === 'confirmed' ? undefined : 'quiet'}>{item.status === 'confirmed' ? 'Confirmed' : 'Tentative'}</Status></div>
          <div className="mt-3 flex flex-wrap gap-2">{who.map((m) => <TravelerLink key={m.id} member={m} />)}{!who.length && <p className="text-sm text-muted">Travelers to be added</p>}</div>
          <dl className="mt-3 space-y-2 text-sm"><div><dt className="font-medium">Staying at</dt><dd className="whitespace-pre-wrap break-words text-muted">{item.details?.journey_stay || 'Not added yet'}</dd></div><div><dt className="font-medium">Transfer / meeting point</dt><dd className="whitespace-pre-wrap break-words text-muted">{item.details?.journey_transfer || 'Not arranged yet'}</dd></div></dl>
          {!!matches.length && <p className="mt-3 rounded-control bg-mist p-3 text-sm">Possible shared ride: {matches.map((m) => m.title).join(', ')}. Within 90 minutes at the same location; check plans together before arranging.</p>}
          <div className="mt-3 flex flex-wrap gap-4">{mayPlan && <Link className="ui-link" to={`${root}/plan/${item.id}/edit`}>Edit travel details</Link>}{attachments.map(({ att, onPhone }) => <Link key={att.id} className="ui-link" to={`${root}/tickets/${att.id}`}>{att.title}{!onPhone && ' · not downloaded'}</Link>)}</div>
        </Card></li>
      })}</ul>
      {!!missing.length && <section><h2 className="ui-section-title">Still to add {direction} details</h2><div className="mt-3 flex flex-wrap gap-2">{missing.map((m) => <TravelerLink key={m.id} member={m} />)}</div></section>}
      {!!other.length && <section><h2 className="ui-section-title">Other travel in the plan</h2><p className="mt-1 text-sm text-muted">Choose “Arrival” or “Departure” in a journey’s travel details to include it above. Local trips can stay off this board.</p><ul className="mt-2">{other.map((item) => <li key={item.id}><Link className="ui-link min-h-11" to={`${root}/plan/${item.id}${mayPlan ? '/edit' : ''}`}>{item.title}</Link></li>)}</ul></section>}
    </div>
  </div>
}
