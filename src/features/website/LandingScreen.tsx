import { ArrowUpRight, Check, MapPin, Receipt, Ticket, Vote } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { TripPreview } from './TripPreview'
import { WebsiteFrame } from './WebsiteFrame'
import { OperatorIntroduction, PricingIntroduction } from './WebsiteSections'
import { ProgressiveImage } from '@/ui/ProgressiveImage'

export function LandingScreen() {
  if (typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true))) {
    return <Navigate to="/app" replace />
  }

  return (
    <WebsiteFrame>
        <section className="website-hero website-container" aria-labelledby="hero-title">
          <div className="website-hero-copy">
            <h1 id="hero-title">Your group trip.<br />All in one place.</h1>
            <p className="website-intro">Save places, vote on favorites, and build an itinerary together. Keep tickets and shared expenses with the plan.</p>
            <div className="website-actions">
              <Link to="/new" className="website-button website-button-primary">Create a trip <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <Link to="/app#join" className="website-text-link">Join a trip</Link>
            </div>
            <p className="website-hero-note">Free. Runs in your browser, no password.</p>
            <Link to="/operators" className="website-operator-signpost">Running trips for others? <span>Meet Stowaway for operators <ArrowUpRight size={14} aria-hidden="true" /></span></Link>
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

        <section id="how-it-works" className="marketing-section website-container" aria-labelledby="together-title"><div className="marketing-section-intro"><p className="website-eyebrow">From “we should go” to “see you there”</p><h2 id="together-title">Give every part of the trip a home.</h2><p className="marketing-body">A restaurant in the group chat. A ticket in someone’s inbox. A spreadsheet only one person updates. Keep the details where your whole group can find them.</p></div><div className="marketing-editorial-columns"><article><h3>Choose what sounds good</h3><p>Save the places you find. Let everyone score the options, then add the group’s favorites to the plan. A vote is a preference, so you stay in charge of what gets booked.</p></article><article><h3>Know the plan for the day</h3><p>Build an itinerary with times, meeting points, travel details, and linked tickets. Give every traveler the same place to check what’s next.</p></article><article><h3>Keep the small things sorted</h3><p>Assign tasks, prepare a packing list, and track who owes what. Shared expenses record balances; they don’t move money between friends.</p></article></div><Link to="/how-it-works" className="website-text-link">Take a closer look</Link></section>

        <section className="website-offline" aria-labelledby="offline-title">
          <div className="website-container website-offline-inner">
            <div className="website-hero-art">
              <ProgressiveImage className="website-hero-photo" src="/images/lakeside-escape.jpg" placeholder="/images/lakeside-escape-placeholder.jpg" alt="The bow of a wooden boat on a mountain lake in the Dolomites" width={1800} height={1200} loading="lazy" />
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

        <OperatorIntroduction />
        <section className="marketing-section website-container" aria-labelledby="who-title"><div className="marketing-section-intro"><p className="website-eyebrow">Different groups. One shared plan.</p><h2 id="who-title">Make room for your kind of trip.</h2></div><div className="marketing-editorial-columns"><article><h3>A few days with friends</h3><p>Compare ideas, share the itinerary, and keep tickets and expenses together. Start free and invite everyone by link.</p></article><article><h3>A retreat with your community</h3><p>Give guests a clear plan while you organize the people and the details. Explore the operator beta before your next departure.</p></article><article><h3>A club or student group</h3><p>Give tasks an owner, let travelers weigh in, and keep meeting points easy to find. Fewer details to repeat in the chat.</p></article></div></section>
        <PricingIntroduction />

        <section id="questions" className="website-questions website-container" aria-labelledby="questions-title">
          <div><h2 id="questions-title">Questions</h2></div>
          <div className="website-faq">
            <details><summary>Do I need to download an app?</summary><p>No. You can create and plan a trip in your browser. You can also add Stowaway to your phone’s Home Screen.</p></details>
            <details><summary>How does my group join?</summary><p>Create a trip and share its invite link from trip settings. Friends open the link and pick their name. Have a link already? <Link to="/app#join">Join your trip.</Link></p></details>
            <details><summary>Who can see our trip?</summary><p>Anyone with the invite link can join and see the group’s plans and documents, so only share it with people you trust. See the <Link to="/privacy">privacy policy</Link> for details.</p></details>
            <details><summary>Can I use it without a connection?</summary><p>Yes, once you’ve prepared the trip while online. “Ready for offline” in trip settings saves trip data and downloads tickets to your phone. Maps need a downloaded pack or saved area. Creating or joining a trip needs a connection.</p></details>
            <details><summary>Can I get my trips on another phone?</summary><p>Rejoin with your group’s invite link, or sign in with the same account to restore its trips. Downloads are saved separately on each phone.</p></details>
            <details><summary>Can I run paid trips with Stowaway?</summary><p>Operator tools are in beta, and payment collection is coming soon. <Link to="/operators">See the operator preview and request early access.</Link> Free group planning is available now.</p></details>
            <details><summary>Where can I get help?</summary><p>Find joining, account, and offline instructions in <Link to="/help">Help & contact</Link>.</p></details>
          </div>
        </section>

        <section className="website-closing" aria-labelledby="closing-title"><div className="website-container website-closing-inner"><div><h2 id="closing-title">Plan your next trip together.</h2></div><Link to="/new" className="website-button website-button-primary">Create a trip <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>
    </WebsiteFrame>
  )
}
