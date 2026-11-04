import type { Transition } from 'motion/react'

export const motionTiming = {
  feedback: { type: 'spring', stiffness: 450, damping: 30 },
  enter: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
  exit: { duration: 0.14, ease: [0.16, 1, 0.3, 1] },
  change: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
  fade: { duration: 0.16, ease: 'easeOut' },
  /** Shared-element navigation (Morph); CSS reads --stowaway-motion-morph. */
  morph: { duration: 0.34, ease: [0.16, 1, 0.3, 1] },
} satisfies Record<string, Transition>
