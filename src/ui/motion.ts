import type { Transition } from 'motion/react'

export const motionTiming = {
  feedback: { type: 'spring', stiffness: 450, damping: 30 },
  enter: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
  fade: { duration: 0.18, ease: 'easeOut' },
} satisfies Record<string, Transition>
