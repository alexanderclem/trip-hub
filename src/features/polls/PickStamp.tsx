import { useEffect, useState, type CSSProperties } from 'react'
import { useLocation } from 'react-router'
import { Morph, morphName } from '@/ui/Morph'

/**
 * The group's choice, stamped in coral (DESIGN.md: PRIORITY Stamp). It lands on a vote's winner when
 * the vote closes, then travels with the place: the winner card, the "Add to plan" form, and the
 * plan row it fills share one morph name, so the same stamp carries across all three screens.
 *
 * `stamping` plays the landing once (reduced motion shows it already printed). Without a place id
 * (a text option) it still stamps, it just has nothing to travel with.
 */
export function PickStamp({ placeId, stamping = false, delay = 0, travel = true }: {
  placeId?: string | null; stamping?: boolean; delay?: number
  /** Only one element per screen may carry the morph name. */
  travel?: boolean
}) {
  return (
    <Morph name={placeId && travel ? morphName('pick', placeId, 'stamp') : ''}>
      <span className="pick-stamp" data-stamping={stamping || undefined} style={{ '--pick-delay': `${delay}ms` } as CSSProperties}>Group pick</span>
    </Morph>
  )
}

/**
 * The form → plan hop can't be a view transition: the plan reads its rows from IndexedDB after it
 * mounts, so the browser would capture "Loading your itinerary…" and the place would have nowhere to
 * land. Instead the form records where the stamp and the name sat (launch), and the plan row flies
 * them in from there once it exists (land): a FLIP across a route change and an async load.
 */
type Flight = { stamp?: DOMRect; title?: DOMRect; titleSize?: number; at: number }
const flights = new Map<string, Flight>()

export function launchFlight(itemId: string, from: Element | null) {
  if (!from) return
  const title = from.querySelector('.place-identity-name')
  flights.set(itemId, {
    stamp: from.querySelector('.pick-stamp')?.getBoundingClientRect(),
    title: title?.getBoundingClientRect(),
    titleSize: title ? parseFloat(getComputedStyle(title).fontSize) : undefined,
    at: performance.now(),
  })
}

/** Returns when the stamp hits the row (ms), so the row can give under it; 0 when nothing flew. */
export function landFlight(itemId: string, row: Element): number {
  const flight = flights.get(itemId)
  flights.delete(itemId)
  if (!flight || performance.now() - flight.at > 4000) return 0
  const center = (r: DOMRect) => [r.left + r.width / 2, r.top + r.height / 2] as const

  const title = row.querySelector('h3')
  if (title && flight.title && flight.titleSize) {
    const to = title.getBoundingClientRect()
    const scale = flight.titleSize / parseFloat(getComputedStyle(title).fontSize)
    title.animate([
      { transformOrigin: '0 0', transform: `translate(${flight.title.left - to.left}px, ${flight.title.top - to.top}px) scale(${scale})` },
      { transformOrigin: '0 0', transform: 'none' },
    ], { duration: 560, easing: 'cubic-bezier(.16, 1, .3, 1)' })
  }

  const stamp = row.querySelector<HTMLElement>('.pick-stamp')
  if (!stamp || !flight.stamp) return 0
  const [fx, fy] = center(flight.stamp)
  const [tx, ty] = center(stamp.getBoundingClientRect())
  // Lift off the form, arc over the plan, then come down hard and settle: a stamp, not a slide.
  const duration = 760
  stamp.animate([
    { transform: `translate(${fx - tx}px, ${fy - ty}px) rotate(-5deg)`, easing: 'cubic-bezier(.3, 0, .2, 1)' },
    { transform: `translate(${(fx - tx) * 0.12}px, ${Math.min(-14, (fy - ty) * 0.12)}px) rotate(-13deg) scale(1.22)`, offset: 0.7, easing: 'cubic-bezier(.55, 0, .9, .3)' },
    { transform: 'rotate(-3deg) scale(.92)', offset: 0.86, easing: 'ease-out' },
    { transform: 'rotate(-5deg) scale(1)' },
  ], { duration, fill: 'backwards' })
  return duration * 0.86
}

/**
 * The item a save just put on the plan, passed in navigation state, played once. History keeps the
 * state, so coming Back to the plan later shows the row as it is, without landing it again.
 */
const landed = new Set<string>()
export function useLanding() {
  const id = (useLocation().state as { landed?: string } | null)?.landed
  const [landing] = useState(() => (id && !landed.has(id) ? id : null))
  useEffect(() => { if (landing) landed.add(landing) }, [landing])
  return landing
}
