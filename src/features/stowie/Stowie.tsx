import { useId } from 'react'
import { m, type TargetAndTransition } from 'motion/react'
import { useMotionPreference } from '@/ui/MotionProvider'
import { usePoke } from '@/ui/usePoke'
import type { Mood } from './script'

type Pose = TargetAndTransition
type Values = Record<string, number | number[]>
type Loop = { duration: number; repeat: number; repeatDelay: number; ease: 'easeInOut'; times?: number[] }
const loop = (duration: number, repeatDelay = 0, times?: number[]): Loop => ({ duration, repeat: Infinity, repeatDelay, ease: 'easeInOut', ...(times ? { times } : {}) })
const settle = { duration: 0.25, ease: 'easeOut' as const }
const REST = { rotate: 0, x: 0, y: 0, scaleX: 1, scaleY: 1 }
/**
 * Resting values ease into place once; only the keyframed ones repeat. A repeating transition on
 * a resting value would replay the move from the last mood forever.
 */
const pose = (rest: Values, moving: Values = {}, repeat: object = settle): Pose => ({
  ...rest, ...moving, transition: { default: settle, ...Object.fromEntries(Object.keys(moving).map((key) => [key, repeat])) },
})
const HOP = [0, 0.12, 0.38, 0.64, 0.76, 1]

/** What each part does in each mood. `still` is the pose held when motion is reduced. */
const POSES: Record<Mood, { body: Pose; handle: Pose; eyes: Pose; blink: boolean; still: { rotate: number; x: number; y: number } }> = {
  idle: {
    body: pose(REST, { scaleY: [1, 1.02, 1] }, loop(3.6)),
    handle: pose({ y: 0 }),
    eyes: pose({ y: 0 }, { x: [0, 0, -6, -6, 0] }, loop(6.5, 1.5, [0, 0.55, 0.62, 0.9, 1])),
    blink: true, still: { rotate: 0, x: 0, y: 0 },
  },
  listening: {
    body: pose({ ...REST, rotate: -4 }),
    handle: pose({ y: 0 }),
    eyes: pose({ x: -5, y: 3 }),
    blink: true, still: { rotate: -4, x: -5, y: 3 },
  },
  thinking: {
    body: pose(REST, { rotate: [-3, 3, -3] }, loop(1.8)),
    handle: pose({}, { y: [0, -2.5, 0] }, loop(0.9)),
    eyes: pose({ y: -2.5 }, { x: [-7, 5, -7] }, loop(1.4)),
    blink: false, still: { rotate: 3, x: 4, y: -2.5 },
  },
  talking: {
    body: pose(REST, { scaleX: [1, 0.98, 1], scaleY: [1, 1.035, 1] }, loop(0.42)),
    handle: pose({}, { y: [0, -1, 0] }, loop(0.42)),
    eyes: pose({ x: 0, y: 0 }),
    blink: true, still: { rotate: 0, x: 0, y: 0 },
  },
  delighted: {
    body: pose(REST, { y: [0, 2, -14, 0, 2, 0], scaleX: [1, 1.08, 0.96, 1.1, 1, 1], scaleY: [1, 0.92, 1.04, 0.9, 1, 1] }, loop(0.95, 0.3, HOP)),
    handle: pose({}, { y: [0, 1, -3, 1, 0, 0] }, loop(0.95, 0.3, HOP)),
    eyes: pose({ x: 0, y: 0 }),
    blink: false, still: { rotate: 0, x: 0, y: 0 },
  },
  oops: {
    body: pose(REST, { rotate: [0, -9, 7, -6, -5], x: [0, -2, 2, -1, 0] }, { duration: 0.55, ease: 'easeOut' }),
    handle: pose({ y: 0 }),
    eyes: pose({ x: -9, y: 3.5 }, {}, settle),
    blink: true, still: { rotate: -5, x: -9, y: 3.5 },
  },
}

const INK = 'var(--stowaway-ink, #183e4b)'
const SLOT = 'var(--stowaway-surface, #fffdf8)'
const BODY = 'M12 37.5A13.5 13.5 0 0 1 25.5 24H70.5A13.5 13.5 0 0 1 84 37.5V75A13.5 13.5 0 0 1 70.5 88.5H25.5A13.5 13.5 0 0 1 12 75ZM32.62 39A10.12 10.12 0 0 0 22.5 49.12A10.12 10.12 0 0 0 32.62 59.25H63.38A10.12 10.12 0 0 0 73.5 49.12A10.12 10.12 0 0 0 63.38 39Z'
const HANDLE = 'M32.25 17.25A8.25 8.25 0 0 1 40.5 9H55.5A8.25 8.25 0 0 1 63.75 17.25V30H32.25ZM57 24V18.75A3 3 0 0 0 54 15.75H42A3 3 0 0 0 39 18.75V24Z'
const EYES = [46.5, 63.75]

/**
 * The Stowaway mark as a character: the same handle, body and peeking eyes, drawn as separate
 * parts so each can move. A hover or a press makes it hop, whatever the mood. Decorative; whatever Stowie is doing is also said in text nearby.
 */
export function Stowie({ mood = 'idle', size = 72, className = '' }: { mood?: Mood; size?: number; className?: string }) {
  const reducedMotion = useMotionPreference()
  const clip = useId()
  const [svg, poke] = usePoke<SVGSVGElement>(12)
  const look = POSES[mood]
  const held = { duration: 0 }
  const body: Pose = reducedMotion ? { ...REST, rotate: look.still.rotate, transition: held } : look.body
  const handle: Pose = reducedMotion ? { y: 0, transition: held } : look.handle
  const eyes: Pose = reducedMotion ? { x: look.still.x, y: look.still.y, transition: held } : look.eyes
  return (
    <svg ref={svg} aria-hidden="true" data-mood={mood} viewBox="0 0 96 100" width={size} height={size * (100 / 96)} className={`shrink-0 overflow-visible ${className}`}>
      <defs><clipPath id={clip}><rect x="22.5" y="39" width="51" height="20.25" rx="10.12" /></clipPath></defs>
      <ellipse cx="48" cy="93.5" rx="26" ry="3.5" fill={INK} opacity="0.12" />
      <m.g initial={false} animate={poke} style={{ originX: 0.5, originY: 0.92 }}>
      <m.g initial={false} animate={body} style={{ originX: 0.5, originY: 0.92 }}>
        <m.path d={HANDLE} fill="var(--color-brand-accent, #ef9477)" initial={false} animate={handle} />
        <rect x="22" y="38.5" width="52" height="21.25" rx="10.5" fill={SLOT} />
        <g clipPath={`url(#${clip})`}>
          <m.g initial={false} animate={eyes}>
            {mood === 'delighted' ? (
              EYES.map((cx) => <path key={cx} d={`M${cx - 5.6} 51.4Q${cx} 43 ${cx + 5.6} 51.4`} fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />)
            ) : (
              <m.g
                initial={false}
                animate={look.blink && !reducedMotion ? { scaleY: [1, 1, 0.12, 1], transition: loop(4.2, 0, [0, 0.93, 0.965, 1]) } : { scaleY: 1, transition: held }}
              >
                {EYES.map((cx) => <g key={cx}><circle cx={cx} cy="49.12" r="6.38" fill={INK} /><circle cx={cx + 2.25} cy="46.88" r="1.88" fill={SLOT} /></g>)}
              </m.g>
            )}
          </m.g>
        </g>
        <path d={BODY} fill={INK} fillRule="evenodd" />
      </m.g>
      </m.g>
    </svg>
  )
}
