import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useMotionPreference } from './MotionProvider'

/** Only the handle owns this gesture, leaving scrolling, fields, and browser edge-back alone. */
export function useSwipeDismiss(onDismiss: () => void, enabled = true) {
  const panel = useRef<HTMLElement | null>(null)
  const drag = useRef<{ id: number; y: number; time: number; distance: number } | null>(null)
  const settling = useRef<Animation | null>(null)
  const reduced = useMotionPreference()
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  useEffect(() => {
    if (!enabled) {
      settling.current?.cancel()
      if (drag.current && panel.current) panel.current.style.translate = ''
      drag.current = null
    }
    return () => { settling.current?.cancel() }
  }, [enabled])
  function reset() {
    const element = panel.current
    const distance = drag.current?.distance ?? 0
    drag.current = null
    if (!element) return
    element.style.translate = ''
    if (!reduced && distance) settling.current = element.animate([{ translate: `0 ${distance}px` }, { translate: '0 0px' }], { duration: 180, easing: 'cubic-bezier(.16,1,.3,1)' })
  }
  return {
    panel,
    handle: {
      onPointerDown(event: ReactPointerEvent<HTMLElement>) {
        if (!enabled || event.pointerType === 'mouse' || event.clientX < 24 || event.clientX > window.innerWidth - 24) return
        settling.current?.cancel()
        drag.current = { id: event.pointerId, y: event.clientY, time: performance.now(), distance: 0 }
        event.currentTarget.setPointerCapture(event.pointerId)
      },
      onPointerMove(event: ReactPointerEvent<HTMLElement>) {
        if (!drag.current || drag.current.id !== event.pointerId) return
        const distance = Math.max(0, event.clientY - drag.current.y)
        drag.current.distance = distance
        if (panel.current) panel.current.style.translate = `0 ${distance}px`
      },
      onPointerUp(event: ReactPointerEvent<HTMLElement>) {
        const gesture = drag.current
        if (!gesture || gesture.id !== event.pointerId) return
        const speed = gesture.distance / Math.max(1, performance.now() - gesture.time)
        if (gesture.distance >= 90 || (gesture.distance > 28 && speed > .6)) {
          drag.current = null
          onDismissRef.current()
        } else reset()
      },
      onPointerCancel: reset,
      onLostPointerCapture() { if (drag.current) reset() },
    },
  }
}
