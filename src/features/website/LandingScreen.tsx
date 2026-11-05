import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { WebsiteFrame } from './WebsiteFrame'
import { Barcode, Perforation } from './tag/parts'
import { RouteStrip } from './tag/RouteStrip'
import { JoinStop, OfflineStop, PlanStop, SaveStop, StubsStop, VoteStop, type Winner } from './tag/stops'
import { LAKE_OPTIONS, TRAVELERS, TRIP, total, type Code } from './tag/trip'
import { Stowie } from '@/features/stowie/Stowie'

/** The lake town with the most points once the visitor has broken the tie, or null while level. */
function pickWinner(mine: Partial<Record<Code, number>>): Winner {
  const ranked = LAKE_OPTIONS.map((option) => ({ option, points: total(option.votes) + (mine[option.code] ?? 0) })).sort((a, b) => b.points - a.points)
  const [first, second] = ranked
  return first && second && first.points > second.points ? first.option : null
}

export function LandingScreen() {
  const [mine, setMine] = useState<Partial<Record<Code, number>>>({})
  const winner = useMemo(() => pickWinner(mine), [mine])

  if (typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true))) {
    return <Navigate to="/app" replace />
  }

  return (
    <WebsiteFrame>
      <div className="tag-journey">
        <RouteStrip lake={winner?.code ?? null} />
        <div className="tag-journey-stops">
          <section id="trip" data-stop="trip" className="tag-hero" aria-labelledby="hero-title">
            <div className="tag-shell">
              <div className="tag-print-row" aria-hidden="true">
                <span>Stowaway</span><span>Group trip</span><span>{TRIP.season}</span><span className="tag-print-id">SW 0313</span>
              </div>
              <p className="tag-route" aria-hidden="true">
                {TRIP.route.map((code, index) => <span key={code} style={{ '--i': index } as React.CSSProperties}>{index > 0 && <span className="tag-arrow">→</span>}{code}</span>)}
              </p>
              <div className="tag-hero-grid">
                <div className="tag-hero-copy">
                  <h1 id="hero-title">Your group trip.<br />All in one place.</h1>
                  <p className="tag-intro">Save places, vote on favorites and build the itinerary together. Tickets and shared costs stay with the plan.</p>
                </div>
                <div className="tag-hero-stubs">
                  <Link to="/new" className="tag-tear is-primary">
                    <span className="tag-tear-label">Create a trip</span>
                    <span className="tag-print" aria-hidden="true">Free for the whole group</span>
                  </Link>
                  <Link to="/app#join" className="tag-tear">
                    <span className="tag-tear-label">Join trip</span>
                    <span className="tag-print" aria-hidden="true">Got an invite link? No account needed</span>
                  </Link>
                </div>
                <div className="tag-pax">
                  <p className="tag-print">Travelers · {TRAVELERS.length}</p>
                  <ol aria-label="Travelers (example names)">
                    {TRAVELERS.map((name, index) => <li key={name} style={{ '--i': index } as React.CSSProperties}><span className="tag-pax-seq" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{name}</li>)}
                  </ol>
                  <p className="tag-fine">Real places from our spring-break trip to Guatemala. Names, votes and times are examples.</p>
                  <div className="tag-hero-code" aria-hidden="true"><Barcode value="STOWAWAY-ANT-PAN" /></div>
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
          <h2 id="organizers-title">Running trips for other people?</h2>
          <p>Retreats, clubs and small operators can plan with their travelers and, in early access, collect deposits through their own Stripe account.</p>
          <Link to="/operators" className="tag-link">Stowaway for organizers</Link>
        </div>
        <Perforation />
      </section>

      <section className="tag-faq-wrap" aria-labelledby="questions-title">
        <div className="tag-shell tag-faq-grid">
          <div>
            <h2 id="questions-title">Before you pack</h2>
            <p className="tag-lede">We built Stowaway to plan our own spring-break trip to Guatemala. Here's what people ask first.</p>
          </div>
          <div className="tag-faq">
            <details><summary>Do my friends need to download anything?</summary><p>No. Stowaway runs in the browser. Friends open your invite link and pick their name. Anyone can add it to their Home Screen later.</p></details>
            <details><summary>Is it really free?</summary><p>Yes, for groups. Creating trips, inviting, voting, the plan, tickets, shared costs and offline use are free. Paid tools are only for people who run trips for others.</p></details>
            <details><summary>Who can see our trip?</summary><p>Anyone with the invite link can join and see the group's plans and documents, so share it only with your group. The <Link to="/privacy">privacy policy</Link> has the details.</p></details>
            <details><summary>How does offline work?</summary><p>Before you go, open the trip's settings while online and choose Ready for offline. The plan and downloaded tickets then work with no signal. Maps download separately. Creating or joining a trip needs a connection.</p></details>
            <details><summary>Does Stowaway book travel or move money?</summary><p>No. It keeps your plan, confirmations and who-owes-whom in one place. You book and settle up the way you already do.</p></details>
          </div>
        </div>
        <Perforation />
      </section>

      <section className="tag-close" aria-labelledby="closing-title">
        <div className="tag-shell tag-close-inner">
          <Stowie mood="delighted" size={112} animated={false} className="tag-close-stowie" />
          <div>
            <h2 id="closing-title">The whole trip, tucked away.</h2>
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
