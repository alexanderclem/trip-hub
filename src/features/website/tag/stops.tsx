import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Check, Link2, Plane, Plus, Ticket, Wifi, WifiOff } from 'lucide-react'
import { Barcode, Perforation, PriorityStamp, usePrintIn } from './parts'
import { DAYS, IDEAS, NEIGHBORHOODS, SCORES, TRAVELERS, TRIP, total, type Code } from './trip'

export type Winner = (typeof NEIGHBORHOODS)[number] | null

/** One stop on the routing strip. */
function Stop({ id, title, children, wide = false }: { id: string; title: string; children: React.ReactNode; wide?: boolean }) {
  const { ref, printed } = usePrintIn<HTMLElement>()
  return (
    <section ref={ref} id={id} className={`tag-stop ${printed ? 'is-printed' : ''}`} aria-labelledby={`${id}-title`} data-stop={id}>
      <div className={`tag-shell tag-stop-grid ${wide ? 'is-wide' : ''}`}>
        <header className="tag-stop-head">
          <h2 id={`${id}-title`}>{title}</h2>
        </header>
        <div className="tag-stop-body">{children}</div>
      </div>
      <Perforation />
    </section>
  )
}

/** 01 Save: everyone drops places into one pool. */
export function SaveStop() {
  const [saved, setSaved] = useState(3)
  const ring = useRef<HTMLDivElement>(null)
  const shown = IDEAS.slice(0, saved)
  const full = saved >= IDEAS.length
  // The next empty slot is the action; the slots after it stay blank, so "add yours" is said once.
  const blanks = Math.max(0, IDEAS.length - saved - 1)
  return (
    <Stop id="save" title="Save places to one pool">
      <div ref={ring} tabIndex={-1} className="tag-ring" role="group" aria-label="Saved places in Paris (example trip)">
        {shown.map((idea, index) => (
          <article key={idea.name} className="tag-mini" style={{ '--i': index } as React.CSSProperties}>
            <p className="tag-mini-code">{idea.code}</p>
            <h3>{idea.name}</h3>
            <p className="tag-mini-meta">{idea.kind} · {idea.town}</p>
            <p className="tag-mini-by">Saved by {idea.by}</p>
          </article>
        ))}
        {!full && (
          <button type="button" className="tag-mini is-ghost is-next" onClick={() => {
            setSaved((n) => Math.min(IDEAS.length, n + 1))
            // The last save removes this button; keep focus in the pool instead of dropping it to the page.
            if (saved + 1 >= IDEAS.length) requestAnimationFrame(() => ring.current?.focus())
          }}>
            <Plus size={18} aria-hidden="true" /> Save a place
          </button>
        )}
        {Array.from({ length: blanks }, (_, index) => <div key={index} className="tag-mini is-ghost" aria-hidden="true" />)}
      </div>
      <p className="sr-only" aria-live="polite">{saved} places saved</p>
    </Stop>
  )
}

