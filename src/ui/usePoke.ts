import { useEffect, useRef } from 'react'
import { useAnimationControls } from 'motion/react'
import { useMotionPreference } from './MotionProvider'

const TIMES = [0, 0.14, 0.42, 0.68, 0.84, 1]

/**
 * A one-shot startled hop when the mark is hovered with a mouse or pressed with a finger.
 * Listens on the surrounding link or button when there is one, so the whole target counts.
 * `lift` is the height of the hop in the element's own units.
 */
export function usePoke<T extends Element>(lift: number) {
  const ref = useRef<T>(null)
  const controls = useAnimationControls()
  const reducedMotion = useMotionPreference()

  useEffect(() => {
    const target = ref.current?.closest('a, button') ?? ref.current
    if (!target || reducedMotion) return
    let busy = false
    const poke = () => {
      if (busy) return
      busy = true
      void controls.start({
        y: [0, lift * 0.15, -lift, 0, lift * 0.1, 0],
        rotate: [0, 0, -7, 5, 0, 0],
        scaleX: [1, 1.1, 0.95, 1.1, 0.99, 1],
        scaleY: [1, 0.9, 1.06, 0.9, 1.01, 1],
        transition: { duration: 0.6, times: TIMES, ease: 'easeInOut' },
      }).finally(() => { busy = false })
    }
    const onEnter = (event: Event) => { if ((event as PointerEvent).pointerType === 'mouse') poke() }
    const onDown = (event: Event) => { if ((event as PointerEvent).pointerType !== 'mouse') poke() }
    target.addEventListener('pointerenter', onEnter)
    target.addEventListener('pointerdown', onDown)
    return () => {
      target.removeEventListener('pointerenter', onEnter)
      target.removeEventListener('pointerdown', onDown)
    }
  }, [controls, lift, reducedMotion])

  return [ref, controls] as const
}
