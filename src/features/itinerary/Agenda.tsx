import { Link } from 'react-router'
import { AlertTriangle, Ticket } from 'lucide-react'
import type { Place } from '@/data/types'
import { useAttachments } from '@/features/tickets/files'
import { formatInZone } from '@/lib/time'
import { KIND_STYLE } from './kinds'
import type { Block } from './layout'

/** Uses the same day membership, ordering and conflicts as the proportional timeline. */
export function Agenda({ blocks, zone, tripId, placeOf }: {
  blocks: Block[]; zone: string; tripId: string; placeOf: (id: string | null) => Place | undefined
}) {
  const tickets = useAttachments(tripId)
  return (
    <ol aria-label="Agenda" className="space-y-3">
      {blocks.map(({ item, conflict, continuesBefore, continuesAfter }) => {
        const style = KIND_STYLE[item.kind]
        const time = `${formatInZone(item.start_at, zone)}${item.end_at ? `–${formatInZone(item.end_at, zone)}` : ''}`
        const place = placeOf(item.place_id)
        const to = placeOf(item.to_place_id)
        const where = to ? `${place?.name ?? 'Departure'} → ${to.name}` : place?.name
        const ticket = tickets?.find((t) => t.att.item_id === item.id)
        return (
          <li key={item.id} className={`overflow-hidden rounded-xl border border-stone-200 border-l-4 bg-surface ${style.border} ${conflict ? 'ring-1 ring-red-400' : ''}`}>
            <Link to={`/t/${tripId}/plan/${item.id}`} aria-label={`${item.title}, ${time}${where ? `, ${where}` : ''}${conflict ? ', overlaps another item' : ''}`} className="flex min-h-11 items-start gap-3 p-4 hover:bg-brand-50">
              <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.text}`}><style.Icon aria-hidden="true" className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium tabular-nums text-stone-600">{time}{(continuesBefore || continuesAfter) && <span className="mt-1 block font-normal">{continuesBefore && 'Continues from previous day'}{continuesBefore && continuesAfter && ' · '}{continuesAfter && 'Continues tomorrow'}</span>}</p>
                <h3 className="mt-1 break-words font-semibold leading-snug text-brand-900">{item.title}</h3>
                {where && <p className="mt-1 break-words text-sm text-stone-600">{where}</p>}
                <p className="mt-2 text-xs font-medium text-stone-600">{item.status === 'confirmed' ? 'Confirmed' : item.status === 'idea' ? 'Idea · not confirmed' : 'Tentative'}</p>
                {conflict && <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-800"><AlertTriangle aria-hidden="true" className="size-3.5" />Overlaps another item</p>}
              </div>
            </Link>
            {ticket && <div className="border-t border-stone-200 px-4"><Link to={`/t/${tripId}/tickets/${ticket.att.id}`} aria-label={`Open ticket for ${item.title}`} className="ui-link"><Ticket aria-hidden="true" className="size-4" />Open ticket<span className="text-xs font-normal text-stone-600">· {ticket.onPhone ? 'On this phone' : 'Not downloaded'}</span></Link></div>}
          </li>
        )
      })}
    </ol>
  )
}
