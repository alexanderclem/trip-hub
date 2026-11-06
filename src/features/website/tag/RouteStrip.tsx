import { useEffect, useState } from 'react'
import type { Winner } from './stops'

// The trip's own route codes: land at CDG, save places around Paris, the neighborhood the group
// is still deciding, Versailles on the plan. Offline, tickets and joining print as field codes.
const STOPS = [
  { id: 'trip', code: 'CDG', label: 'Trip' },
  { id: 'save', code: 'PAR', label: 'Save' },
  { id: 'vote', code: '···', label: 'Vote' },
  { id: 'plan', code: 'VRS', label: 'Plan' },
  { id: 'offline', code: 'OFF', label: 'Offline' },
  { id: 'stubs', code: 'TIX', label: 'Tickets' },
  { id: 'join', code: 'YOU', label: 'Join' },
] as const

/**
 * The tag's routing strip: one axis every stop on the page is pinned to, printed as route codes.
 * A rail beside the tag on wide screens, a route bar under the header on phones. The stop you're
 * reading is lit. The vote's code is a ghost until the group picks a neighborhood; then the
 * winner's code stamps onto the strip in coral, on phones too.
 */
export function RouteStrip({ winner }: { winner: Winner }) {
  const [current, setCurrent] = useState<string>('trip')
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible) setCurrent(visible.target.getAttribute('data-stop') ?? 'trip')
    }, { rootMargin: '-35% 0px -60% 0px' })
    document.querySelectorAll('[data-stop]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return (
    <nav className="tag-strip" aria-label="The trip, stop by stop">
      <ol>
        {STOPS.map((stop) => {
          const vote = stop.id === 'vote'
          const picked = vote && winner
          return (
            <li key={stop.id}>
              <a href={`#${stop.id}`} aria-current={current === stop.id ? 'step' : undefined} data-ghost={vote && !winner ? '' : undefined} data-picked={picked ? '' : undefined}>
                <span key={picked ? winner.code : 'ghost'} className="tag-strip-code" aria-hidden="true">{picked ? winner.code : stop.code}</span>
                <span className="tag-strip-label">{stop.label}{picked && <span className="sr-only">: {winner.name} picked</span>}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
