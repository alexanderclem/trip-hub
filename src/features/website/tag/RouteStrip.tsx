import { useEffect, useState } from 'react'
import type { Code } from './trip'

/**
 * The tag's routing strip: one axis every stop on the page is pinned to, printed as route codes.
 * The neighborhood is a ghost code until the group's vote prints it solid. A rail beside the tag on
 * wide screens, a route bar under the header on phones. The stop you're reading is lit.
 */
export function RouteStrip({ choice }: { choice: Code | null }) {
  const stops: { id: string; code: string; label: string; ghost?: boolean }[] = [
    { id: 'trip', code: 'CDG', label: 'Trip' },
    { id: 'save', code: 'PAR', label: 'Save' },
    { id: 'vote', code: choice ?? '···', label: 'Vote', ghost: !choice },
    { id: 'plan', code: 'VRS', label: 'Plan' },
    { id: 'offline', code: 'OFF', label: 'Offline' },
    { id: 'stubs', code: 'TIX', label: 'Tickets' },
    { id: 'join', code: 'YOU', label: 'Join' },
  ]
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
        {stops.map((stop) => (
          <li key={stop.id}>
            <a href={`#${stop.id}`} aria-current={current === stop.id ? 'step' : undefined} className={stop.ghost ? 'is-ghost' : stop.id === 'vote' ? 'is-picked' : undefined}>
              <span className="tag-strip-code" aria-hidden="true">{stop.code}</span>
              <span className="tag-strip-label">{stop.label}{stop.id === 'vote' && !stop.ghost && <span className="sr-only">: the group picked {stop.code}</span>}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
