import { useEffect, useState } from 'react'

const STOPS = [
  { id: 'trip', code: 'TRP', label: 'Trip' },
  { id: 'save', code: 'SVE', label: 'Save' },
  { id: 'vote', code: 'VTE', label: 'Vote' },
  { id: 'plan', code: 'PLN', label: 'Plan' },
  { id: 'offline', code: 'OFF', label: 'Offline' },
  { id: 'stubs', code: 'TIX', label: 'Tickets' },
  { id: 'join', code: 'YOU', label: 'Join' },
] as const

/**
 * The tag's routing strip: one axis every stop on the page is pinned to, printed as route codes.
 * A rail beside the tag on wide screens, a route bar under the header on phones. The stop you're
 * reading is lit.
 */
export function RouteStrip() {
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
        {STOPS.map((stop) => (
          <li key={stop.id}>
            <a href={`#${stop.id}`} aria-current={current === stop.id ? 'step' : undefined}>
              <span className="tag-strip-code" aria-hidden="true">{stop.code}</span>
              <span className="tag-strip-label">{stop.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
