import { Link } from 'react-router'
import { ArrowRight, Plus } from 'lucide-react'
import { useDevice } from '@/data/device'
import { Brand } from '@/ui/Brand'
import { AccountCard } from '@/features/account/AccountCard'
import { HomeScreen } from '@/features/trips/HomeScreen'
import { JoinByLink } from '@/features/trips/JoinByLink'
import { LinkButton } from '@/ui'

/** `/app`: enter the app, with the welcome screen until this phone has a trip. */
export function StartScreen() {
  const firstVisit = useDevice((s) => Object.keys(s.trips).length === 0)
  return firstVisit ? <WelcomeScreen /> : <HomeScreen />
}

/** First open: get into a trip (join, create, or sign in to bring yours back). The quiz follows. */
export function WelcomeScreen() {
  return (
    <main className="app-entry">
      <header className="app-entry-header"><Link to="/" aria-label="Stowaway home"><Brand /></Link><span className="app-kicker">The shared trip planner</span></header>
      <div className="app-entry-layout">
        <section className="app-entry-story" aria-labelledby="welcome-title">
          <p className="app-kicker">A place for the whole trip</p>
          <h1 id="welcome-title">Your group trip.<br /><span>All in one place.</span></h1>
          <p>Save places, decide together, and keep your itinerary, tickets, and shared costs in one place.</p>
          <img src="/brand/packed-for-anywhere.svg" alt="" width="360" height="170" />
          <span className="app-entry-caption">The whole trip, tucked away.</span>
        </section>
        <div className="app-entry-actions">
          <section className="app-start-trip" aria-labelledby="start-trip-title">
            <p className="app-kicker">Start a shared plan</p>
            <h2 id="start-trip-title" className="travel-heading">Where to next?</h2>
            <p>Create a trip, then invite your group with a link. You can decide on the destination together.</p>
            <LinkButton to="/new" className="mt-5 w-full"><Plus aria-hidden="true" className="size-4" />Create a trip</LinkButton>
          </section>
          <div id="join" className="scroll-mt-6 space-y-6"><JoinByLink /><AccountCard /></div>
          <Link to="/inspire" className="app-inspire-link">Not sure where to go yet? Help me plan <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </div>
      </div>
      <footer className="app-entry-footer"><span>Plan in your browser. Take it on your phone.</span><Link to="/">Back to Stowaway</Link></footer>
    </main>
  )
}
