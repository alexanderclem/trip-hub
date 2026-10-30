import { ArrowUpRight, Check, MapPin, Receipt, Ticket, Vote } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { Brand } from '@/ui/Brand'
import { TripPreview } from './TripPreview'
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
            <p className="website-eyebrow website-category">Made for trips with friends</p>
            <h1 id="hero-title">Your group trip.<br />All in one place.</h1>
            <p className="website-intro">Save places, vote on favorites, and build an itinerary together. Keep tickets and shared expenses with the plan.</p>
            <div className="website-actions">
              <Link to="/new" className="website-button website-button-primary">Create a trip <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <Link to="/app#join" className="website-text-link">Join a trip</Link>
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
            <div className="website-section-heading"><h2 id="how-title">How it works</h2></div>
            <ol className="website-steps">
              <li className="website-step">
                <div className="website-step-heading"><span className="website-step-number" aria-hidden="true">1</span><h3>Bring your people</h3></div>
                <p>Name your trip and share one invite link. Everyone’s plans stay together.</p>
              </li>
              <li className="website-step">
                <div className="website-step-heading"><span className="website-step-number" aria-hidden="true">2</span><h3>Decide together</h3></div>
                <p>Save the places you find, vote on the options, and add the group’s favorites to the plan.</p>
              </li>
              <li className="website-step">
                <div className="website-step-heading"><span className="website-step-number" aria-hidden="true">3</span><h3>Take the plan with you</h3></div>
                <p>Follow the day’s itinerary, pull up your tickets, and keep track of shared expenses.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="website-offline" aria-labelledby="offline-title">
          <div className="website-container website-offline-inner">
            <div className="website-hero-art">
              <img className="website-hero-photo" src="/images/lakeside-escape.jpg" alt="The bow of a wooden boat on a mountain lake in the Dolomites" width="1800" height="1200" loading="lazy" />
              <p className="website-photo-caption">The Dolomites, Italy.</p>
            </div>
            <div>
              <h2 id="offline-title">Your plan, even offline.</h2>
              <p>Before you leave, use “Ready for offline” in trip settings. Your itinerary and downloaded tickets then work without a connection.</p>
              <ul className="website-offline-list">
                <li><Check size={16} aria-hidden="true" /> Changes wait on your phone and sync when you’re back</li>
                <li><MapPin size={16} aria-hidden="true" /> Maps need a downloaded pack or saved area</li>
              </ul>
              <Link to="/app" className="website-text-link">Open your trips <ArrowUpRight size={18} aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

        <section id="questions" className="website-questions website-container" aria-labelledby="questions-title">
          <div><h2 id="questions-title">Questions</h2></div>
          <div className="website-faq">
            <details><summary>Do I need to download an app?</summary><p>No. You can create and plan a trip in your browser. You can also add Stowaway to your phone’s Home Screen.</p></details>
            <details><summary>How does my group join?</summary><p>Create a trip and share its invite link from trip settings. Friends open the link and pick their name. Have a link already? <Link to="/app#join">Join your trip.</Link></p></details>
            <details><summary>Who can see our trip?</summary><p>Anyone with the invite link can join and see the group’s plans and documents, so only share it with people you trust. See the <Link to="/privacy">privacy policy</Link> for details.</p></details>
            <details><summary>Can I use it without a connection?</summary><p>Yes, once you’ve prepared the trip while online. “Ready for offline” in trip settings saves trip data and downloads tickets to your phone. Maps need a downloaded pack or saved area. Creating or joining a trip needs a connection.</p></details>
            <details><summary>Can I get my trips on another phone?</summary><p>Rejoin with your group’s invite link, or sign in with the same account to restore its trips. Downloads are saved separately on each phone.</p></details>
          </div>
        </section>

        <section className="website-closing" aria-labelledby="closing-title"><div className="website-container website-closing-inner"><div><h2 id="closing-title">Plan your next trip together.</h2></div><Link to="/new" className="website-button website-button-primary">Create a trip <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>
      </main>

      <footer className="website-footer website-container"><div><Link to="/" aria-label="Stowaway home"><WebsiteLogo /></Link><p>A shared planner for group trips.</p></div><nav aria-label="Footer navigation"><a href="#how-it-works">How it works</a><a href="#questions">Questions</a><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/app">Open app</Link></nav></footer>
    </div>
  )
}
