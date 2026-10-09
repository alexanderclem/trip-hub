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
    <main className="mx-auto max-w-md px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <Link to="/" aria-label="Stowaway home"><Brand /></Link>
      <img src="/brand/packed-for-anywhere.svg" alt="" width="360" height="170" className="mx-auto mt-8 w-64 max-w-full" />
      <p className="ui-label mt-6">Good company. Great trips.</p>
      <h1 className="travel-heading mt-2 text-5xl text-brand-900">Let’s make the trip happen.</h1>
      <p className="mt-4 leading-relaxed text-stone-600">
        Start with an idea and invite your friends, or join the trip they’ve already started. Pick places, decide together, and give yourselves something to look forward to.
      </p>

      <LinkButton to="/new" className="mt-6 w-full">
        <Plus aria-hidden="true" className="size-4" />Create a trip
      </LinkButton>

      <div id="join" className="mt-6 scroll-mt-6 space-y-6">
        <JoinByLink />
        <AccountCard />
      </div>

      <Link to="/inspire" className="mt-6 inline-flex min-h-11 items-center gap-2 font-medium text-brand-700">
        Not sure where to go yet? Help me plan <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </main>
  )
}
