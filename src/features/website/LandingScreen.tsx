import { ArrowUpRight, Check, MapPin, Receipt, Ticket, Vote } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { Brand } from '@/ui/Brand'
import { TripPreview } from './TripPreview'
import { Reveal, WordReveal } from './effects'
import './website.css'

function WebsiteLogo() {
  return <Brand variant="website" className="website-logo" />
}

export function LandingScreen() {
  if (window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true)) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="website">
      <a className="website-skip" href="#main-content">Skip to content</a>
      <div className="website-topbar">
        <header className="website-header website-container">
          <Link to="/" aria-label="Stowaway home"><WebsiteLogo /></Link>
          <nav aria-label="Main navigation">
            <a href="#how-it-works" className="website-nav-detail">How it works</a>
            <a href="#questions" className="website-nav-detail">Questions</a>
            <Link to="/app" className="website-button website-button-outline">Open app <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </nav>
        </header>
      </div>

      <main id="main-content" tabIndex={-1}>
        <section className="website-hero website-container" aria-labelledby="hero-title">
          <div className="website-hero-copy">
            <p className="website-eyebrow website-category"><span aria-hidden="true" /> The shared trip planner</p>
            <h1 id="hero-title">Your group trip.<br /><em><WordReveal text="All in one place." delay={0.15} /></em></h1>
            <p className="website-intro">Save places, vote on favorites, and build an itinerary together. Keep tickets and shared expenses with the plan.</p>
            <div className="website-actions">
              <Link to="/new" className="website-button website-button-primary">Create a trip <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <Link to="/app#join" className="website-button website-button-outline">Join a trip</Link>
            </div>
            <p className="website-hero-note">Free. Runs in your browser, no password.</p>
          </div>
          <div id="the-plan" className="website-hero-example"><TripPreview /></div>
        </section>

        <div className="website-capabilities">
          <ul className="website-container" aria-label="Trip essentials">
            <li><MapPin size={19} aria-hidden="true" /> Save places</li>
            <li><Vote size={19} aria-hidden="true" /> Decide together</li>
            <li><Ticket size={19} aria-hidden="true" /> Keep tickets handy</li>
            <li><Receipt size={19} aria-hidden="true" /> Split shared costs</li>
          </ul>
        </div>

        <section id="how-it-works" className="website-how" aria-labelledby="how-title">
          <div className="website-container">
            <Reveal className="website-section-heading"><div><h2 id="how-title">How it works</h2></div></Reveal>
            <ol className="website-steps">
              <li><Reveal className="website-step" delay={0}><div className="website-step-heading"><span className="website-step-number" aria-hidden="true">01</span><h3>Invite your people</h3></div><p>Create a trip with a name and share the invite link. Friends pick their name when they open it.</p></Reveal></li>
              <li><Reveal className="website-step" delay={0.08}><div className="website-step-heading"><span className="website-step-number" aria-hidden="true">02</span><h3>Pick the group’s favorites</h3></div><p>Save the places everyone suggests and vote on them. The winner becomes a stop on the plan.</p></Reveal></li>
              <li><Reveal className="website-step" delay={0.16}><div className="website-step-heading"><span className="website-step-number" aria-hidden="true">03</span><h3>Know what’s next, and who paid</h3></div><p>See the day’s itinerary, open tickets, and check who owes what.</p></Reveal></li>
            </ol>
          </div>
        </section>

        <section className="website-offline" aria-labelledby="offline-title">
          <div className="website-container website-offline-inner">
            <div className="website-hero-art">
              <img className="website-hero-photo" src="/images/lakeside-escape.jpg" alt="The bow of a wooden boat on a mountain lake in the Dolomites" width="1800" height="1200" loading="lazy" />
              <p className="website-photo-caption">The Dolomites, Italy.</p>
            </div>
            <Reveal>
              <h2 id="offline-title">Works without signal</h2>
              <p>Before you leave, use “Ready for offline” in trip settings. Your itinerary and downloaded tickets then work without a connection.</p>
              <ul className="website-offline-list">
                <li><Check size={16} aria-hidden="true" /> Changes wait on your phone and sync when you’re back</li>
                <li><MapPin size={16} aria-hidden="true" /> Maps need a downloaded pack or saved area</li>
              </ul>
              <Link to="/app" className="website-text-link">Open your trips <ArrowUpRight size={18} aria-hidden="true" /></Link>
            </Reveal>
          </div>
        </section>

        <section id="questions" className="website-questions website-container" aria-labelledby="questions-title">
          <Reveal><h2 id="questions-title">Questions</h2></Reveal>
          <div className="website-faq">
            <details><summary>Do I need to download an app?</summary><p>No. You can create and plan a trip in your browser. You can also add Stowaway to your phone’s Home Screen.</p></details>
            <details><summary>How does my group join?</summary><p>Create a trip and share its invite link from trip settings. Friends open the link and pick their name. Have a link already? <Link to="/app#join">Join your trip.</Link></p></details>
            <details><summary>Who can see our trip?</summary><p>Anyone with the invite link can join and see the group’s plans and documents, so only share it with people you trust. See the <Link to="/privacy">privacy policy</Link> for details.</p></details>
            <details><summary>Can I use it without a connection?</summary><p>Yes, once you’ve prepared the trip while online. “Ready for offline” in trip settings saves trip data and downloads tickets to your phone. Maps need a downloaded pack or saved area. Creating or joining a trip needs a connection.</p></details>
            <details><summary>Can I get my trips on another phone?</summary><p>Rejoin with your group’s invite link, or sign in with the same account to restore its trips. Downloads are saved separately on each phone.</p></details>
          </div>
        </section>

        <section className="website-closing" aria-labelledby="closing-title"><div className="website-container website-closing-inner"><Reveal><h2 id="closing-title">Plan your next trip together.</h2></Reveal><Link to="/new" className="website-button website-button-primary">Create a trip <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>
      </main>

      <footer className="website-footer website-container"><div><Link to="/" aria-label="Stowaway home"><WebsiteLogo /></Link><p>A shared planner for group trips.</p></div><nav aria-label="Footer navigation"><a href="#how-it-works">How it works</a><a href="#questions">Questions</a><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/app">Open app</Link></nav></footer>
    </div>
  )
}
