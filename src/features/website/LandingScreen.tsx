import { Link, Navigate } from 'react-router'
import { ArrowRight, Check } from 'lucide-react'
import { WebsiteFrame } from './WebsiteFrame'
import { Perforation } from './tag/parts'
import { Stowie } from '@/features/stowie/Stowie'
import { MAINTAINER } from './metadata'
import { HeroDemo } from './stage/HeroDemo'
import { Features } from './stage/Features'

// The three promises that answer "what's the catch?" next to every Create a trip.
const ASSURANCES = ['Free for groups', 'No app or sign-up to join', 'Works offline'] as const

function Assurances({ className = '' }: { className?: string }) {
  return (
    <ul className={`tag-assure ${className}`}>
      {ASSURANCES.map((text) => <li key={text}><Check size={18} strokeWidth={2.5} aria-hidden="true" />{text}</li>)}
    </ul>
  )
}

// How a trip starts, in the order it actually happens in the app.
const STEPS = [
  { title: 'Create the trip', body: 'Name it and add where you’re going. No account needed.' },
  { title: 'Share one link', body: 'Drop it in the group chat. Friends open it in the browser and pick their name.' },
  { title: 'Decide together', body: 'Save places, vote on favorites, and put the winners in the day-by-day plan.' },
] as const

// What each scattered tool becomes. Left: how group trips are planned today. Right: the screen in Stowaway.
const INSTEAD = [
  ['Ideas buried in the group chat', 'Saved places and votes'],
  ['A spreadsheet one person updates', 'A day-by-day plan everyone sees'],
  ['Screenshots of tickets', 'Tickets on every phone, offline'],
  ['A separate expense app', 'Shared costs and who owes whom'],
] as const

export function LandingScreen() {
  if (typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true))) {
    return <Navigate to="/app" replace />
  }

  return (
    <WebsiteFrame>
      {/* The hero leads with the message; beside it the app plays one story: a vote decides, the plan fills in. */}
      <section id="trip" className="tag-hero" aria-labelledby="hero-title">
        <div className="tag-shell tag-hero-grid">
          <div className="tag-hero-copy">
            <h1 id="hero-title">Plan a trip<br />with friends.</h1>
            <p className="tag-lede">Save places, vote on favorites and build the day-by-day plan together. Tickets and shared costs live with it, on every phone.</p>
            <div className="tag-hero-stubs">
              <Link to="/new" className="tag-tear is-primary">
                <span className="tag-tear-label">Create a trip</span>
              </Link>
              <Link to="/app#join" className="tag-tear">
                <span className="tag-tear-label">Join trip</span>
              </Link>
            </div>
            <Assurances />
          </div>
          <HeroDemo />
        </div>
        <Perforation />
      </section>

      <Features />

      <section className="tag-steps-wrap" aria-labelledby="steps-title">
        <div className="tag-shell tag-steps-inner">
          <h2 id="steps-title">From group chat to plan in three steps</h2>
          <ol className="tag-steps">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="tag-step-no" aria-hidden="true">{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="tag-steps-actions">
            <Link to="/new" className="tag-tear is-primary is-compact"><span className="tag-tear-label">Create a trip</span></Link>
            <Link to="/how-it-works" className="tag-link">See how it works</Link>
          </div>
        </div>
        <Perforation />
      </section>

      <section className="tag-faq-wrap" aria-labelledby="why-title">
        <div className="tag-shell tag-faq-grid">
          <div>
            <h2 id="why-title">One link instead of five apps</h2>
            <p className="tag-lede">Group trips end up split across the chat, a spreadsheet and everyone’s inbox. Stowaway keeps them together.</p>
          </div>
          <div className="tag-story">
            <ul className="tag-instead" aria-label="What Stowaway replaces">
              {INSTEAD.map(([before, after]) => (
                <li key={before}>
                  <span className="tag-instead-before"><span className="sr-only">Instead of </span>{before}</span>
                  <ArrowRight size={18} aria-hidden="true" className="tag-instead-arrow" />
                  <span className="tag-instead-after">{after}</span>
                </li>
              ))}
            </ul>
            <p className="tag-fine tag-story-note">Built by {MAINTAINER.name} for a spring break in Guatemala, where signal is patchy. Planning with your group stays free. Questions: <a href={`mailto:${MAINTAINER.email}`}>{MAINTAINER.email}</a>.</p>
            <p className="tag-story-links"><Link to="/group-expenses" className="tag-link">How splitting costs works</Link><Link to="/compare/best-group-trip-planner-apps" className="tag-link">Compare group trip apps</Link></p>
          </div>
        </div>
        <Perforation />
      </section>

      <section className="tag-band" aria-labelledby="organizers-title">
        <div className="tag-shell tag-band-inner">
          <div>
            <h2 id="organizers-title">Planning trips for others?</h2>
            <p className="tag-band-sub">Retreats, club and student trips: a public trip page, traveler lists and rooming, with payment collection in early access.</p>
          </div>
          <Link to="/organizers" className="tag-link">Stowaway for organizers</Link>
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
            <details><summary>Does it work on iPhone and Android?</summary><p>Yes. It runs in any up-to-date phone browser, and you can add it to your Home Screen so it opens like an app.</p></details>
            <details><summary>Who can see our trip?</summary><p>Anyone with the invite link can see the group's plans and documents. Share it only with your group. Read our <Link to="/privacy">privacy policy</Link>.</p></details>
            <details><summary>How does offline work?</summary><p>Before you go, open the trip's settings while online and choose Ready for offline. Your plan and downloaded tickets work without signal. Download maps separately. Creating or joining a trip needs a connection.</p></details>
            <details><summary>How do we split costs?</summary><p>Log each cost as it happens: who paid, and how to split it (equally, by shares, exact amounts or percentages). Stowaway keeps a running balance for everyone and works out the fewest payments to settle up. <Link to="/group-expenses">More about group expenses</Link>.</p></details>
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
            <p className="tag-lede tag-close-lede">Create the trip, share the link, and your group can start saving places today.</p>
            <div className="tag-close-actions">
              <Link to="/new" className="tag-tear is-primary is-compact"><span className="tag-tear-label">Create a trip</span></Link>
              <Link to="/how-it-works" className="tag-link">See how it works</Link>
            </div>
            <Assurances className="is-quiet" />
          </div>
        </div>
      </section>
    </WebsiteFrame>
  )
}
