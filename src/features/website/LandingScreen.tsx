import { CalendarDays, Receipt, Ticket, Vote } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { Brand } from '@/ui/Brand'
import { TripPreview } from './TripPreview'
import { StepExamples } from './StepExamples'
import './website.css'

function WebsiteLogo() {
  return <Brand variant="website" className="website-logo" />
}

export function LandingScreen() {
  // Existing Home Screen installations may still launch the old root URL.
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
          <Link to="/app" className="website-button website-button-outline">Open app</Link>
        </nav>
      </header>
      </div>

      <main id="main-content" tabIndex={-1}>
        <section className="website-hero website-container" aria-labelledby="hero-title">
          <div className="website-hero-copy">
            <p className="website-eyebrow">Plan your trip together</p>
            <h1 id="hero-title">Get the trip out of the group chat.</h1>
            <p className="website-intro">Choose places, decide together, and keep the plan, tickets, and shared costs in one place. Stowaway helps your group’s trip take shape, from the first “where should we go?” to the flight home.</p>
            <div className="website-actions">
              <Link to="/new" className="website-button website-button-primary">Create a trip</Link>
              <Link to="/app#join" className="website-text-link">Join your group</Link>
            </div>
            <p className="website-hero-note">Start in your browser. Bring your friends. Take it along on your phone.</p>
          </div>
          <TripPreview />
        </section>

        <div className="website-capabilities">
          <ul className="website-container" aria-label="Trip essentials">
            <li><Vote size={19} aria-hidden="true" /> Decide together</li>
            <li><CalendarDays size={19} aria-hidden="true" /> Know what’s next</li>
            <li><Ticket size={19} aria-hidden="true" /> Keep every ticket handy</li>
            <li><Receipt size={19} aria-hidden="true" /> See who owes what</li>
          </ul>
        </div>

        <section id="how-it-works" className="website-how website-container" aria-labelledby="how-title">
          <div className="website-section-heading"><h2 id="how-title">From “we should go”<br />to “we’re going.”</h2><StepExamples /></div>
          <ol className="website-steps">
            <li><div><h3>Give the idea a place to land.</h3><p>That weekend away you keep talking about? Create a trip and invite your friends. Pick a destination now, or figure it out together.</p></div></li>
            <li><div><h3>Find something everyone’s excited about.</h3><p>Save the restaurant someone sent, the beach you spotted, or a place to stay. Start a vote and turn the group’s favorites into a plan.</p></div></li>
            <li><div><h3>Booked the flight? Bring the details.</h3><p>Add the confirmation, see what’s next, and keep shared costs clear. Download your trip’s essentials before you leave so they’re handy when the signal isn’t.</p></div></li>
          </ol>
        </section>

        <section className="website-offline" aria-labelledby="offline-title">
          <div className="website-container website-offline-inner">
            <img src="/brand/packed-for-anywhere.svg" alt="" width="360" height="170" loading="lazy" />
            <div><h2 id="offline-title">Packed for wherever you go.</h2><p>Add Stowaway to your phone’s Home Screen and download your trip’s essentials before you leave. Your saved plans and downloaded tickets stay close, even when the signal doesn’t.</p><Link to="/app" className="website-text-link">Find your trips</Link></div>
          </div>
        </section>

        <section id="questions" className="website-questions website-container" aria-labelledby="questions-title">
          <div className="website-section-heading"><h2 id="questions-title">A few helpful details.</h2></div>
          <div className="website-faq">
            <details><summary>Do I need to download an app?</summary><p>You can create and plan a trip right in your browser. For easy access on the go, add Stowaway to your phone’s Home Screen from your browser’s share or install menu.</p></details>
            <details><summary>How does my group join?</summary><p>Create a trip, then share its invite link from Trip settings & sharing. Friends open the link and choose who they are in the group. Already have an invite? <Link to="/app#join">Join your trip here.</Link></p></details>
            <details><summary>Can I use it without a connection?</summary><p>Yes, after preparing your trip while online. Use “Ready for offline” in your trip settings to save essentials to your phone. Downloaded tickets and saved trip data work without signal; maps need a downloaded map pack or saved area. Creating or joining a trip needs a connection.</p></details>
            <details><summary>Can I get my trips on another phone?</summary><p>Use your group’s invite link to rejoin on another device. When Google sign-in is available, you can also sign in from the app to restore the trips connected to your account.</p></details>
          </div>
        </section>

        <section className="website-closing website-container" aria-labelledby="closing-title"><div><h2 id="closing-title">Make that “someday” trip happen.</h2></div><Link to="/new" className="website-button website-button-primary">Start planning</Link></section>
      </main>

      <footer className="website-footer website-container"><Link to="/" aria-label="Stowaway home"><WebsiteLogo /></Link><p>The whole trip, tucked away. <a href="#how-it-works">How it works</a> · <a href="#questions">Questions</a> · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link></p><Link to="/app">Open app</Link></footer>
    </div>
  )
}
