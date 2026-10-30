import { coverPhoto } from './covers'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, CalendarDays, Compass, MapPin, Plus, Users } from 'lucide-react'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import type { Member, Trip } from '@/data/types'
import { dateRange } from '@/lib/time'
import { Avatar, Card, Disclosure, LinkButton } from '@/ui'
import { Brand } from '@/ui/Brand'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle, Skeleton } from '@/ui/collection'
import { AccountCard } from '@/features/account/AccountCard'
import { JoinByLink } from './JoinByLink'
import { InstallAppButton } from '@/features/install/InstallAppDialog'
import { tripAreas } from '@/features/destinations/destinations'
import { useNow } from '@/lib/useNow'
import { tripCover, tripStatus } from './presentation'
import { TripArtwork } from './TripArtwork'

function TripCard({ trip, members, now }: { trip: Trip; members: Member[]; now: number }) {
  const dates = dateRange(trip.start_date, trip.end_date)
  const status = tripStatus(trip, now)
  const destinations = tripAreas(trip).map((area) => area.name).join(' · ')
  const cover = tripCover(trip)
  return (
    <Link to={`/t/${trip.id}`} className="saved-trip-card group block">
      {cover !== 'none' && <div className="saved-trip-art"><TripArtwork cover={cover} photo={coverPhoto(trip)} /></div>}
      <div className="saved-trip-body">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`trip-phase trip-phase-${status.phase}`}>{status.phase === 'traveling' && <span aria-hidden="true" className="trip-phase-dot" />}{status.label}</span>
          <span className="saved-trip-arrow"><ArrowRight aria-hidden="true" className="size-5" /></span>
        </div>
        <h3 className="mt-4 wrap-anywhere">{trip.name}</h3>
        <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>{dates || 'Dates to be decided'}</span></p>
        <p className="mt-1 flex items-start gap-2 text-sm leading-relaxed text-muted"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="wrap-anywhere">{destinations || 'Destination to be decided'}</span></p>
        <div className="saved-trip-foot">
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
            <span aria-hidden="true" className="traveler-stack">{members.slice(0, 3).map((member) => <Avatar key={member.id} name={member.display_name} color={member.color ?? '#295361'} photo={member.avatar_url} size="sm" />)}</span>
            {!members.length && <Users aria-hidden="true" className="size-4" />}
            <span>{members.length} {members.length === 1 ? 'traveler' : 'travelers'}<span className="sr-only">{members.length ? `: ${members.map((member) => member.display_name).join(', ')}` : ''}</span></span>
          </span>
          <span className="text-sm font-semibold text-action">Open trip</span>
        </div>
      </div>
    </Link>
  )
}

export function HomeScreen() {
  const joined = useDevice((s) => s.trips)
  const now = useNow()
  const data = useLiveQuery(async () => {
    const ids = Object.keys(joined)
    const [trips, members] = await Promise.all([db.trips.bulkGet(ids), db.members.toArray()])
    const byTrip = new Map<string, Member[]>()
    for (const member of members) {
      if (!member.deleted_at && joined[member.trip_id]) {
        const group = byTrip.get(member.trip_id) ?? []
        group.push(member); byTrip.set(member.trip_id, group)
      }
    }
    return { trips: trips.filter((trip): trip is Trip => !!trip && !trip.deleted_at), byTrip }
  }, [joined])
  const visibleTrips = data?.trips ?? []
  const upcoming = visibleTrips.filter((trip) => tripStatus(trip, now).phase !== 'complete')
    .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.name.localeCompare(b.name))
  const past = visibleTrips.filter((trip) => tripStatus(trip, now).phase === 'complete')
    .sort((a, b) => (b.end_date ?? b.start_date ?? '').localeCompare(a.end_date ?? a.start_date ?? ''))

  return (
    <main className="app-home mx-auto max-w-7xl px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-8 sm:pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-5">
        <Link to="/" aria-label="Stowaway home"><Brand /></Link>
      </header>
      <div className="mb-8 mt-8 flex flex-wrap items-end justify-between gap-5 sm:mt-12">
        <div>
          <p className="app-kicker mb-2">A little closer to going.</p>
          <h1 className="travel-heading text-4xl text-ink sm:text-5xl">Your trips.</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">The places you’re going. The people coming along.</p>
        </div>
        <LinkButton to="/new"><Plus aria-hidden="true" className="size-4" />Create a trip</LinkButton>
      </div>

      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="saved-trips" aria-busy={data === undefined} className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="saved-trips" className="text-sm font-semibold text-ink">Coming up</h2>
            {data !== undefined && <span className="text-xs tabular-nums text-muted">{upcoming.length} {upcoming.length === 1 ? 'trip' : 'trips'}</span>}
          </div>
          {data === undefined ? (
            <div role="status">
              <span className="sr-only">Loading your trips…</span>
              <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                {[0, 1].map((key) => <Card key={key}><Skeleton className="h-32 w-full" /><Skeleton className="mt-5 h-6 w-3/4" /><Skeleton className="mt-3 h-4 w-1/2" /><Skeleton className="mt-6 h-5 w-20" /></Card>)}
              </div>
            </div>
          ) : upcoming.length ? (
            <div className="saved-trips-grid">{upcoming.map((trip) => <TripCard key={trip.id} trip={trip} members={data.byTrip.get(trip.id) ?? []} now={now} />)}</div>
          ) : (
            <Empty>
              <img src="/brand/packed-for-anywhere.svg" alt="" width="360" height="170" className="w-64 max-w-full" />
              <EmptyHeader><EmptyTitle>{past.length ? 'Where to next?' : 'No trips yet'}</EmptyTitle><EmptyDescription>{past.length ? 'Your past trips are tucked away below. Start something new when you’re ready.' : 'Create a trip, or join one with an invite link below.'}</EmptyDescription></EmptyHeader>
            </Empty>
          )}
          {!!past.length && <Disclosure summary={<span>Past trips <span className="ml-1 text-muted">· {past.length}</span></span>} className="past-trips mt-8 border-t border-line pt-3"><div className="saved-trips-grid pb-2">{past.map((trip) => <TripCard key={trip.id} trip={trip} members={data?.byTrip.get(trip.id) ?? []} now={now} />)}</div></Disclosure>}
          <p className="mt-5 text-xs leading-relaxed text-muted">Saved on this device. Open a trip to see its sync status.</p>
        </section>

        <div className="space-y-6">
        <Card>
          <Compass aria-hidden="true" className="size-5 text-action" />
          <h2 className="travel-heading mt-3 text-2xl">Need ideas?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">Describe how you like to travel and get trip ideas.</p>
          <Link to="/inspire" className="mt-4 inline-flex min-h-11 items-center gap-2 font-medium text-action">Help me plan <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </Card>
        <div id="join" className="scroll-mt-6"><JoinByLink /></div>
        <AccountCard />
        </div>
      </div>
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-ink/15 pt-5 text-xs text-muted">
        <InstallAppButton />
        <Link to="/connections" className="inline-flex min-h-11 items-center font-medium text-action">Connected apps</Link>
      </footer>
    </main>
  )
}
