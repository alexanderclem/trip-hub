import { Link } from 'react-router'
import { ArrowRight, Plus } from 'lucide-react'
import { useDevice } from '@/data/device'
import { Brand } from '@/ui/Brand'
import { AccountCard } from '@/features/account/AccountCard'
import { HomeScreen } from '@/features/trips/HomeScreen'
import { JoinByLink } from '@/features/trips/JoinByLink'

/** `/`: the welcome screen until this phone has a trip, then the list of trips. */
export function StartScreen() {
  const firstVisit = useDevice((s) => Object.keys(s.trips).length === 0)
  return firstVisit ? <WelcomeScreen /> : <HomeScreen />
}

/** First open: get into a trip (join, create, or sign in to bring yours back). The quiz follows. */
export function WelcomeScreen() {
  return (
    <main className="mx-auto max-w-md px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <Brand />
      <img src="/brand/packed-for-anywhere.svg" alt="" width="360" height="170" className="mx-auto mt-8 w-64 max-w-full" />
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Good company. Great trips.</p>
      <h1 className="travel-heading mt-2 text-5xl text-brand-900">Plan it together, take it anywhere.</h1>
      <p className="mt-4 leading-relaxed text-stone-600">
        Join your group’s trip or start a new one. Then a quick quiz maps how you like to travel, so the plan has something for everyone.
      </p>

      <Link to="/new" className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-brand-900 active:bg-brand-900">
        <Plus aria-hidden="true" className="size-4" />Create a trip
      </Link>

      <div className="mt-6 space-y-6">
        <JoinByLink />
        <AccountCard />
      </div>

      <Link to="/inspire" className="mt-6 inline-flex min-h-11 items-center gap-2 font-medium text-brand-700">
        Not sure where to go yet? Help me plan <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </main>
  )
}
