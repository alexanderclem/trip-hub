import { m, type Transition } from 'motion/react'
import { useMotionPreference } from './MotionProvider'

const hop: Transition = {
  duration: 1.15,
  times: [0, 0.12, 0.38, 0.64, 0.76, 1],
  ease: 'easeInOut',
  repeat: Infinity,
  repeatDelay: 0.25,
}

/** The original suitcase takes a small hop, with a squash on landing and a soft shadow. */
export function LoadingLogo({ compact = false }: { compact?: boolean }) {
  const reducedMotion = useMotionPreference()
  const size = compact ? 36 : 80
  return (
    <span aria-hidden="true" className="loading-logo" style={{ width: size, height: size + (compact ? 12 : 24) }}>
      <m.span
        className="loading-logo-mark"
        initial={{ y: 0, scaleX: 1, scaleY: 1 }}
        animate={reducedMotion ? { y: 0, scaleX: 1, scaleY: 1 } : {
          y: [0, 2, compact ? -8 : -20, 0, 2, 0],
          scaleX: [1, 1.08, 0.96, 1.1, 1, 1],
          scaleY: [1, 0.92, 1.04, 0.9, 1, 1],
        }}
        transition={reducedMotion ? { duration: 0 } : hop}
      >
        <img src="/brand/stowaway-mark.svg" alt="" width={size} height={size} />
      </m.span>
      <m.span
        className="loading-logo-shadow"
        initial={{ scaleX: 0.9, opacity: 0.18 }}
        animate={reducedMotion ? { scaleX: 0.9, opacity: 0.18 } : {
          scaleX: [0.9, 1, 0.65, 1, 0.9, 0.9],
          opacity: [0.18, 0.24, 0.1, 0.24, 0.18, 0.18],
        }}
        transition={reducedMotion ? { duration: 0 } : hop}
      />
    </span>
  )
}
