import { useContext, useEffect, useState, type ReactNode } from 'react'
import { HeaderTools } from './index'
import { m } from 'motion/react'
import { useMotionPreference } from './MotionProvider'
import { Brand } from './Brand'
import { LoadingLogo } from './LoadingLogo'
import { motionTiming } from './motion'

export function LoadingState({ title = 'Opening your trip…', description, action, fullScreen = false }: {
  title?: string; description?: string; action?: ReactNode; fullScreen?: boolean
}) {
  // Inside a trip the shell's header and tabs are already on screen, so a screen that is still
  // reading IndexedDB shows its own outline instead of a centred logo.
  const inTrip = useContext(HeaderTools) !== null
  if (fullScreen && inTrip) return <ScreenSkeleton title={title} action={action} />
  return <LoadingMark title={title} description={description} action={action} fullScreen={fullScreen} />
}

/**
 * The outline of a trip screen: a header the real one's height, then a hero card and a row group.
 * It appears after a short delay (CSS) so instant reads never flash it, and it reserves the space
 * from the first frame, so the screen doesn't jump when the rows arrive.
 */
export function ScreenSkeleton({ title, rows = 3, action }: { title: string; rows?: number; action?: ReactNode }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(timer)
  }, [])
  if (slow) return <LoadingMark title={title} action={action} fullScreen shownAtOnce />
  return (
    <div role="status" aria-label={title} className="ui-skeleton min-h-full" aria-busy="true">
      <span className="sr-only">{title}</span>
      <div className="app-page-header pt-safe border-b border-line bg-canvas/95">
        <div className="flex min-h-16 items-center gap-3 px-4 py-2 lg:px-8">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="ui-skeleton-bar h-3 w-24" />
            <div className="ui-skeleton-bar h-5 w-44" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-4 p-4" aria-hidden="true">
        <div className="ui-skeleton-card space-y-3">
          <div className="ui-skeleton-bar h-4 w-1/3" />
          <div className="ui-skeleton-bar h-8 w-2/3" />
          <div className="ui-skeleton-bar h-4 w-1/2" />
        </div>
        <div className="ui-skeleton-card divide-y divide-line p-0">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-3.5">
              <div className="ui-skeleton-bar size-8 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="ui-skeleton-bar h-4" style={{ width: `${70 - i * 12}%` }} />
                <div className="ui-skeleton-bar h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LoadingMark({ title, description, action, fullScreen, shownAtOnce = false }: { title: string; description?: string; action?: ReactNode; fullScreen: boolean; shownAtOnce?: boolean }) {
  const [slow, setSlow] = useState(shownAtOnce)
  // Local reads usually answer within a frame or two. Showing the loader for those only flashes the
  // logo between screens (and breaks a landing animation), so it appears only once a load is slow.
  const [shown, setShown] = useState(shownAtOnce)
  const reducedMotion = useMotionPreference()
  useEffect(() => {
    const show = setTimeout(() => setShown(true), 300)
    const timer = setTimeout(() => setSlow(true), 8000)
    return () => { clearTimeout(show); clearTimeout(timer) }
  }, [])
  return (
    <div className={`${fullScreen ? 'flex min-h-full items-center justify-center bg-canvas' : ''} p-6 ${shown ? '' : 'invisible'}`}>
      <div className="mx-auto w-full max-w-sm text-center">
        {fullScreen && <Brand className="mb-8" />}
        <div role="status">
          <div className="mb-4 flex justify-center pt-5"><LoadingLogo /></div>
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          {description && <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}
          {slow && <m.p initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={motionTiming.fade} className="mt-3 text-sm text-muted">This is taking longer than usual. Your saved trip stays on this device.</m.p>}
        </div>
        {slow && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}<button type="button" className="ui-button ui-button-secondary" onClick={() => window.location.reload()}>Reload</button></div>}
      </div>
    </div>
  )
}
