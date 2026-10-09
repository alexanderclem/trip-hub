import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, CalendarDays, Compass, Plus } from 'lucide-react'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import type { Trip } from '@/data/types'
import { dateRange } from '@/lib/time'
import { Card, LinkButton } from '@/ui'
import { Brand } from '@/ui/Brand'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle, Skeleton } from '@/ui/collection'
import { AccountCard } from '@/features/account/AccountCard'
import { JoinByLink } from './JoinByLink'

function TripCard({ trip }: { trip: Trip }) {
  const dates = dateRange(trip.start_date, trip.end_date)
  return (
    <Link to={`/t/${trip.id}`} className="group block rounded-2xl border border-stone-200 bg-surface p-5 transition-colors hover:border-brand-600 active:bg-brand-50">
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Compass aria-hidden="true" className="size-5" /></span>
        <ArrowRight aria-hidden="true" className="mt-2 size-5 shrink-0 text-stone-500 group-hover:text-brand-700" />
      </div>
      <h3 className="mt-5 break-words text-xl font-semibold tracking-tight group-hover:text-brand-700">{trip.name}</h3>
      <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-stone-600"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{dates}</p>
      <div className="mt-5 border-t border-stone-100 pt-3 text-sm font-medium text-brand-700">Open trip</div>
    </Link>
  )
}

export function HomeScreen() {
  const joined = useDevice((s) => s.trips)
  const trips = useLiveQuery(() => db.trips.bulkGet(Object.keys(joined)), [joined])
  const visibleTrips = trips?.filter((t): t is NonNullable<typeof t> => !!t && !t.deleted_at) ?? []

  return (
    <main className="mx-auto max-w-5xl px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-8 sm:pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-900/15 pb-5">
        <Link to="/" aria-label="Stowaway home"><Brand /></Link>
      </header>
      <div className="mb-8 mt-8 flex flex-wrap items-end justify-between gap-5 sm:mt-12">
        <div>
          <h1 className="travel-heading text-5xl text-brand-900 sm:text-6xl">Your trips, all aboard.</h1>
          <p className="mt-4 max-w-md leading-relaxed text-stone-600">Save the places you can’t wait to visit, get your friends’ votes, and turn the next group idea into a trip.</p>
        </div>
        <LinkButton to="/new"><Plus aria-hidden="true" className="size-4" />Create a trip</LinkButton>
      </div>

      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="saved-trips" aria-busy={trips === undefined}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="saved-trips" className="text-sm font-semibold text-stone-700">Saved on this device</h2>
            {trips !== undefined && <span className="text-xs tabular-nums text-stone-500">{visibleTrips.length} {visibleTrips.length === 1 ? 'trip' : 'trips'}</span>}
          </div>
          {trips === undefined ? (
            <div role="status">
              <span className="sr-only">Loading your trips…</span>
              <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                {[0, 1].map((key) => <Card key={key}><Skeleton className="size-10" /><Skeleton className="mt-5 h-6 w-3/4" /><Skeleton className="mt-3 h-4 w-1/2" /><Skeleton className="mt-6 h-5 w-20" /></Card>)}
              </div>
            </div>
          ) : visibleTrips.length ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">{visibleTrips.map((trip) => <TripCard key={trip.id} trip={trip} />)}</div>
          ) : (
            <Empty>
              <img src="/brand/packed-for-anywhere.svg" alt="" width="360" height="170" className="w-64 max-w-full" />
              <EmptyHeader><EmptyTitle>Got a “we should go” in mind?</EmptyTitle><EmptyDescription>Create a trip, invite your friends, and save the first idea. Already have an invite? Join your group below.</EmptyDescription></EmptyHeader>
            </Empty>
          )}
        </section>

        <div className="space-y-6">
        <Card>
          <Compass aria-hidden="true" className="size-5 text-brand-700" />
          <h2 className="travel-heading mt-3 text-2xl">Find your kind of trip.</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">Discover your travel style, explore ideas, and turn a favorite into your first itinerary.</p>
          <Link to="/inspire" className="mt-4 inline-flex min-h-11 items-center gap-2 font-medium text-brand-700">Help me plan <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </Card>
        <div id="join" className="scroll-mt-6"><JoinByLink /></div>
        <AccountCard />
        </div>
      </div>
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-brand-900/15 pt-5 text-xs text-stone-600">
        <span>Made for the way you go together.</span>
        <Link to="/connections" className="inline-flex min-h-11 items-center font-medium text-brand-700">Connected apps</Link>
      </footer>
    </main>
  )
}
