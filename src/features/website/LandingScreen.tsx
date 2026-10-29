import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, MapPin, Receipt, Ticket, Vote } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { Brand } from '@/ui/Brand'
import { TripPreview } from './TripPreview'
import { StepExamples } from './StepExamples'
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
            <a href="#the-plan" className="website-nav-detail">Example trip</a>
            <a href="#how-it-works" className="website-nav-detail">How it works</a>
            <Link to="/app" className="website-button website-button-outline">Open app <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </nav>
        </header>
      </div>

      <main id="main-content" tabIndex={-1}>
        <section className="website-hero website-container" aria-labelledby="hero-title">
          <div className="website-hero-copy">
            <p className="website-eyebrow website-category"><span aria-hidden="true" /> The shared trip planner</p>
            <h1 id="hero-title">Your group trip.<br /><em>All in one place.</em></h1>
            <p className="website-intro">Save places, vote on favorites, and build an itinerary together. Keep tickets and shared expenses with the plan.</p>
            <div className="website-actions">
              <Link to="/new" className="website-button website-button-primary">Create a trip <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <Link to="/app#join" className="website-text-link">Join your group</Link>
            </div>
            <p className="website-hero-note">Works in your browser. Ready to take along on your phone.</p>
          </div>
          <div className="website-hero-art">
            <img className="website-hero-photo" src="/images/lakeside-escape.jpg" alt="The bow of a wooden boat on a mountain lake in the Dolomites" width="1800" height="1200" fetchPriority="high" />
            <div className="website-postcard-note"><img src="/brand/stowaway-mark.svg" width="48" height="48" alt="" /><p>The whole trip,<br /><em>tucked away.</em></p></div>
            <p className="website-photo-caption">A little inspiration: the Dolomites, Italy.</p>
          </div>
          <a className="website-explore" href="#the-plan">See what goes in your trip <ArrowDown size={16} aria-hidden="true" /></a>
        </section>

        <div className="website-capabilities">
          <ul className="website-container" aria-label="Trip essentials">
            <li><MapPin size={19} aria-hidden="true" /> Save places</li>
            <li><Vote size={19} aria-hidden="true" /> Decide together</li>
            <li><Ticket size={19} aria-hidden="true" /> Keep tickets handy</li>
            <li><Receipt size={19} aria-hidden="true" /> Split shared costs</li>
          </ul>
        </div>

        <section id="the-plan" className="website-product website-container" aria-labelledby="product-title">
          <div className="website-product-copy">
            <p className="website-eyebrow">One plan for everyone</p>
            <h2 id="product-title">Know what’s next.<br /><em>Enjoy where you are.</em></h2>
            <p>Turn the group’s saved places into a day-by-day itinerary. See when to go, where to meet, and what’s already planned.</p>
            <ul className="website-product-details">
              <li><CalendarDays size={20} aria-hidden="true" /><div><h3>Build the day together</h3><p>Add activities, times, and notes to a shared plan.</p></div></li>
              <li><MapPin size={20} aria-hidden="true" /><div><h3>See your stops on the map</h3><p>Keep the day’s places and route in view.</p></div></li>
              <li><Ticket size={20} aria-hidden="true" /><div><h3>Keep the ticket with the plan</h3><p>Attach tickets and confirmations to the right activity.</p></div></li>
            </ul>
            <p className="website-preview-instruction"><ArrowDown className="website-preview-below" size={16} aria-hidden="true" /><ArrowRight className="website-preview-beside" size={16} aria-hidden="true" /> Try the example: switch between days.</p>
          </div>
          <div className="website-product-demo"><TripPreview /></div>
        </section>

        <section id="how-it-works" className="website-how" aria-labelledby="how-title">
          <div className="website-container">
            <div className="website-section-heading"><div><p className="website-eyebrow">From the first idea to the last day</p><h2 id="how-title">Make a plan.<br /><em>Make it together.</em></h2></div><p>Start with a trip link. Give everyone a say. <br />Keep the details where the group can find them.</p></div>
            <StepExamples />
          </div>
        </section>

        <section className="website-offline" aria-labelledby="offline-title">
          <div className="website-container website-offline-inner">
            <div className="website-offline-art"><span className="website-eyebrow">Packed for the way there</span><img src="/brand/packed-for-anywhere.svg" alt="" width="360" height="170" /><div className="website-offline-check"><Check size={16} aria-hidden="true" /> Plans and downloaded tickets, on your phone</div></div>
            <div><p className="website-eyebrow">Prepare once. Take it with you.</p><h2 id="offline-title">Your plans travel.<br /><em>Even without signal.</em></h2><p>Before you leave, use “Ready for offline” in trip settings. Your saved itinerary and downloaded tickets stay available without a connection.</p><p className="website-offline-note">Need maps too? Download a map pack or save an area while online.</p><Link to="/app" className="website-text-link">Open your trips <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
          </div>
        </section>

        <section id="questions" className="website-questions website-container" aria-labelledby="questions-title">
          <div><p className="website-eyebrow">Before you start</p><h2 id="questions-title">A few things<br /><em>to know.</em></h2></div>
          <div className="website-faq">
            <details><summary>Do I need to download an app?</summary><p>You can create and plan a trip right in your browser. Add Stowaway to your phone’s Home Screen for quick access on the go.</p></details>
            <details><summary>How does my group join?</summary><p>Create a trip and share its invite link from trip settings. Friends open the link and choose who they are in the group. Have a link already? <Link to="/app#join">Join your trip.</Link></p></details>
            <details><summary>Can I use it without a connection?</summary><p>Yes, after preparing your trip while online. “Ready for offline” in trip settings saves trip data and downloads tickets to your phone. Maps need a downloaded pack or saved area. Creating or joining a trip needs a connection.</p></details>
            <details><summary>Can I get my trips on another phone?</summary><p>Rejoin with your group’s invite link. If sign-in is available, use the same account to restore its connected trips.</p></details>
          </div>
        </section>

        <section className="website-closing" aria-labelledby="closing-title"><div className="website-container website-closing-inner"><div><p className="website-eyebrow">Start with the people. Add the plan.</p><h2 id="closing-title">Next stop: <em>going together.</em></h2></div><Link to="/new" className="website-button website-button-primary">Start planning <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>
      </main>

      <footer className="website-footer website-container"><div><Link to="/" aria-label="Stowaway home"><WebsiteLogo /></Link><p>A shared trip planner for trips with friends.</p></div><nav aria-label="Footer navigation"><a href="#how-it-works">How it works</a><a href="#questions">Questions</a><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/app">Open app</Link></nav></footer>
    </div>
  )
}
