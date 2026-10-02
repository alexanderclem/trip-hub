import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, MapPin, Ticket, Users } from 'lucide-react'
import { DateTime } from 'luxon'
import type { ItineraryItem, Member, Place } from '@/data/types'
import { useAttachments } from '@/features/tickets/files'
import { formatRange, MODE_LABEL, SOURCE_LABEL } from '@/features/routing/legs'
import { formatInZone } from '@/lib/time'
import { nextItem, type Transfer } from './travel'

export function UpNextCard({ tripId, items, places, members, me, zone, transfers }: {
  tripId: string; items: ItineraryItem[]; places: Place[]; members: Member[]
  me: string | null; zone: string; transfers: Transfer[]
}) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const timer = setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const attachments = useAttachments(tripId)
  const item = nextItem(items, me, now)
  if (!item) return null
  const place = places.find((p) => p.id === item.place_id)
  const transfer = transfers.find((t) => t.to.id === item.id && (me ? t.memberIds.includes(me) : true))
  const ticket = attachments?.find((t) => t.att.item_id === item.id)
  const today = DateTime.fromMillis(now, { zone }).toISODate()
  const date = DateTime.fromISO(item.start_at).setZone(zone)
  const going = item.attendee_ids === null ? 'Everyone' : item.attendee_ids.map((id) => members.find((m) => m.id === id)?.display_name ?? 'Trip member').join(', ')
  return (
    <section aria-labelledby="up-next-title" className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-brand-900">
        <h2 id="up-next-title" className="font-semibold">Up next for you</h2>
        <span>{date.toISODate() === today ? 'Today' : date.toFormat('ccc, d LLL')} · {date.toFormat('HH:mm')}</span>
      </div>
      <Link to={`/t/${tripId}/plan/${item.id}`} className="mt-1 flex min-h-11 items-center justify-between gap-3 text-lg font-semibold text-brand-900 hover:underline">
        <span className="min-w-0 break-words">{item.title}</span><ArrowRight aria-hidden="true" className="size-5 shrink-0" />
      </Link>
      {item.status !== 'confirmed' && <p className="text-sm text-stone-600">{item.status === 'idea' ? 'Idea — not confirmed' : 'Tentative'}</p>}
      <p className="mt-1 flex items-start gap-2 text-sm text-stone-700"><Users aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="break-words">{going}</span></p>
      {transfer && (
        <div className="mt-3 border-t border-brand-100 pt-3 text-sm text-brand-900">
          <p className="font-semibold">{transfer.leaveAt < now ? 'Suggested departure was' : 'Leave by'} {formatInZone(new Date(transfer.leaveAt).toISOString(), zone, 'HH:mm')}</p>
          <p className="mt-1 break-words">From {transfer.fromPlace.name} · {MODE_LABEL[transfer.option.mode].label} {formatRange(transfer.option.minS, transfer.option.maxS)} ({SOURCE_LABEL[transfer.option.source]}).</p>
          <p className="mt-1 text-xs text-stone-600">Allows the upper travel estimate; add time for check-in or waiting.</p>
        </div>
      )}
      {!transfer && <p className="mt-2 text-sm text-stone-600">{place ? `At ${place.name}. Departure time needs a previous stop with travel information.` : 'Add a place to this plan for travel guidance.'}</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {place && <Link to={`/t/${tripId}/map?place=${place.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-900 hover:underline"><MapPin aria-hidden="true" className="size-4" />View on map</Link>}
        {ticket && <Link to={`/t/${tripId}/tickets/${ticket.att.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-900 hover:underline"><Ticket aria-hidden="true" className="size-4" />Open ticket</Link>}
      </div>
    </section>
  )
}
