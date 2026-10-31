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
  const startTrip = <section className="app-start-trip" aria-labelledby="start-trip-title">
    <h2 id="start-trip-title" className="travel-heading">Start a trip</h2>
    <p>You only need a trip name and your name. Invite everyone afterward.</p>
    <LinkButton to="/new" variant={joining ? 'secondary' : 'primary'} className="mt-5 w-full"><Plus aria-hidden="true" className="size-4" />Create a trip</LinkButton>
  </section>
  const joinTrip = <div id="join" className="scroll-mt-6"><JoinByLink /></div>
  return (
    <main className="app-entry app-entry-compact">
      <header className="app-entry-header"><Link to="/" aria-label="Stowaway home"><Brand /></Link><Link to="/app" className="ui-link">Your trips</Link></header>
      <div className="app-entry-intro">
        <h1 className="travel-heading">{joining ? 'Join your group' : 'Create or join a trip'}</h1>
      </div>
      <div className={`app-entry-routes ${joining ? 'is-joining' : ''}`}>
        {joining ? <>{joinTrip}{startTrip}</> : <>{startTrip}{joinTrip}</>}
      </div>
      <div className="app-entry-extras"><AccountCard /><Link to="/inspire" className="ui-link">Need ideas? Help me plan <ArrowRight aria-hidden="true" className="size-4" /></Link></div>
      <footer className="app-entry-footer"><Link to="/">Back to Stowaway</Link><InstallAppButton /></footer>
    </main>
  )
}
