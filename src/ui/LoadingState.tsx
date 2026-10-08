import { useEffect, useState, type ReactNode } from 'react'
import { m } from 'motion/react'
import { useMotionPreference } from './MotionProvider'
import { Brand } from './Brand'
import { LoadingLogo } from './LoadingLogo'
import { motionTiming } from './motion'

export function LoadingState({ title = 'Opening your trip…', description = 'Getting your saved plans ready.', action, fullScreen = false }: {
  title?: string; description?: string; action?: ReactNode; fullScreen?: boolean
}) {
  const [slow, setSlow] = useState(false)
  const reducedMotion = useMotionPreference()
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className={`${fullScreen ? 'flex min-h-full items-center justify-center bg-canvas' : ''} p-6`}>
      <div className="mx-auto w-full max-w-sm text-center">
        {fullScreen && <Brand className="mb-8" />}
        <div role="status">
          <div className="mb-4 flex justify-center pt-5"><LoadingLogo /></div>
          <h2 className="text-xl font-semibold text-brand-900">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{description}</p>
          {slow && <m.p initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={motionTiming.fade} className="mt-3 text-sm text-stone-600">This is taking longer than usual. Your saved trip stays on this device.</m.p>}
        </div>
        {slow && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}<button type="button" className="ui-button ui-button-secondary" onClick={() => window.location.reload()}>Reload</button></div>}
      </div>
    </div>
  )
}
