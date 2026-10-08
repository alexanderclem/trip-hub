import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'

const ReducedMotionContext = createContext(true)
const query = '(prefers-reduced-motion: reduce)'
const getSnapshot = () => window.matchMedia(query).matches
const getServerSnapshot = () => true
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** One live preference subscription also stops loops and gestures when the setting changes. */
export const useMotionPreference = () => useContext(ReducedMotionContext)

export function MotionProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return (
    <ReducedMotionContext.Provider value={reducedMotion}>
      <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
        <LazyMotion features={domAnimation} strict>{children}</LazyMotion>
      </MotionConfig>
    </ReducedMotionContext.Provider>
  )
}
