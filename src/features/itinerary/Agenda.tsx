import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router'
import { useGroupPicks } from '@/features/polls/data'
import { PickStamp, landFlight, useLanding } from '@/features/polls/PickStamp'
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
import { Morph, morphName } from '@/ui/Morph'
import { AiFlag, isAiPlanned } from './AiFlag'

/** Uses the same day membership, ordering and conflicts as the proportional timeline. */
export function Agenda({ day, blocks, zone, tripId, placeOf }: {
  day: string; blocks: Block[]; zone: string; tripId: string; placeOf: (id: string | null) => Place | undefined
}) {
  const tickets = useAttachments(tripId)
  const reduced = useMotionPreference()
  const picks = useGroupPicks(tripId)
  const landing = useLanding()
  const list = useRef<HTMLOListElement>(null)
  // Put the landing row on screen, then fly the place and its stamp in from where the form showed them.
  // Wait for the picks: until they load the row has no stamp to fly. The row stays hidden till then
  // (group-pick.css), so it never shows in place first and then jumps back to the form.
  const flown = useRef(false)
  const ready = picks !== undefined
  // Scroll on the first paint, before the picks arrive, so the day never shows its top and then jumps.
  useLayoutEffect(() => {
    if (landing) list.current?.querySelector('[data-landed]')?.scrollIntoView({ block: 'center' })
  }, [landing])
  useLayoutEffect(() => {
    const row = landing && ready && !flown.current ? list.current?.querySelector<HTMLElement>('[data-landed]') : null
    if (!row) return
    flown.current = true
    row.dataset.landed = 'flying'
    const impact = reduced ? 0 : landFlight(landing!, row)
    // The row gives a little under the stamp, then its half-tone develops to solid (group-pick.css).
    row.style.setProperty('--pick-impact', `${impact}ms`)
    if (impact) row.querySelector('.agenda-stop')?.animate([{ transform: 'none' }, { transform: 'translateY(1.5px) scale(.996)', offset: 0.35 }, { transform: 'none' }], { duration: 300, delay: impact, easing: 'cubic-bezier(.3, 1.4, .5, 1)' })
  }, [landing, reduced, ready])
  return (
    <LayoutMotion><ol ref={list} aria-label="Agenda" className="travel-agenda relative">
      <AnimatePresence key={day} initial={false} mode="popLayout">
      {blocks.map(({ item, conflict, continuesBefore, continuesAfter, startMin }, index) => {
        const style = KIND_STYLE[item.kind]
        const time = `${formatInZone(item.start_at, zone)}${item.end_at ? `–${formatInZone(item.end_at, zone)}` : ''}`
        const place = placeOf(item.place_id)
        const to = placeOf(item.to_place_id)
        const where = to ? `${place?.name ?? 'Departure'} → ${to.name}` : place?.name
        const ticket = tickets?.find((t) => t.att.item_id === item.id)
        const period = (minute: number) => minute < 12 * 60 ? 'Morning' : minute < 17 * 60 ? 'Afternoon' : 'Evening'
        const showPeriod = blocks.length >= 6 && (index === 0 || period(blocks[index - 1]!.startMin) !== period(startMin))
        const landed = item.id === landing
        const picked = !!item.place_id && !!picks?.has(item.place_id)
        // The landed row's place flies in by hand (landFlight), so every row keeps its own morph names.
        const part = (p: 'icon' | 'title') => morphName('plan', item.id, p)
        return (
          // A category rail connects the day; the time stays aligned beside its activity.
          <m.li key={item.id} layout={reduced ? false : 'position'} initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 1 } : { opacity: 0 }} transition={reduced ? { duration: 0 } : motionTiming.change} data-landed={landed || undefined} className={`${conflict ? 'bg-danger/40' : ''} ${landed ? 'agenda-landed' : ''}`}>
            {showPeriod && <p className="agenda-period">{period(startMin)}</p>}
            <Link to={`/t/${tripId}/plan/${item.id}`} aria-label={`${item.title}, ${time}${where ? `, ${where}` : ''}${picked ? ', group pick' : ''}${item.status === 'confirmed' ? '' : item.status === 'idea' ? ', idea, not confirmed' : `, ${item.status}`}${item.confirmation_code ? `, confirmation ${item.confirmation_code}` : ''}${isAiPlanned(item) ? ', planned by Stowie' : ''}${conflict ? ', overlaps another item' : ''}`} data-status={item.status} className="agenda-stop">
              <Morph name={part('icon')}><span className={`agenda-category ${style.bg} ${style.text}`}><style.Icon aria-hidden="true" className="size-4" /></span></Morph>
              <div className="agenda-stop-body min-w-0 flex-1">
                <div className="agenda-stop-heading"><Morph name={part('title')} text><h3 className="min-w-0 break-words font-semibold leading-snug text-ink">{item.title}</h3></Morph><Morph name={morphName('plan', item.id, 'time')}><span className="agenda-time"><span>{formatInZone(item.start_at, zone)}</span>{item.end_at && <span className="agenda-time-end">–{formatInZone(item.end_at, zone)}</span>}</span></Morph></div>
                {picked && <p className="agenda-pick"><PickStamp placeId={item.place_id} travel={landed} /></p>}
                {where && !item.title.toLocaleLowerCase().includes(where.toLocaleLowerCase()) && <p className="mt-1 break-words text-sm text-muted">{where}</p>}
                {item.confirmation_code && <p className="agenda-code"><span className="agenda-code-label">Confirmation</span> <span className="agenda-code-value">{item.confirmation_code}</span></p>}
                {(continuesBefore || continuesAfter) && <p className="mt-1 text-xs text-muted">{continuesBefore && 'Continues from previous day'}{continuesBefore && continuesAfter && ' · '}{continuesAfter && 'Continues tomorrow'}</p>}
                {(item.status !== 'confirmed' || conflict || isAiPlanned(item)) && <p className="agenda-status">
                  {item.status !== 'confirmed' && <span>{item.status === 'idea' ? 'Idea · not confirmed' : 'Tentative'}</span>}
                  {isAiPlanned(item) && <span><AiFlag /></span>}
                  {conflict && <Status tone="danger"><AlertTriangle aria-hidden="true" className="size-3.5" />Overlaps another item</Status>}
                </p>}
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
