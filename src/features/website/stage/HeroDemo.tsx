import { useState } from 'react'
import { ChevronLeft, Landmark, MapPin, RotateCcw, Share2, Vote } from 'lucide-react'
import { Count, Phone, Roll, Stage, States, type Act } from './kit'
import './hero.css'

// The homepage hero: the group's vote decides, and the plan fills itself in.
//
// Plan, written before the build (references/framing.md, motion.md):
//   Medium:  plays once as it scrolls in, beside the headline; poster is the payoff.
//   Layout:  a phone pinned top-left and cropped by the stage's bottom edge, with the day's plan
//            card as one satellite straddling the phone's right edge over the third option (filler).
//   Story:   the vote is tied (7 of 8 in) -> you tap Must-do on Le Marais -> its score rolls 16 to 19
//            and the status says it won -> the plan's open 15:00 slot becomes "Le Marais, group pick".
//   Words:   the question, the three options, the score buttons, the status, the plan card's slot.
//            Everything else on the screen is real app chrome in the app's own type and colors.

type S = { voted: boolean; won: boolean; planned: boolean }
const START: S = { voted: false, won: false, planned: false }
const DONE: S = { voted: true, won: true, planned: true }

const SCORES = ['No way', 'Fine', 'Want', 'Must-do'] as const
const OPTIONS = [
  { name: 'Le Marais', points: 16 },
  { name: 'Montmartre', points: 16 },
  { name: 'Latin Quarter', points: 9 },
]
const MAX = 24

const script = async (a: Act<S>) => {
  await a.wait(1300)
  a.mark('vote')
  await a.click({ at: 'must', x: 0.5, y: 0.72 })
  a.put({ voted: true })
  await a.wait(450)
  a.put({ won: true })
  await a.wait(1000)
  a.mark('plan')
  a.put({ planned: true })
}

function Option({ name, points, s, first }: { name: string; points: number; s: S; first: boolean }) {
  const mine = first && s.voted ? 3 : null
  const total = points + (mine ?? 0)
  // Before the vote both 16-point options lead; once it's decided, only the winner does.
  const leads = first || (!s.won && points === 16)
  return (
    <div className="sw-option" data-trailing={!leads || undefined}>
      <div className="sw-option__name">{name}</div>
      <div className="sw-scores">
        {SCORES.map((label, i) => (
          <span key={label} className="sw-score" data-on={mine === i || undefined} {...(first && i === 3 ? { 'data-target': 'must' } : {})}>{label}</span>
        ))}
      </div>
      <div className="sw-tally">
        <span className="sw-tally__track"><span className="sw-tally__fill" style={{ width: `${(total / MAX) * 100}%` }} /></span>
        <span className="sw-tally__pts"><Count value={total} /><span>pts</span></span>
      </div>
    </div>
  )
}

function PlanCard({ s, compact }: { s: S; compact: boolean }) {
  return (
    <div className="sw-plan">
      <div className="sw-plan__day">Sunday, 14 March</div>
      {!compact && <>
        <div className="sw-plan__row">
          <span className="sw-plan__icon"><Landmark size={16} aria-hidden /></span>
          <span className="sw-plan__what"><span className="sw-plan__title">Louvre</span><span className="sw-plan__sub">Booked</span></span>
          <span className="sw-plan__time">09:00</span>
        </div>
      </>}
      <div className="sw-plan__row sw-plan__row--slot" data-planned={s.planned || undefined}>
        <States
          className="sw-plan__icon-slot"
          value={s.planned ? 'pick' : 'open'}
          states={{
            open: <span className="sw-plan__icon is-open"><Vote size={16} aria-hidden /></span>,
            pick: <span className="sw-plan__icon is-pick"><MapPin size={16} aria-hidden /></span>,
          }}
        />
        <span className="sw-plan__what">
          <span className="sw-plan__title"><Roll>{s.planned ? 'Le Marais' : 'Afternoon'}</Roll></span>
          <span className="sw-plan__sub"><Roll>{s.planned ? 'Group pick' : 'Still voting'}</Roll></span>
        </span>
        <span className="sw-plan__time">15:00</span>
      </div>
    </div>
  )
}

export function HeroDemo() {
  // Each take remounts the stage, so Replay runs the story again from the tie.
  const [take, setTake] = useState(0)
  return (
    <div className="sw-hero">
      {/* The demo is labelled an example (docs/BRAND.md); Replay is for anyone who scrolled past the vote. */}
      <div className="sw-hero__caption">
        <span className="tag-print">Example trip · Paris</span>
        <button type="button" className="sw-hero__replay" onClick={() => setTake((t) => t + 1)}>
          <RotateCcw size={16} strokeWidth={2.25} aria-hidden="true" />Replay
        </button>
      </div>
      <div role="img" aria-label="Stowaway on a phone: the group votes on where to spend the afternoon, Le Marais wins, and it is added to Sunday's plan at 15:00.">
      <Stage<S>
        key={take}
        width={560}
        height={640}
        compact={{ below: 540, width: 358, height: 600 }}
        initial={START}
        poster={DONE}
        play="once"
        script={script}
        cursor={{ at: { wide: { x: 330, y: 300 }, compact: { x: 250, y: 300 } }, style: 'touch' }}
        className="sw-hero-stage"
      >
        {(s, _rect, layout) => {
          const compact = layout === 'compact'
          return (
            <>
              <Phone width={compact ? 314 : 350} className="sw-phone">
                <div className="sw-screen">
                  <header className="sw-head">
                    <ChevronLeft size={26} aria-hidden className="sw-head__back" />
                    <div className="sw-head__text">
                      <div className="sw-head__title">Where should we spend the afternoon?</div>
                      <div className="sw-head__trip">Paris with friends</div>
                    </div>
                    <Share2 size={22} aria-hidden className="sw-head__share" />
                  </header>
                  <div className="sw-status">
                    <span className="sw-status__count"><Roll>{s.voted ? '8 of 8 voted' : '7 of 8 voted'}</Roll></span>
                    <span className="sw-status__state" data-won={s.won || undefined}><Roll>{s.won ? 'Le Marais wins' : 'Tied'}</Roll></span>
                  </div>
                  <div className="sw-options">
                    {OPTIONS.map((o, i) => <Option key={o.name} {...o} s={s} first={i === 0} />)}
                  </div>
                </div>
              </Phone>
              <PlanCard s={s} compact={compact} />
            </>
          )
        }}
      </Stage>
      </div>
    </div>
  )
}
