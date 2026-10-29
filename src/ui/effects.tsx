import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { animate, useInView } from 'motion/react'
import { useMotionPreference } from './MotionProvider'

/**
 * Interaction motion shared by the app and the website, adapted from Animate UI (a highlight
 * that slides between options) and Magic UI (NumberTicker). Rebuilt on motion/react with no
 * code or dependency copied. Nothing loops or plays on load, and reduced motion turns it off.
 */
const ease = [0.16, 1, 0.3, 1] as const

/**
 * Measures the selected child of a row so one highlight can slide to it, whatever its width.
 * The first placement doesn't animate. Pass the selected value as `active` to re-measure.
 */
export function useSlidingHighlight<T extends HTMLElement>(active: unknown, selector: string) {
  const ref = useRef<T>(null)
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 })
  const placed = useRef(false)
  const reduced = useMotionPreference()
  useLayoutEffect(() => {
    const row = ref.current
    if (!row) return
    const measure = () => {
      const on = row.querySelector<HTMLElement>(selector)
      if (!on) { setStyle({ opacity: 0 }); return }
      setStyle({ width: on.offsetWidth, height: on.offsetHeight, transform: `translate(${on.offsetLeft}px, ${on.offsetTop}px)`, transition: placed.current && !reduced ? undefined : 'none' })
      placed.current = true
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [active, selector, reduced])
  return { ref, style }
}

/**
 * Counts up to a whole number the first time it appears. `format` shows each step, so an
 * amount in minor units can count in its own currency. The final text is always `format(value)`.
 */
export function NumberTicker({ value, prefix = '', format = String, className = '' }: { value: number; prefix?: string; format?: (n: number) => string; className?: string }) {
  const reduced = useMotionPreference()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const [shown, setShown] = useState(reduced ? value : 0)
  // A later change counts on from what is showing, not from zero again.
  const from = useRef(0)
  useEffect(() => {
    if (reduced) { setShown(value); from.current = value; return }
    if (!inView) return
    const controls = animate(from.current, value, { duration: 0.7, ease, onUpdate: (v) => setShown(Math.round(v)), onComplete: () => { from.current = value } })
    return () => { controls.stop(); from.current = value }
  }, [inView, reduced, value])
  return <span ref={ref} className={`tabular-nums ${className}`}>{prefix}{format(shown)}</span>
}
