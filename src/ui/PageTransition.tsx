import { useEffect, type ReactNode } from 'react'
import { m, useAnimationControls } from 'motion/react'
import { useMotionPreference } from './MotionProvider'
import { motionTiming } from './motion'

/** Fade the updated view without remounting its forms, map, or sync subscriptions. */
export function PageTransition({ routeKey, children, className = '' }: {
  routeKey: string; children: ReactNode; className?: string
}) {
  const controls = useAnimationControls()
  const reducedMotion = useMotionPreference()
  useEffect(() => {
    controls.set({ opacity: reducedMotion ? 1 : 0.85 })
    void controls.start({ opacity: 1, transition: reducedMotion ? { duration: 0 } : motionTiming.fade })
    return () => controls.stop()
  }, [routeKey, reducedMotion, controls])
  return <m.div initial={false} animate={controls} className={className}>{children}</m.div>
}
