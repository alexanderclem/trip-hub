import { Link } from 'react-router'
import { AlertTriangle, Ticket } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import type { Member, Place } from '@/data/types'
import { useAttachments } from '@/features/tickets/files'
import { formatInZone } from '@/lib/time'
import { Status } from '@/ui'
import { LayoutMotion } from '@/ui/LayoutMotion'
import { useMotionPreference } from '@/ui/MotionProvider'
import { motionTiming } from '@/ui/motion'
import { KIND_STYLE } from './kinds'
import type { Block } from './layout'

/** Uses the same day membership, ordering and conflicts as the proportional timeline. */
export function Agenda({ day, blocks, zone, tripId, placeOf, members }: {
  day: string; blocks: Block[]; zone: string; tripId: string; placeOf: (id: string | null) => Place | undefined; members: Member[]
}) {
  const tickets = useAttachments(tripId)
  const reduced = useMotionPreference()
  return (
    <LayoutMotion><ol aria-label="Agenda" className="travel-agenda relative">
      <AnimatePresence key={day} initial={false} mode="popLayout">
      {blocks.map(({ item, conflict, continuesBefore, continuesAfter, startMin }, index) => {
        const style = KIND_STYLE[item.kind]
        const time = `${formatInZone(item.start_at, zone)}${item.end_at ? `–${formatInZone(item.end_at, zone)}` : ''}`
        const place = placeOf(item.place_id)
        const to = placeOf(item.to_place_id)
        const where = to ? `${place?.name ?? 'Departure'} → ${to.name}` : place?.name
        const ticket = tickets?.find((t) => t.att.item_id === item.id)
        const period = (minute: number) => minute < 12 * 60 ? 'Morning' : minute < 17 * 60 ? 'Afternoon' : 'Evening'
        const showPeriod = index === 0 || period(blocks[index - 1]!.startMin) !== period(startMin)
        const author = members.find((member) => member.id === item.created_by)
        return (
          // A category rail connects the day; the time stays aligned beside its activity.
          <m.li key={item.id} layout={reduced ? false : 'position'} initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 1 } : { opacity: 0 }} transition={reduced ? { duration: 0 } : motionTiming.change} className={conflict ? 'bg-danger/40' : undefined}>
            {showPeriod && <p className="agenda-period">{period(startMin)}</p>}
            <Link to={`/t/${tripId}/plan/${item.id}`} aria-label={`${item.title}, ${time}${where ? `, ${where}` : ''}${conflict ? ', overlaps another item' : ''}`} className="agenda-stop">
              <span className={`agenda-category ${style.bg} ${style.text}`}><style.Icon aria-hidden="true" className="size-4" /></span>
              <div className="agenda-stop-body min-w-0 flex-1">
                <div className="agenda-stop-heading"><h3 className="min-w-0 break-words font-semibold leading-snug text-ink">{item.title}</h3><span className="agenda-time"><span>{formatInZone(item.start_at, zone)}</span>{item.end_at && <span className="agenda-time-end">–{formatInZone(item.end_at, zone)}</span>}</span></div>
                {where && <p className="mt-1 break-words text-sm text-muted">{where}</p>}
                {(continuesBefore || continuesAfter) && <p className="mt-1 text-xs text-muted">{continuesBefore && 'Continues from previous day'}{continuesBefore && continuesAfter && ' · '}{continuesAfter && 'Continues tomorrow'}</p>}
                <p className="agenda-status">
                  <span>{item.status === 'confirmed' ? 'Confirmed' : item.status === 'idea' ? 'Idea · not confirmed' : 'Tentative'}</span>
                  {author && <span>Added by {author.display_name}</span>}
                  {conflict && <Status tone="danger"><AlertTriangle aria-hidden="true" className="size-3.5" />Overlaps another item</Status>}
                </p>
              </div>
            </Link>
            {ticket && <div className="agenda-ticket"><Link to={`/t/${tripId}/tickets/${ticket.att.id}`} aria-label={`Open ticket for ${item.title}`} className="ui-link"><Ticket aria-hidden="true" className="size-4" />Open ticket<span className="text-xs font-normal text-muted">· {ticket.onPhone ? 'On this phone' : 'Not downloaded'}</span></Link></div>}
          </m.li>
        )
      })}
      </AnimatePresence>
    </ol></LayoutMotion>
  )
}
