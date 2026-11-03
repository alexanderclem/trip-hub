import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useAnimate } from 'motion/react'
import { useMotionPreference } from './MotionProvider'
import { motionTiming } from './motion'

/**
 * Interaction motion shared by the app and the website, adapted from Animate UI (a highlight
 * that slides between options) and Magic UI (NumberTicker). Rebuilt on motion/react with no
 * code or dependency copied. Nothing loops, and reduced motion turns movement off.
 */

/**
 * Measures the selected child of a row so one highlight can slide to it, whatever its width.
 * The first placement doesn't animate. Pass the selected value as `active` to re-measure.
 */
export function useSlidingHighlight<T extends HTMLElement>(active: unknown, selector: string, placement: 'fill' | 'underline' = 'fill') {
  const [row, setRow] = useState<T | null>(null)
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 })
  const placed = useRef<T | null>(null)
  const reduced = useMotionPreference()
  useLayoutEffect(() => {
    if (!row) return
    const measure = () => {
      const on = row.querySelector<HTMLElement>(selector)
      if (!on) { setStyle({ opacity: 0 }); return }
      setStyle({ width: on.offsetWidth, height: placement === 'underline' ? 3 : on.offsetHeight, transform: `translate(${on.offsetLeft}px, ${on.offsetTop + (placement === 'underline' ? on.offsetHeight + 4 : 0)}px)`, transition: placed.current === row && !reduced ? undefined : 'none' })
      placed.current = row
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [row, active, selector, placement, reduced])
  return { ref: setRow, style }
}

/** Retarget local view changes without remounting fields or queuing stale transitions. */
export function useContentChange(changeKey: string) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const previous = useRef(changeKey)
  const reduced = useMotionPreference()
  useLayoutEffect(() => {
    const changed = previous.current !== changeKey
    previous.current = changeKey
    if (!scope.current) return
    if (reduced) {
      void animate(scope.current, { opacity: 1, y: 0 }, { duration: 0 })
      return
    }
    if (!changed) return
    const animation = animate(scope.current, { opacity: [0.8, 1], y: [4, 0] }, motionTiming.change)
    return () => animation.stop()
  }, [changeKey, reduced, animate, scope])
  return scope
}

/** The exact value is readable immediately; only subsequent changes get visual feedback. */
export function NumberTicker({ value, prefix = '', format = String, className = '' }: { value: number; prefix?: string; format?: (n: number) => string; className?: string }) {
  const reduced = useMotionPreference()
  const [scope, animate] = useAnimate<HTMLSpanElement>()
  const text = `${prefix}${format(value)}`
  const previous = useRef(text)
  useLayoutEffect(() => {
    const changed = previous.current !== text
    previous.current = text
    if (!scope.current) return
    if (reduced) {
      void animate(scope.current, { opacity: 1, y: 0 }, { duration: 0 })
      return
    }
    if (!changed) return
    const animation = animate(scope.current, { opacity: [0.65, 1], y: [2, 0] }, motionTiming.change)
    return () => animation.stop()
  }, [text, reduced, animate, scope])
  return <span aria-live="polite" aria-atomic="true" className={`tabular-nums ${className}`}><span ref={scope} className="inline-block">{text}</span></span>
}
