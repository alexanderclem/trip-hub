import { Link, useLocation } from 'react-router'
import { ArrowRight, Plus } from 'lucide-react'
import { useDevice } from '@/data/device'
import { Brand } from '@/ui/Brand'
import { AccountCard } from '@/features/account/AccountCard'
import { HomeScreen } from '@/features/trips/HomeScreen'
import { JoinByLink } from '@/features/trips/JoinByLink'
import { InstallAppButton } from '@/features/install/InstallAppDialog'
import { LinkButton } from '@/ui'

/** Keep explicit join requests direct, even on a phone that already has other trips. */
export function StartScreen() {
  const firstVisit = useDevice((s) => Object.keys(s.trips).length === 0)
  const { hash } = useLocation()
  return firstVisit || hash === '#join' ? <WelcomeScreen /> : <HomeScreen />
}

/** App entry is a task, not another marketing page. The quiz and installation are optional. */
export function WelcomeScreen() {
  const joining = useLocation().hash === '#join'
  return (
    <main className="app-entry app-entry-compact">
      <header className="app-entry-header"><Link to="/" aria-label="Stowaway home"><Brand /></Link><Link to="/app" className="ui-link">Your trips</Link></header>
      <div className="app-entry-intro">
        <p className="app-kicker">The shared trip planner</p>
        <h1 className="travel-heading">{joining ? 'Join your friends.' : 'Your next trip starts here.'}</h1>
        <p>{joining ? 'Paste your invite link, then choose your name. No password needed.' : 'Create a shared plan or join your friends. You can work out the details together.'}</p>
      </div>
      <div className={`app-entry-routes ${joining ? 'is-joining' : ''}`}>
        <section className="app-start-trip" aria-labelledby="start-trip-title">
          <img src="/brand/stowaway-mark.svg" alt="" width="40" height="40" />
          <h2 id="start-trip-title" className="travel-heading">Bringing the group?</h2>
          <p>All you need is a trip name and your name. Invite everyone once you’re in.</p>
          <LinkButton to="/new" className="mt-5 w-full"><Plus aria-hidden="true" className="size-4" />Create a trip</LinkButton>
        </section>
        <div id="join" className="scroll-mt-6"><JoinByLink /></div>
      </div>
      <div className="app-entry-extras"><AccountCard /><Link to="/inspire" className="ui-link">Need ideas? Help me plan <ArrowRight aria-hidden="true" className="size-4" /></Link></div>
      <footer className="app-entry-footer"><Link to="/">Back to Stowaway</Link><InstallAppButton /></footer>
    </main>
  )
}
