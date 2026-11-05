import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A tag's barcode, drawn from its own text so every tag gets a stable, different one.
 * Decorative: the text it encodes is always printed beside it.
 */
export function Barcode({ value, className = '' }: { value: string; className?: string }) {
  let seed = 0
  for (const char of value) seed = (seed * 31 + char.charCodeAt(0)) >>> 0
  const bars: { x: number; w: number }[] = []
  let x = 0
  while (x < 196) {
    seed = (seed * 1103515245 + 12345) >>> 0
    const w = 1 + ((seed >>> 16) % 3)
    if ((seed >>> 8) % 5 !== 0) bars.push({ x, w })
    x += w + 1 + ((seed >>> 4) % 2)
  }
  return (
    <svg className={`tag-barcode ${className}`} viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {bars.map((bar) => <rect key={bar.x} x={bar.x} y="0" width={bar.w} height="40" />)}
    </svg>
  )
}

/** A perforated tear line: the only divider the tag world uses. */
export function Perforation({ className = '' }: { className?: string }) {
  return <div className={`tag-perf ${className}`} aria-hidden="true" />
}

/** The coral priority label the group's choice gets. `pressed` replays the stamp. */
export function PriorityStamp({ children = 'Priority', stamped = true }: { children?: ReactNode; stamped?: boolean }) {
  return <span className="tag-stamp" data-stamped={stamped || undefined}>{children}</span>
}

/** Adds `is-printed` once an element first scrolls into view, so its lines print in once. */
export function usePrintIn<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [printed, setPrinted] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || printed) return
    if (typeof IntersectionObserver === 'undefined') { setPrinted(true); return }
    const io = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { setPrinted(true); io.disconnect() } }, { rootMargin: '0px 0px -15% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [printed])
  return { ref, printed }
}

/**
 * The head of a secondary page: the title and intro on the tag face, with the page's own printed
 * fields in the right half (what it costs, who it's for, when it was updated).
 */
export function TagHead({ title, intro, fields = [], children, id = 'page-title' }: { title: ReactNode; intro?: ReactNode; fields?: [label: string, value: string][]; children?: ReactNode; id?: string }) {
  return (
    <section className="tag-head" aria-labelledby={id}>
      <div className="tag-shell tag-head-grid">
        <div>
          <h1 id={id}>{title}</h1>
          {intro && <p className="tag-intro">{intro}</p>}
          {children}
        </div>
        {fields.length > 0 && (
          <dl className="tag-fields">
            {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        )}
      </div>
      <Perforation />
    </section>
  )
}
