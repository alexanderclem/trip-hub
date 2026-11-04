import { ViewTransition, type ReactNode } from 'react'
import { useMotionPreference } from './MotionProvider'

/** Fade the updated view without remounting its forms, map, or sync subscriptions. */
export function PageTransition({ routeKey, children, className = '' }: {
  routeKey: string; children: ReactNode; className?: string
}) {
  const reducedMotion = useMotionPreference()
  return <ViewTransition default={reducedMotion || routeKey === 'trip-workspace' ? 'none' : 'stowaway-page'}><div data-view={routeKey} className={className}>{children}</div></ViewTransition>
}
