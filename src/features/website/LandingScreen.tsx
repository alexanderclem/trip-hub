import type { ReactNode } from 'react'
import { ArrowDown, ArrowUpRight, CalendarDays, Receipt, Ticket, Vote } from 'lucide-react'
import { m } from 'motion/react'
import { Link, Navigate } from 'react-router'
import { Brand } from '@/ui/Brand'
import { useMotionPreference } from '@/ui/MotionProvider'
import { TripPreview } from './TripPreview'
import './website.css'

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduced = useMotionPreference()
  return <m.div className={className} initial={false} whileInView={reduced ? undefined : { y: [16, 0], opacity: [.8, 1] }} viewport={{ once: true, amount: .15 }} transition={{ duration: .45, ease: [.16, 1, .3, 1] }}>{children}</m.div>
}

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
            <Link to="/app" className="website-button website-button-outline">Open app <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </nav>
        </header>
      </div>

      <main id="main-content" tabIndex={-1}>
        <section className="website-hero website-container" aria-labelledby="hero-title">
          <div className="website-hero-copy">
            <p className="website-eyebrow"><span className="website-rule" /> FOR THE TRIP YOU KEEP TALKING ABOUT</p>
            <h1 id="hero-title">Get the trip<br />out of the<br /><span>group chat.</span></h1>
            <p className="website-intro">Pick places together, turn favorites into a shared itinerary, and keep tickets and expenses in one place. Download your essentials before you go.</p>
            <div className="website-actions">
              <Link to="/new" className="website-button website-button-primary">Create a trip <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <Link to="/app#join" className="website-button website-button-outline">Join a trip</Link>
            </div>
            <a className="website-text-link website-example-link" href="#the-plan">Explore an example <ArrowDown size={16} aria-hidden="true" /></a>
            <p className="website-hero-note">Free to use. Start in your browser. No password to remember.</p>
          </div>
          <div id="the-plan" className="website-hero-example">
            <TripPreview />
          </div>
        </section>

        <div className="website-capabilities">
          <ul className="website-container" aria-label="Trip essentials">
            <li><Vote size={20} aria-hidden="true" /> Decide together</li>
            <li><CalendarDays size={20} aria-hidden="true" /> Follow one plan</li>
            <li><Ticket size={20} aria-hidden="true" /> Find your tickets</li>
            <li><Receipt size={20} aria-hidden="true" /> Split shared costs</li>
          </ul>
        </div>

        <section id="how-it-works" className="website-how website-container" aria-labelledby="how-title">
          <Reveal className="website-section-heading"><p className="website-eyebrow">LESS BACK-AND-FORTH. MORE BEING THERE.</p><h2 id="how-title">From “we should”<br />to <em>“see you there.”</em></h2><p className="website-section-intro">One shared place to move from the first suggestion to the details everyone needs.</p></Reveal>
          <ol className="website-steps">
            <li><span className="website-step-number">01</span><div><h3>Create a trip. Bring your people.</h3><p>Start with a name and share the invite link. Your friends choose who they are—no passwords, no long setup.</p></div></li>
            <li><span className="website-step-number">02</span><div><h3>Save ideas. Pick the favorites.</h3><p>Keep the places your group suggests and put decisions to a vote. Turn the winner into a stop on the plan.</p></div></li>
            <li><span className="website-step-number">03</span><div><h3>Know what’s next—and who paid.</h3><p>Follow the day’s itinerary, open the right ticket, and track shared expenses without another spreadsheet.</p></div></li>
          </ol>
        </section>

        <section className="website-offline" aria-labelledby="offline-title">
          <div className="website-container website-offline-inner">
            <div className="website-offline-art">
              <img className="website-hero-photo" src="/images/lakeside-escape.jpg" alt="A wooden boat heading across a still lake toward the mountains" width="1800" height="1200" loading="lazy" />
              <span className="website-travel-stamp"><span>Good company.</span><strong>Great trips.</strong></span>
            </div>
            <div><p className="website-eyebrow">PREPARE ONLINE. TAKE IT WITH YOU.</p><h2 id="offline-title">Ready before<br />you <em>lose signal.</em></h2><p>Use “Ready for offline” in your trip settings before you leave. Saved plans and downloaded tickets work without a connection. Maps need a downloaded pack or saved area.</p><p>Creating or joining a trip, live updates, and new downloads need a connection. Changes you make offline wait on your device until they can sync.</p><Link to="/app" className="website-text-link">Open your trips <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
          </div>
        </section>

        <section id="questions" className="website-questions website-container" aria-labelledby="questions-title">
          <div className="website-section-heading"><p className="website-eyebrow">THE PRACTICAL DETAILS</p><h2 id="questions-title">Before<br /><em>you go.</em></h2></div>
          <div className="website-faq">
            <details><summary>Do I need to download an app?</summary><p>You can create and plan a trip right in your browser. Add Stowaway to your Home Screen later for one-tap access. Installation is optional.</p></details>
            <details><summary>How does my group join?</summary><p>Create a trip and share its invite link. Friends open it and choose who they are in the group. Already have an invite? <Link to="/app#join">Join your trip here.</Link></p></details>
            <details><summary>Who can see our trip?</summary><p>Anyone with the secret invite link can join and access the group’s shared plans and documents. Share it only with people you trust. See our <Link to="/privacy">privacy policy</Link> for details.</p></details>
            <details><summary>Can I use it without a connection?</summary><p>Yes, after preparing your trip while online. Use “Ready for offline” in your trip settings to save essentials to your phone. Downloaded tickets and saved trip data work without signal; maps need a downloaded map pack or saved area. Creating or joining a trip needs a connection.</p></details>
            <details><summary>What if I get another phone?</summary><p>Keep your invite link so you can rejoin on another device and choose your name. When Google sign-in is available, you can also restore trips connected to your account. Downloads must be saved on each phone.</p></details>
          </div>
        </section>

        <section className="website-closing" aria-labelledby="closing-title"><div className="website-container"><p className="website-eyebrow">GOOD COMPANY. GREAT TRIPS.</p><h2 id="closing-title">Make the<br /><span>trip happen.</span></h2><div className="website-closing-actions"><Link to="/new" className="website-button website-button-primary">Create your trip <ArrowUpRight size={20} aria-hidden="true" /></Link><Link to="/app#join" className="website-text-link">Join a trip <ArrowUpRight size={18} aria-hidden="true" /></Link></div></div></section>
      </main>

      <footer className="website-footer website-container"><Link to="/" aria-label="Stowaway home"><WebsiteLogo /></Link><p>The whole trip, tucked away.</p><nav aria-label="Footer navigation"><a href="#how-it-works">How it works</a><a href="#questions">Questions</a><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/app">Open app</Link></nav></footer>
    </div>
  )
}
