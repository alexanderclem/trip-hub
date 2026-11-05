import { useState } from 'react'
import { Link } from 'react-router'
import { Check, Plane, Plus, Ticket, Wifi, WifiOff } from 'lucide-react'
import { Barcode, Perforation, PriorityStamp, usePrintIn } from './parts'
import { DAYS, IDEAS, LAKE_OPTIONS, SCORES, TRAVELERS, total, type Code } from './trip'

export type Winner = (typeof LAKE_OPTIONS)[number] | null

/** One stop on the routing strip: a numbered section of the tag. */
function Stop({ id, title, lede, children, wide = false }: { id: string; leg?: string; title: string; lede: string; children: React.ReactNode; wide?: boolean }) {
  const { ref, printed } = usePrintIn<HTMLElement>()
  return (
    <section ref={ref} id={id} className={`tag-stop ${printed ? 'is-printed' : ''}`} aria-labelledby={`${id}-title`} data-stop={id}>
      <div className={`tag-shell tag-stop-grid ${wide ? 'is-wide' : ''}`}>
        <header className="tag-stop-head">
          <h2 id={`${id}-title`}>{title}</h2>
          <p className="tag-lede">{lede}</p>
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
  const shown = IDEAS.slice(0, saved)
  const ghosts = Math.max(0, 6 - saved)
  return (
    <Stop id="save" leg="01 · Save" title="Everyone drops places in one list." lede="No more scrolling the group chat for that café someone mentioned. Ideas land in the trip, with who added them.">
      <div className="tag-ring" role="list" aria-label="Saved places (real places from our trip, example names)">
        {shown.map((idea, index) => (
          <article key={idea.name} role="listitem" className="tag-mini" style={{ '--i': index } as React.CSSProperties}>
            <p className="tag-mini-code">{idea.town === 'Antigua' ? 'ANT' : idea.town === 'Panajachel' ? 'PAN' : 'SMR'}</p>
            <h3>{idea.name}</h3>
            <p className="tag-mini-meta">{idea.kind} · {idea.town}</p>
            <p className="tag-mini-by">Saved by {idea.by}</p>
          </article>
        ))}
        {Array.from({ length: ghosts }, (_, index) => <div key={index} role="listitem" className="tag-mini is-ghost" aria-label="Empty slot"><span aria-hidden="true">Your idea</span></div>)}
      </div>
      <div className="tag-row">
        <button type="button" className="tag-button is-quiet" onClick={() => setSaved((n) => Math.min(IDEAS.length, n + 1))} disabled={saved >= IDEAS.length}>
          <Plus size={18} aria-hidden="true" /> {saved >= IDEAS.length ? 'All six saved' : 'Save another place'}
        </button>
        <p className="tag-fine" aria-live="polite">{saved} of 6 · real places from our trip</p>
      </div>
    </Stop>
  )
}

/** 02 Vote: the signature interaction. Seven friends are level; the visitor's vote decides. */
export function VoteStop({ mine, setMine, winner }: { mine: Partial<Record<Code, number>>; setMine: (next: Partial<Record<Code, number>>) => void; winner: Winner }) {
  const level = !winner
  return (
    <Stop id="vote" leg="02 · Vote" title="The group decides. The favourite gets priority." lede="Everyone scores the options from No way to Must-do. Seven friends have voted on where to stay at the lake, and it's level. Your vote breaks the tie." wide>
      <div className="tag-vote">
        <p className="tag-vote-question">Where do we stay at the lake?</p>
        <ul className="tag-vote-list">
          {LAKE_OPTIONS.map((option) => {
            const theirs = total(option.votes)
            const yours = mine[option.code]
            const points = theirs + (yours ?? 0)
            const isWinner = winner?.code === option.code
            return (
              <li key={option.code} className={`tag-option ${isWinner ? 'is-winner' : ''}`}>
                <div className="tag-option-head">
                  <span className="tag-option-code" aria-hidden="true">{option.code}</span>
                  <div className="tag-option-name">
                    <h3>{option.town}</h3>
                    <p>{option.boat}</p>
                  </div>
                  <p className="tag-option-points"><span className="sr-only">{option.town}: </span>{points}<span className="sr-only"> points</span><span aria-hidden="true"> pts</span></p>
                  {isWinner && <PriorityStamp />}
                </div>
                <div className="tag-ticks" aria-hidden="true">
                  {option.votes.map((vote, index) => <span key={index} className="tag-tick" style={{ '--w': vote } as React.CSSProperties} />)}
                  {yours !== undefined && <span className="tag-tick is-yours" style={{ '--w': yours } as React.CSSProperties} />}
                </div>
                <div className="tag-score" role="group" aria-label={`Your vote for ${option.town}`}>
                  {SCORES.map((label, score) => (
                    <button key={label} type="button" aria-pressed={yours === score} onClick={() => setMine({ ...mine, [option.code]: yours === score ? undefined : score })}>{label}</button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
        <p className="tag-vote-result" role="status">
          {level ? 'San Marcos and San Pedro are level on 16. Score them to decide.' : <>The group picked <strong>{winner.town}</strong>. It goes on the plan for day 3.</>}
        </p>
        <p className="tag-fine">Example votes. In the app, a vote is a preference: the group still decides what goes on the plan.</p>
      </div>
    </Stop>
  )
}

/** 03 Plan: the routing, day by day. Confirmed prints solid, tentative half-toned, open as a ghost. */
export function PlanStop({ winner }: { winner: Winner }) {
  return (
    <Stop id="plan" leg="03 · Plan" title="The plan, day by day, on every phone." lede="Times, meeting points and who's going, in one routing everyone can read. Confirmed plans print solid; ideas stay light until someone books them." wide>
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
              {day.day === 3 && (winner ? (
                <li className="tag-item is-confirmed is-picked">
                  <span className="tag-time">15:00</span>
                  <span className="tag-what">Stay in {winner.town}<small>The group's pick</small></span>
                  <PriorityStamp />
                </li>
              ) : (
                <li className="tag-item is-open">
                  <span className="tag-time">15:00</span>
                  <span className="tag-what">Where we stay<small>Still deciding: vote above</small></span>
                  <span className="tag-state">Open</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="tag-fine">Example plan on real places. Travel times come from the trip's own route notes.</p>
    </Stop>
  )
}

/** 04 Offline: airplane mode on, the plan stays put. */
export function OfflineStop() {
  const [offline, setOffline] = useState(true)
  return (
    <Stop id="offline" leg="04 · Offline" title="No signal on the lancha? The plan stays." lede="Get the trip ready while you're online and it lives on every phone: the plan, the tickets you saved, and a downloaded map. Changes wait and sync when you're back.">
      <article className={`tag-keep ${offline ? 'is-offline' : ''}`} aria-labelledby="keep-title">
        <div className="tag-keep-head">
          <h3 id="keep-title"><span aria-hidden="true">ANT → PAN</span><span className="sr-only">Day 3, Antigua to Panajachel</span></h3>
          <p className="tag-signal">{offline ? <><Plane size={16} aria-hidden="true" /> No signal</> : <><Wifi size={16} aria-hidden="true" /> Online</>}</p>
        </div>
        <p className="tag-print">Day 3 · Over to Lake Atitlán · saved on this phone</p>
        <ul>
          <li><span className="tag-time">08:00</span> Shuttle to Panajachel <Check size={16} aria-label="Saved on this phone" /></li>
          <li><span className="tag-time">12:30</span> Lancha across the lake <Check size={16} aria-label="Saved on this phone" /></li>
          <li><Ticket size={16} aria-hidden="true" /> Shuttle ticket, downloaded <Check size={16} aria-label="Saved on this phone" /></li>
        </ul>
        <p className="tag-keep-note" role="status">{offline ? 'Offline. Everything you prepared is still here.' : 'Online. Changes sync with the group.'}</p>
        <Barcode value="KEEP-DAY3-ANT-PAN" />
      </article>
      <div className="tag-row">
        <button type="button" className="tag-switch" aria-pressed={offline} onClick={() => setOffline((value) => !value)}>
          {offline ? <WifiOff size={18} aria-hidden="true" /> : <Wifi size={18} aria-hidden="true" />}
          Airplane mode {offline ? 'on' : 'off'}
        </button>
        <p className="tag-fine">Creating or joining a trip needs a connection. Maps download separately.</p>
      </div>
    </Stop>
  )
}

/** 05 Stubs: tickets and shared costs ride along as tear-off stubs. */
export function StubsStop() {
  return (
    <Stop id="stubs" leg="05 · Tickets & costs" title="Tickets and costs ride along." lede="Confirmations sit with the plan they belong to. Shared costs show who paid and who owes; you settle up your own way.">
      <div className="tag-stubs">
        <article className="tag-stub-card" aria-labelledby="stub-ticket">
          <h3 id="stub-ticket">Shuttle <span aria-hidden="true">ANT → PAN</span><span className="sr-only">from Antigua to Panajachel</span></h3>
          <p className="tag-print">Ticket · day 3 · 08:00</p>
          <p className="tag-code-line">Confirmation <strong>QX7R2M</strong></p>
          <p className="tag-fine">Saved on this phone</p>
          <Barcode value="QX7R2M-ANT-PAN" />
        </article>
        <article className="tag-stub-card" aria-labelledby="stub-cost">
          <h3 id="stub-cost">Airport shuttle</h3>
          <p className="tag-print">Shared cost · day 1</p>
          <dl className="tag-cost">
            <div><dt>Paid by</dt><dd>Maya</dd></div>
            <div><dt>Total</dt><dd>$96.00</dd></div>
            <div><dt>Split</dt><dd>8 ways</dd></div>
            <div><dt>Your share</dt><dd>$12.00</dd></div>
          </dl>
          <p className="tag-fine">Stowaway keeps the balance. It doesn't move money.</p>
        </article>
      </div>
      <p className="tag-fine">Example ticket and amounts.</p>
    </Stop>
  )
}

/** 06 Join: what a friend sees when they open the link. */
export function JoinStop() {
  const [me, setMe] = useState<string | null>(null)
  return (
    <Stop id="join" leg="06 · Join" title="Friends tap the link and pick their name." lede="No account, no password, no app store. That's what your group sees when they open your invite." wide>
      <div className="tag-join">
        <p className="tag-join-q" id="who-q">Who are you?</p>
        <div className="tag-names" role="group" aria-labelledby="who-q">
          {TRAVELERS.map((name) => <button key={name} type="button" aria-pressed={me === name} onClick={() => setMe(me === name ? null : name)}>{name}</button>)}
        </div>
        <p className="tag-join-result" role="status">{me ? <>You're in as <strong>{me}</strong>. That was the whole sign-up.</> : 'Pick a name to see what joining feels like.'}</p>
        <p className="tag-fine">Example names. Got a real invite? <Link to="/app#join">Open it here</Link>.</p>
      </div>
    </Stop>
  )
}
