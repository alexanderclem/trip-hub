import type { ReactNode } from 'react'
import { ArrowDown, ArrowUpRight, CalendarDays, Receipt, Ticket, Vote } from 'lucide-react'
import { m } from 'motion/react'
import { Link, Navigate } from 'react-router'
import { Brand } from '@/ui/Brand'
import { useMotionPreference } from '@/ui/MotionProvider'
import { TripPreview } from './TripPreview'
import { StepExamples } from './StepExamples'
import './website.css'

/** The reference's reveal choreography, using Stowaway's existing motion runtime. */
function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduced = useMotionPreference()
  return <m.div className={className} initial={false} whileInView={reduced ? undefined : { y: [24, 0], opacity: [.6, 1] }} viewport={{ once: true, amount: .15 }} transition={{ duration: .65, ease: [.16, 1, .3, 1] }}>{children}</m.div>
}

function WebsiteLogo() {
  return <Brand variant="website" className="website-logo" />
}

export function LandingScreen() {
  const reduced = useMotionPreference()
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
            <p className="website-eyebrow"><span className="website-rule" /> A shared trip planner for good company</p>
            <h1 id="hero-title">Get the trip<br />out of the<br /><span>group chat.</span></h1>
            <p className="website-intro">Less back-and-forth. More being there. Bring your people, places, plans, and tickets together—and give that “we should go” somewhere to go.</p>
            <div className="website-actions">
              <Link to="/new" className="website-button website-button-primary">Create a trip <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <Link to="/app#join" className="website-text-link">Join your group</Link>
            </div>
            <p className="website-hero-note">Start in your browser. Take it along on your phone.</p>
          </div>
          <div className="website-hero-art">
            <img className="website-hero-photo" src="/images/lakeside-escape.jpg" alt="A wooden boat heading across a still lake toward the mountains" width="1800" height="1200" fetchPriority="high" />
            <m.div className="website-travel-stamp" initial={false} animate={reduced ? undefined : { clipPath: ['inset(0 50% 0 50%)', 'inset(0 0% 0 0%)'] }} transition={{ duration: .8, ease: [.16, 1, .3, 1] }}><span>Good company.</span><strong>Great trips.</strong></m.div>
            <div className="website-photo-note"><img src="/brand/stowaway-mark.svg" width="40" height="40" alt="" /><span>The whole trip,<br />tucked away.</span></div>
            <span className="website-photo-caption">Make room for the unplanned.</span>
          </div>
          <a className="website-explore" href="#the-plan">A little organization. A lot of possibility. <ArrowDown size={16} aria-hidden="true" /></a>
        </section>

        <div className="website-capabilities">
          <ul className="website-container" aria-label="Trip essentials">
            <li><Vote size={20} aria-hidden="true" /> Everyone gets a say</li>
            <li><CalendarDays size={20} aria-hidden="true" /> One plan, all together</li>
            <li><Ticket size={20} aria-hidden="true" /> Tickets within reach</li>
            <li><Receipt size={20} aria-hidden="true" /> Shared costs, kept clear</li>
          </ul>
        </div>

        <section id="the-plan" className="website-product website-container" aria-labelledby="product-title">
          <Reveal className="website-product-copy"><p className="website-eyebrow">THE PLAN / ALL IN ONE PLACE</p><h2 id="product-title">A place for<br />every <em>“what if?”</em></h2><p>That coffee spot. The walk with the view. The dinner everyone finally agreed on. Keep the ideas and the details together, so your group can get on with the good part.</p><p className="website-preview-instruction">Take a look around. Switch days to explore the plan.</p><a href="#how-it-works" className="website-text-link">See how it comes together <ArrowDown size={16} aria-hidden="true" /></a></Reveal>
          <div><TripPreview /></div>
        </section>

        <section className="website-manifesto" aria-labelledby="manifesto-title"><div className="website-container"><p className="website-eyebrow">FOR THE TRIPS YOU KEEP TALKING ABOUT</p><Reveal><h2 id="manifesto-title">Less “who’s booking?”<br /><span>More “we’re going.”</span></h2></Reveal><p>Bring a little order to the adventure.<br />Leave plenty of room for the unexpected.</p></div></section>

        <section id="how-it-works" className="website-how website-container" aria-labelledby="how-title">
          <div className="website-section-heading"><p className="website-eyebrow">FROM IDEA TO OUT THE DOOR</p><h2 id="how-title">Good trips<br />start <em>together.</em></h2></div>
          <ol className="website-steps">
            <li><span className="website-step-number">01</span><div><h3>Give the idea a place to land.</h3><p>Create a trip and share the invite link. Pick a destination now, or figure it out with your people.</p></div></li>
            <li><span className="website-step-number">02</span><div><h3>Find the group’s kind of good.</h3><p>Save places, compare ideas, and start a vote. Everyone gets a say; the favorites become the plan.</p></div></li>
            <li><span className="website-step-number">03</span><div><h3>Keep the details tucked away.</h3><p>Bring the tickets, follow the itinerary, and split the shared costs. Download your essentials before you leave.</p></div></li>
          </ol>
          <Reveal className="website-example-strip"><StepExamples /></Reveal>
        </section>

        <section className="website-offline" aria-labelledby="offline-title">
          <div className="website-container website-offline-inner">
            <div className="website-offline-art"><span className="website-offline-label">YOUR POCKET TRAVEL COMPANION</span><img src="/brand/packed-for-anywhere.svg" alt="" width="360" height="170" /><span className="website-offline-caption">Big adventure. Small carry-on.</span></div>
            <div><p className="website-eyebrow">READY WHEN YOU ARE</p><h2 id="offline-title">Less signal.<br />Still <em>sorted.</em></h2><p>Add Stowaway to your Home Screen and download your trip’s essentials before you leave. Saved plans and downloaded tickets stay close, even when the signal doesn’t. Maps need a downloaded pack or saved area.</p><Link to="/app" className="website-text-link">Find your trips <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
          </div>
        </section>

        <section id="questions" className="website-questions website-container" aria-labelledby="questions-title">
          <div className="website-section-heading"><p className="website-eyebrow">BEFORE YOU GO</p><h2 id="questions-title">A few<br /><em>good questions.</em></h2></div>
          <div className="website-faq">
            <details><summary>Do I need to download an app?</summary><p>You can create and plan a trip right in your browser. For easy access on the go, add Stowaway to your phone’s Home Screen from your browser’s share or install menu.</p></details>
            <details><summary>How does my group join?</summary><p>Create a trip, then share its invite link from Trip settings & sharing. Friends open the link and choose who they are in the group. Already have an invite? <Link to="/app#join">Join your trip here.</Link></p></details>
            <details><summary>Can I use it without a connection?</summary><p>Yes, after preparing your trip while online. Use “Ready for offline” in your trip settings to save essentials to your phone. Downloaded tickets and saved trip data work without signal; maps need a downloaded map pack or saved area. Creating or joining a trip needs a connection.</p></details>
            <details><summary>Can I get my trips on another phone?</summary><p>Use your group’s invite link to rejoin on another device. When Google sign-in is available, you can also sign in from the app to restore the trips connected to your account.</p></details>
          </div>
        </section>

        <section className="website-closing" aria-labelledby="closing-title"><div className="website-container"><p className="website-eyebrow">YOU BRING THE PEOPLE. WE’LL KEEP THE PLAN.</p><h2 id="closing-title">Someday.<br /><span>Make it a date.</span></h2><Link to="/new" className="website-button website-button-primary">Start planning <ArrowUpRight size={20} aria-hidden="true" /></Link></div></section>
      </main>

      <footer className="website-footer website-container"><Link to="/" aria-label="Stowaway home"><WebsiteLogo /></Link><p>The whole trip, tucked away.</p><nav aria-label="Footer navigation"><a href="#how-it-works">How it works</a><a href="#questions">Questions</a><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/app">Open app</Link></nav></footer>
    </div>
  )
}
