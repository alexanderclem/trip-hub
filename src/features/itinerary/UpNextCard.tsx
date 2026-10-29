import { Link } from 'react-router'
import { ArrowUpRight, ChevronRight, Clock3, MapPin, Ticket, Users } from 'lucide-react'
import { DateTime } from 'luxon'
import type { ItineraryItem, Member, Place } from '@/data/types'
import { useAttachments } from '@/features/tickets/files'
import { formatRange, MODE_LABEL, SOURCE_LABEL } from '@/features/routing/legs'
import { formatInZone } from '@/lib/time'
import { nextItem, type Transfer } from './travel'
import { Disclosure } from '@/ui'
import { useNow } from '@/lib/useNow'

/** The next thing on this person's plan. `withinHours` shows it only once it is that close (the Plan tab), since Home always has it. */
export function UpNextCard({ tripId, items, places, members, me, zone, transfers, withinHours, prominent = false }: {
  tripId: string; items: ItineraryItem[]; places: Place[]; members: Member[]
  me: string | null; zone: string; transfers: Transfer[]; withinHours?: number; prominent?: boolean
}) {
  const now = useNow(30_000)
  const attachments = useAttachments(tripId)
  const item = nextItem(items, me, now)
  if (!item || (withinHours != null && Date.parse(item.start_at) - now > withinHours * 3_600_000)) return null
  const place = places.find((p) => p.id === item.place_id)
  const transfer = transfers.find((t) => t.to.id === item.id && (me ? t.memberIds.includes(me) : true))
  const ticket = attachments?.find((t) => t.att.item_id === item.id)
  const today = DateTime.fromMillis(now, { zone }).toISODate()
  const date = DateTime.fromISO(item.start_at).setZone(zone)
  const going = item.attendee_ids === null ? 'Everyone' : item.attendee_ids.map((id) => members.find((m) => m.id === id)?.display_name ?? 'Trip member').join(', ')
  return (
    <section aria-labelledby="up-next-title" className={`up-next ${prominent ? 'up-next-prominent' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
        <h2 id="up-next-title" className="font-semibold">Up next for you</h2>
        <span className="tabular-nums">{date.toISODate() === today ? 'Today' : date.toFormat('ccc, d LLL')} · {date.toFormat('HH:mm')} <span className="text-xs">{date.offsetNameShort}</span></span>
      </div>
      <Link to={`/t/${tripId}/plan/${item.id}`} className="up-next-title">
        <span className="min-w-0 break-words">{item.title}</span><ChevronRight aria-hidden="true" className="size-5 shrink-0" />
      </Link>
      {item.status !== 'confirmed' && <p className="text-sm text-muted">{item.status === 'idea' ? 'Idea — not confirmed' : 'Tentative'}</p>}
      {place && <p className="mt-2 flex items-start gap-2 text-sm text-ink"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="wrap-anywhere">{place.name}</span></p>}
      <p className="mt-1 flex items-start gap-2 text-sm text-ink"><Users aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="break-words">{going}</span></p>
      {transfer && (
        <div className="up-next-departure">
          <Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0"><p className="font-semibold">{transfer.leaveAt < now ? 'Suggested departure was' : 'Leave by'} <span className="tabular-nums">{formatInZone(new Date(transfer.leaveAt).toISOString(), zone, 'HH:mm')}</span></p>
          <p className="mt-1 wrap-anywhere text-sm">{MODE_LABEL[transfer.option.mode].label} · {formatRange(transfer.option.minS, transfer.option.maxS)}</p></div>
        </div>
      )}
      <div className="up-next-actions">
        {place && <Link to={`/t/${tripId}/map?place=${place.id}`} className="ui-link"><ArrowUpRight aria-hidden="true" className="size-4" />View on map</Link>}
        {ticket && <Link to={`/t/${tripId}/tickets/${ticket.att.id}`} className="ui-link"><Ticket aria-hidden="true" className="size-4" />{ticket.onPhone ? 'Open ticket' : 'View ticket · not downloaded'}</Link>}
      </div>
      <Disclosure summary={transfer ? 'About this travel estimate' : 'Travel guidance'} className="up-next-guidance">
        {transfer ? <><p>From {transfer.fromPlace.name} · {SOURCE_LABEL[transfer.option.source]}.</p><p className="mt-1">Departure allows the upper travel estimate. Add time for check-in or waiting.</p></> : <p>{place ? 'A departure estimate needs a previous stop with travel information.' : 'Add a place to this plan for travel guidance.'}</p>}
      </Disclosure>
    </section>
  )
}
