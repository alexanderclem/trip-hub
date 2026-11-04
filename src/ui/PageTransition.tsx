import { ViewTransition, type ReactNode } from 'react'
import { useMotionPreference } from './MotionProvider'

/**
 * A new route fades in where it lands; the old one fades out where it stood. Keyed by route, so
 * moving between routes is an exit and an enter, while updates inside a route (a navigation
 * starting, data arriving, a form changing) don't animate the page at all. Shared elements inside
 * (Morph) travel across on top. A constant key, like the trip workspace's, never remounts what it
 * wraps, so the trip's forms, map and sync subscriptions stay put.
 */
export function PageTransition({ routeKey, children, className = '' }: {
  routeKey: string; children: ReactNode; className?: string
}) {
  const reducedMotion = useMotionPreference()
  const still = reducedMotion || routeKey === 'trip-workspace'
  return (
    <ViewTransition key={routeKey} enter={still ? 'none' : 'stowaway-page'} exit={still ? 'none' : 'stowaway-page-exit'} default="none">
      <div data-view={routeKey} className={className}>{children}</div>
    </ViewTransition>
  )
}
