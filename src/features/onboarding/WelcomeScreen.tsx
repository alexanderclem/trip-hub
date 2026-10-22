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
      <header className="app-entry-header"><Link to="/" aria-label="Stowaway home"><Brand /></Link><span className="app-kicker">THE WHOLE TRIP, TUCKED AWAY.</span></header>
      <div className="app-entry-layout">
        <section className="app-entry-story" aria-labelledby="welcome-title">
          <p className="app-kicker">GOOD COMPANY. GREAT TRIPS.</p>
          <h1 id="welcome-title">Let’s make<br /> the trip<br /> <span>happen.</span></h1>
          <p>Start with an idea. Bring your people. Give that “we should go” a place to become a plan.</p>
          <img src="/brand/packed-for-anywhere.svg" alt="" width="360" height="170" />
          <span className="app-entry-caption">A little organization. A lot of possibility.</span>
        </section>
        <div className="app-entry-actions">
          <section className="app-start-trip" aria-labelledby="start-trip-title">
            <p className="app-kicker">YOUR NEXT ADVENTURE STARTS HERE</p>
            <h2 id="start-trip-title" className="travel-heading">Where to next?</h2>
            <p>Make a home for your plans, invite the group, and work out the good stuff together.</p>
            <LinkButton to="/new" className="mt-5 w-full"><Plus aria-hidden="true" className="size-4" />Create a trip</LinkButton>
          </section>
          <div id="join" className="scroll-mt-6 space-y-6"><JoinByLink /><AccountCard /></div>
          <Link to="/inspire" className="app-inspire-link">Not sure where to go yet? Help me plan <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </div>
      </div>
      <footer className="app-entry-footer"><span>Made for the way you go together.</span><Link to="/">Back to Stowaway</Link></footer>
    </main>
  )
}
