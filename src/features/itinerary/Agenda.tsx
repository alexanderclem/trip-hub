import { Link } from 'react-router'
import { AlertTriangle, Ticket } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import type { Place } from '@/data/types'
import { useAttachments } from '@/features/tickets/files'
import { formatInZone } from '@/lib/time'
import { Status } from '@/ui'
import { LayoutMotion } from '@/ui/LayoutMotion'
import { useMotionPreference } from '@/ui/MotionProvider'
import { motionTiming } from '@/ui/motion'
import { KIND_STYLE } from './kinds'
import type { Block } from './layout'

/** Uses the same day membership, ordering and conflicts as the proportional timeline. */
export function Agenda({ day, blocks, zone, tripId, placeOf }: {
  day: string; blocks: Block[]; zone: string; tripId: string; placeOf: (id: string | null) => Place | undefined
}) {
  const tickets = useAttachments(tripId)
  const reduced = useMotionPreference()
  return (
    <LayoutMotion><ol aria-label="Agenda" className="ui-row-group relative">
      <AnimatePresence key={day} initial={false} mode="popLayout">
      {blocks.map(({ item, conflict, continuesBefore, continuesAfter }) => {
        const style = KIND_STYLE[item.kind]
        const time = `${formatInZone(item.start_at, zone)}${item.end_at ? `–${formatInZone(item.end_at, zone)}` : ''}`
        const place = placeOf(item.place_id)
        const to = placeOf(item.to_place_id)
        const where = to ? `${place?.name ?? 'Departure'} → ${to.name}` : place?.name
        const ticket = tickets?.find((t) => t.att.item_id === item.id)
        return (
          // A stop in the day, ruled like the website's sample plan: time first, then what and where.
          <m.li key={item.id} layout={reduced ? false : 'position'} initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 1 } : { opacity: 0 }} transition={reduced ? { duration: 0 } : motionTiming.change} className={conflict ? 'bg-danger/40' : undefined}>
            <Link to={`/t/${tripId}/plan/${item.id}`} aria-label={`${item.title}, ${time}${where ? `, ${where}` : ''}${conflict ? ', overlaps another item' : ''}`} className="ui-row items-start gap-3 py-4">
              <span className="ui-time w-[3.25rem] break-words text-ink">{time}</span>
              <div className="min-w-0 flex-1">
                <h3 className="flex items-start gap-2 break-words font-semibold leading-snug text-ink"><style.Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${style.text}`} /><span className="min-w-0">{item.title}</span></h3>
                {where && <p className="mt-1 break-words text-sm text-muted">{where}</p>}
                {(continuesBefore || continuesAfter) && <p className="mt-1 text-xs text-muted">{continuesBefore && 'Continues from previous day'}{continuesBefore && continuesAfter && ' · '}{continuesAfter && 'Continues tomorrow'}</p>}
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  <Status tone={item.status === 'confirmed' ? undefined : 'quiet'}>{item.status === 'confirmed' ? 'Confirmed' : item.status === 'idea' ? 'Idea · not confirmed' : 'Tentative'}</Status>
                  {conflict && <Status tone="danger"><AlertTriangle aria-hidden="true" className="size-3.5" />Overlaps another item</Status>}
                </p>
              </div>
            </Link>
            {ticket && <div className="-mt-2 pb-1 pl-[5.25rem] pr-4"><Link to={`/t/${tripId}/tickets/${ticket.att.id}`} aria-label={`Open ticket for ${item.title}`} className="ui-link"><Ticket aria-hidden="true" className="size-4" />Open ticket<span className="text-xs font-normal text-muted">· {ticket.onPhone ? 'On this phone' : 'Not downloaded'}</span></Link></div>}
          </m.li>
        )
      })}
      </AnimatePresence>
    </ol></LayoutMotion>
  )
}
