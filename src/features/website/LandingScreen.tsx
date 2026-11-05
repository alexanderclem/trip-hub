import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { WebsiteFrame } from './WebsiteFrame'
import { Barcode, Perforation } from './tag/parts'
import { RouteStrip } from './tag/RouteStrip'
import { JoinStop, OfflineStop, PlanStop, SaveStop, StubsStop, VoteStop, type Winner } from './tag/stops'
import { NEIGHBORHOODS, TRAVELERS, TRIP, total, type Code } from './tag/trip'
import { Stowie } from '@/features/stowie/Stowie'

/** The neighborhood with the most points, or null while tied. */
function pickWinner(mine: Partial<Record<Code, number>>): Winner {
  const ranked = NEIGHBORHOODS.map((option) => ({ option, points: total(option.votes) + (mine[option.code] ?? 0) })).sort((a, b) => b.points - a.points)
  const [first, second] = ranked
  return first && second && first.points > second.points ? first.option : null
}

/**
 * The hero prints itself once per page load. The class is in the prerendered markup, so the print
 * starts with the first paint and hydration keeps it running; coming back to home later in the
 * same visit shows the tag already printed.
 */
let heroPrinted = false

export function LandingScreen() {
  const [printing] = useState(() => !heroPrinted)
  useEffect(() => { heroPrinted = true }, [])
  const [mine, setMine] = useState<Partial<Record<Code, number>>>({})
  const winner = useMemo(() => pickWinner(mine), [mine])

  if (typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true))) {
    return <Navigate to="/app" replace />
  }

  return (
    <WebsiteFrame>
      <div className="tag-journey">
        <RouteStrip choice={winner?.code ?? null} />
        <div className="tag-journey-stops">
          <section id="trip" data-stop="trip" className={printing ? 'tag-hero is-printing' : 'tag-hero'} aria-labelledby="hero-title">
            <div className="tag-shell">
              <div className="tag-print-row">
                <span>Example trip · {TRIP.destination}</span><span className="tag-print-id">{TRIP.season}</span>
              </div>
              <p className="tag-route" aria-hidden="true">
                {TRIP.route.map((code, index) => <span key={code} style={{ '--i': index } as React.CSSProperties}>{index > 0 && <span className="tag-arrow">→</span>}{code}</span>)}
              </p>
              <div className="tag-hero-grid">
                <div className="tag-hero-copy">
                  <h1 id="hero-title">Plan a trip<br />with friends.</h1>
                </div>
                <div className="tag-hero-stubs">
                  <Link to="/new" className="tag-tear is-primary">
                    <span className="tag-tear-label">Create a trip</span>
                  </Link>
                  <Link to="/app#join" className="tag-tear">
                    <span className="tag-tear-label">Join trip</span>
                  </Link>
                </div>
                <div className="tag-pax">
                  <p className="tag-print">Travelers · {TRAVELERS.length}</p>
                  <ol aria-label="Travelers (example names)">
                    {TRAVELERS.map((name, index) => <li key={name} style={{ '--i': index } as React.CSSProperties}><span className="tag-pax-seq" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{name}</li>)}
                  </ol>
                  <div className="tag-hero-code" aria-hidden="true"><Barcode value="STOWAWAY-PARIS" /></div>
                </div>
              </div>
            </div>
            <Perforation />
          </section>
          <SaveStop />
          <VoteStop mine={mine} setMine={setMine} winner={winner} />
          <PlanStop winner={winner} />
          <OfflineStop />
          <StubsStop />
          <JoinStop />
        </div>
      </div>

      <section className="tag-band" aria-labelledby="organizers-title">
        <div className="tag-shell tag-band-inner">
          <h2 id="organizers-title">Planning trips for others?</h2>
          <Link to="/operators" className="tag-link">Stowaway for organizers</Link>
        </div>
        <Perforation />
      </section>

      <section className="tag-faq-wrap" aria-labelledby="questions-title">
        <div className="tag-shell tag-faq-grid">
          <div>
            <h2 id="questions-title">Questions</h2>
          </div>
          <div className="tag-faq">
            <details><summary>Do my friends need to download anything?</summary><p>No. Stowaway runs in the browser. Open the invite and pick your name.</p></details>
            <details><summary>Is it really free?</summary><p>Yes. Group trips are free, including offline use. Paid tools are for organizers.</p></details>
            <details><summary>Who can see our trip?</summary><p>Anyone with the invite link can see the group's plans and documents. Share it only with your group. Read our <Link to="/privacy">privacy policy</Link>.</p></details>
            <details><summary>How does offline work?</summary><p>Before you go, open the trip's settings while online and choose Ready for offline. Your plan and downloaded tickets work without signal. Download maps separately. Creating or joining a trip needs a connection.</p></details>
            <details><summary>Does Stowaway book travel or move money?</summary><p>No. Book travel and settle up your usual way. Stowaway keeps the plans, tickets and shared balances together.</p></details>
          </div>
        </div>
        <Perforation />
      </section>

      <section className="tag-close" aria-labelledby="closing-title">
        <div className="tag-shell tag-close-inner">
          <Stowie mood="delighted" size={112} animated={false} className="tag-close-stowie" />
          <div>
            <h2 id="closing-title">Start planning</h2>
            <div className="tag-close-actions">
              <Link to="/new" className="tag-tear is-primary is-compact"><span className="tag-tear-label">Create a trip</span></Link>
              <Link to="/how-it-works" className="tag-link">See how it works</Link>
            </div>
          </div>
        </div>
      </section>
    </WebsiteFrame>
  )
}
