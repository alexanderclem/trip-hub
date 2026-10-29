import type { ReactNode } from 'react'
import { m } from 'motion/react'
import { useMotionPreference } from '@/ui/MotionProvider'

/**
 * Website-only motion, adapted from patterns in Magic UI (BlurFade, NumberTicker),
 * Motion Primitives (InView, TextEffect) and Animate UI. Rebuilt on the existing
 * motion/react runtime; no code or dependency copied. Content stays readable before
 * and without the animation, and reduced motion turns every effect off.
 */
const ease = [0.16, 1, 0.3, 1] as const

/** Settles content into place once, the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useMotionPreference()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <m.div
      className={className}
      initial={{ opacity: 0.6, y: 12, filter: 'blur(2px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease }}
    >
      {children}
    </m.div>
  )
}

/** Word-by-word blur-in for one short line of display type. */
export function WordReveal({ text, delay = 0 }: { text: string; delay?: number }) {
  const reduced = useMotionPreference()
  if (reduced) return <>{text}</>
  const words = text.split(' ')
  return (
    <>
      {words.map((word, i) => (
        <span key={i}>
          <m.span
            className="website-word"
            initial={{ opacity: 0.25, y: '0.18em', filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.5, delay: delay + i * 0.08, ease }}
          >
            {word}
          </m.span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  )
}

export { NumberTicker } from '@/ui/effects'