/** 02 Vote: the signature interaction. Seven friends are level; the visitor's vote decides. */
export function VoteStop({ mine, setMine, winner }: { mine: Partial<Record<Code, number>>; setMine: (next: Partial<Record<Code, number>>) => void; winner: Winner }) {
  const points = (option: (typeof NEIGHBORHOODS)[number]) => total(option.votes) + (mine[option.code] ?? 0)
  const top = Math.max(...NEIGHBORHOODS.map(points))
  const tied = NEIGHBORHOODS.filter((option) => points(option) === top).map((option) => option.name)
  const tiedNames = tied.length > 1 ? `${tied.slice(0, -1).join(', ')} and ${tied.at(-1)}` : ''
  const voted = Object.values(mine).some((score) => score !== undefined)
  return (
    <Stop id="vote" title="Vote to decide" wide>
      <div className="tag-vote">
        <p className="tag-vote-question">Where should we spend the afternoon?</p>
        {/* Says what the buttons do before anyone taps, then what the vote decided. */}
        <p className="tag-vote-result" role="status">
          {winner ? <><strong>{winner.name}</strong> wins. It’s on Day 2 at 15:00.</> : voted ? <>Still tied: {tiedNames}. Change a vote to break it.</> : <>{tiedNames} are tied. Your vote breaks it.</>}
        </p>
        <ul className="tag-vote-list">
          {NEIGHBORHOODS.map((option) => {
            const theirs = total(option.votes)
            const yours = mine[option.code]
            const points = theirs + (yours ?? 0)
            const isWinner = winner?.code === option.code
            // Options behind the leaders print quieter, so the tie (and then the winner) is where the eye lands.
            const trailing = points < top
            return (
              <li key={option.code} className={`tag-option ${isWinner ? 'is-winner' : ''} ${trailing ? 'is-trailing' : ''}`}>
                <div className="tag-option-head">
                  <span className="tag-option-code" aria-hidden="true">{option.code}</span>
                  <div className="tag-option-name">
                    <h3>{option.name}</h3>
                    <p>{option.detail}</p>
                  </div>
                  <p className="tag-option-points"><span className="sr-only">{option.name}: </span>{points}<span className="sr-only"> points</span><span aria-hidden="true"> pts</span></p>
                  {isWinner && <PriorityStamp />}
                </div>
                <div className="tag-ticks" aria-hidden="true">
                  {option.votes.map((vote, index) => <span key={index} className="tag-tick" style={{ '--w': vote } as React.CSSProperties} />)}
                  {yours !== undefined && <span className="tag-tick is-yours" style={{ '--w': yours } as React.CSSProperties} />}
                </div>
                <div className="tag-score" role="group" aria-label={`Your vote for ${option.name}`}>
                  {SCORES.map((label, score) => (
                    <button key={label} type="button" aria-pressed={yours === score} onClick={() => setMine({ ...mine, [option.code]: yours === score ? undefined : score })}>{label}</button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </Stop>
  )
}

/** 03 Plan: the routing, day by day. Confirmed prints solid, tentative half-toned, open as a ghost. */
export function PlanStop({ winner }: { winner: Winner }) {
  return (
    <Stop id="plan" title="Build the day-by-day plan" wide>
      <ol className="tag-days">
        {DAYS.map((day) => (
          <li key={day.day} className="tag-day">
            <div className="tag-day-route" aria-hidden="true"><span>{day.from}</span>{day.from !== day.to && <><span className="tag-arrow">→</span><span>{day.to}</span></>}</div>
            <h3><span className="tag-day-num">Day {day.day}</span> {day.title}</h3>
            <ul>
              {day.items.map((item) => (
                <li key={item.what} className={`tag-item is-${item.state}`}>
                  <span className="tag-time">{item.time}</span>
                  <span className="tag-what">{item.what}{'note' in item && item.note && <small>{item.note}</small>}</span>
                  <span className="tag-state">{item.state === 'confirmed' ? 'Booked' : 'Idea'}</span>
                </li>
              ))}
              {day.day === 2 && (winner ? (
                <li className="tag-item is-confirmed is-picked">
                  <span className="tag-time">15:00</span>
                  <span className="tag-what">Explore {winner.name}<small>The group's pick</small></span>
                  <PriorityStamp />
                </li>
              ) : (
                <li className="tag-item is-open">
                  <span className="tag-time">15:00</span>
                  <span className="tag-what">Afternoon plans<small>Still deciding: vote above</small></span>
                  <span className="tag-state">Open</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {/* The plan is the payoff of the story so far; the next step is one tap away, not nine screens down. */}
      <div className="tag-row tag-plan-next">
        <Link to="/new" className="tag-tear is-primary is-compact"><span className="tag-tear-label">Create a trip</span></Link>
      </div>
    </Stop>
  )
}

/** 04 Offline: airplane mode on, the plan stays put. */
export function OfflineStop() {
  const [offline, setOffline] = useState(true)
  return (
    <Stop id="offline" title="Works with no signal">
      <article className={`tag-keep ${offline ? 'is-offline' : ''}`} aria-labelledby="keep-title">
        <div className="tag-keep-head">
          <h3 id="keep-title"><span aria-hidden="true">PAR → VRS</span><span className="sr-only">Day 3, Paris to Versailles</span></h3>
          <p className="tag-signal">{offline ? <><Plane size={16} aria-hidden="true" /> No signal</> : <><Wifi size={16} aria-hidden="true" /> Online</>}</p>
        </div>
        <p className="tag-print">Day 3 · Versailles</p>
        <ul>
          <li><span className="tag-time">09:00</span> Train to Versailles <Check size={16} aria-label="Saved on this phone" /></li>
          <li><span className="tag-time">10:00</span> Palace of Versailles <Check size={16} aria-label="Saved on this phone" /></li>
          <li><Ticket size={16} aria-hidden="true" /> Train ticket, downloaded <Check size={16} aria-label="Saved on this phone" /></li>
        </ul>
        <p className="tag-keep-note" role="status">{offline ? 'Available offline' : 'Connected'}</p>
        <Barcode value="KEEP-DAY3-PAR-VRS" />
      </article>
      <div className="tag-row">
        <button type="button" className="tag-switch" aria-pressed={offline} onClick={() => setOffline((value) => !value)}>
          {offline ? <WifiOff size={18} aria-hidden="true" /> : <Wifi size={18} aria-hidden="true" />}
          Airplane mode {offline ? 'on' : 'off'}
        </button>
      </div>
    </Stop>
  )
}

/** 05 Stubs: tickets and shared costs ride along as tear-off stubs. */
export function StubsStop() {
  return (
    <Stop id="stubs" title="Tickets and costs, together">
      <div className="tag-stubs">
        <article className="tag-stub-card" aria-labelledby="stub-ticket">
          <h3 id="stub-ticket">Train <span aria-hidden="true">PAR → VRS</span><span className="sr-only">from Paris to Versailles</span></h3>
          <p className="tag-print">Ticket · day 3 · 09:00</p>
          <p className="tag-code-line">Confirmation <strong>QX7R2M</strong></p>
          <p className="tag-fine">Saved on this phone</p>
          <Barcode value="QX7R2M-PAR-VRS" />
        </article>
        {/* A second kind of paper, smaller, clipped over the ticket's barcode: one number is big. */}
        <article className="tag-stub-card is-receipt" aria-labelledby="stub-cost">
          <h3 id="stub-cost">Airport transfer</h3>
          <p className="tag-print">Shared cost · day 1</p>
          <p className="tag-share"><span>Your share</span> <strong>€12.00</strong></p>
          <p className="tag-fine">Maya paid €96.00, split 8 ways</p>
        </article>
      </div>
    </Stop>
  )
}

/** 06 Join: what a friend sees when they open the link. */
export function JoinStop() {
  const [me, setMe] = useState<string | null>(null)
  return (
    <Stop id="join" title="Invite with one link">
      {/* What the friend's phone shows after tapping the link: the trip, then "Who are you?". */}
      <div className="tag-join">
        <p className="tag-join-link"><Link2 size={16} aria-hidden="true" /> joinstowaway.app/join</p>
        <p className="tag-print">{TRIP.name} · {TRAVELERS.length} travelers</p>
        <p className="tag-join-q" id="who-q">Who are you?</p>
        <div className="tag-names" role="group" aria-labelledby="who-q">
          {TRAVELERS.map((name) => <button key={name} type="button" aria-pressed={me === name} onClick={() => setMe(me === name ? null : name)}>{name}</button>)}
        </div>
        <p className="tag-join-result" role="status">{me ? <>You're in as <strong>{me}</strong>.</> : <span className="tag-join-hint">Pick your name. No account, no download.</span>}</p>
      </div>
    </Stop>
  )
}
