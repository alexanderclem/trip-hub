import { useRef, useState } from 'react'
import { CalendarDays, Users } from 'lucide-react'
import { m, useInView } from 'motion/react'
import { useMotionPreference } from '@/ui/MotionProvider'
import { motionTiming } from '@/ui/motion'

const days = [
  {
    title: 'West Side wandering',
    route: 'M164 178C195 187 197 112 260 123S381 167 401 66',
    stops: [
      { time: '09:00', name: 'Coffee in the West Village', note: 'An easy start, together.', x: 164, y: 178 },
      { time: '11:00', name: 'Walk the High Line', note: 'A few favorites from the group.', x: 260, y: 123 },
      { time: '16:00', name: 'An afternoon by the Hudson', note: 'Leave room for a little wandering.', x: 401, y: 66 },
    ],
  },
  {
    title: 'Art and a little fresh air',
    route: 'M190 192C230 170 192 116 263 87S340 59 383 120',
    stops: [
      { time: '09:30', name: 'Bagels on the Upper West Side', note: 'Breakfast worth slowing down for.', x: 190, y: 192 },
      { time: '11:00', name: 'A stroll through Central Park', note: 'Take the scenic way across.', x: 263, y: 87 },
      { time: '14:00', name: 'An afternoon at the Met', note: 'Find a favorite, then compare notes.', x: 383, y: 120 },
    ],
  },
  {
    title: 'A day downtown',
    route: 'M167 83C222 52 214 130 294 137S381 145 391 195',
    stops: [
      { time: '10:00', name: 'Browse the shops in SoHo', note: 'A little time to find your own thing.', x: 167, y: 83 },
      { time: '12:30', name: 'Lunch together in Chinatown', note: 'Order a few dishes for the table.', x: 294, y: 137 },
      { time: '16:00', name: 'Walk the Brooklyn Bridge', note: 'One last view to take home.', x: 391, y: 195 },
    ],
  },
]

/** Local, illustrative data: exploring the example never loads a map or creates a trip. */
export function TripPreview() {
  const [selected, setSelected] = useState(0)
  const [interacted, setInteracted] = useState(false)
  const figure = useRef<HTMLElement>(null)
  const inView = useInView(figure, { once: true, amount: 0.2 })
  const reducedMotion = useMotionPreference()
  const revealed = reducedMotion || inView || interacted
  const day = days[selected]!
  const change = reducedMotion ? { duration: 0 } : motionTiming.change

  return (
    <figure ref={figure} className="website-preview" aria-labelledby="preview-caption">
      <div className="preview-heading">
        <div><span className="website-eyebrow">Example itinerary</span><h2>A few days in NYC</h2></div>
        <span className="preview-tag"><Users size={15} aria-hidden="true" /> Group trip</span>
      </div>
      <div className="preview-days" role="group" aria-label="Explore the example itinerary">
        {days.map((_, index) => (
          <button key={index} type="button" aria-pressed={selected === index} aria-controls={`preview-day-${index + 1}`} onClick={() => { setInteracted(true); setSelected(index) }}>Day {index + 1}</button>
        ))}
      </div>
      <div className="preview-map" aria-hidden="true">
        <svg viewBox="0 0 560 260" preserveAspectRatio="xMidYMid slice">
          <rect width="560" height="260" fill="var(--color-website-map-ground)" />
          <path d="M0 0H120L65 95 90 170 35 260H0ZM470 0H560V260H405L455 170 430 95Z" fill="var(--color-website-map-park)" opacity="0.65" />
          <path d="M0 10L190 0 155 75 40 130 0 95ZM390 0L560 0 560 100 450 135 390 85ZM0 225L120 170 175 210 160 260 0 260ZM420 195L510 160 560 200 560 260 380 260Z" fill="var(--color-website-map-blocks)" />
          <g stroke="var(--color-website-map-streets)" strokeWidth="11" fill="none">
            <path d="M-20 65L580 180M-20 140L580 255M70 -20L15 280M170 -20L115 280M270 -20L215 280M370 -20L315 280M470 -20L415 280M570 -20L515 280M0 -10L580 105" />
          </g>
          <rect x="244" y="20" width="38" height="88" rx="4" fill="var(--color-website-map-park)" transform="rotate(11 260 119)" />
          <m.g key={selected} initial={reducedMotion ? false : { opacity: 0.65 }} animate={{ opacity: 1 }} transition={change}>
            <m.path className="preview-route" d={day.route} initial={false} animate={{ pathLength: revealed ? 1 : 0 }} transition={reducedMotion ? { duration: 0 } : { ...motionTiming.change, duration: 0.4 }} fill="none" stroke="var(--color-brand-700)" strokeWidth="3" strokeLinecap="round" />
            {day.stops.map(({ x, y, name }, i) => (
              <m.g key={name} initial={false} animate={{ opacity: revealed ? 1 : 0.65, y: revealed ? 0 : 4 }} transition={reducedMotion ? { duration: 0 } : { ...motionTiming.change, delay: interacted ? 0 : i * 0.05 }}>
                <circle cx={x} cy={y} r="16" fill="var(--color-brand-700)" stroke="var(--color-website-surface)" strokeWidth="4" />
                <text x={x} y={y + 5} textAnchor="middle" fill="var(--color-website-on-action)" fontSize="13" fontFamily="var(--font-website-body)" fontWeight="600">{i + 1}</text>
              </m.g>
            ))}
          </m.g>
          <text x="309" y="235" fill="var(--color-website-map-label)" fontSize="14" fontFamily="var(--font-website-body)">Manhattan</text>
        </svg>
      </div>
      {/* Overlapping grid panels reserve the tallest day's natural height without truncation. */}
      <div className="preview-plans">
        {days.map((item, index) => (
          <m.div id={`preview-day-${index + 1}`} key={index} className="preview-plan" aria-hidden={selected !== index} inert={selected !== index} style={{ visibility: selected === index ? 'visible' : 'hidden' }} initial={false} animate={{ opacity: selected === index ? 1 : 0, y: selected === index || reducedMotion ? 0 : 4 }} transition={change}>
            <div className="preview-day"><CalendarDays size={16} aria-hidden="true" /><span>{item.title}</span></div>
            <ol>{item.stops.map((stop, i) => (
              <m.li key={stop.time} initial={false} animate={{ opacity: revealed ? 1 : 0.85, y: revealed ? 0 : 4 }} transition={reducedMotion ? { duration: 0 } : { ...motionTiming.change, delay: interacted ? 0 : i * 0.05 }}>
                <span className="preview-time">{stop.time}</span><div><h3>{stop.name}</h3><p>{stop.note}</p></div>
              </m.li>
            ))}</ol>
          </m.div>
        ))}
      </div>
      <p className="sr-only" role="status">{interacted ? `Day ${selected + 1}: ${day.title}. Three stops shown.` : ''}</p>
      <figcaption id="preview-caption">Illustrative map. Example itinerary.</figcaption>
    </figure>
  )
}
