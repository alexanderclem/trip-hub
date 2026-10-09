import { useEffect, useRef } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ChevronLeft, ClipboardCheck, Home, Map, MoreHorizontal, Settings, Ticket, Vote, Wallet } from 'lucide-react'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import { useTrip } from '@/data/hooks'
import { adoptProfile, useMyTripProfile, useSeedMyProfile } from '@/features/onboarding/profile'
import { startSync } from '@/data/sync/controller'
import { useAutoLegs } from '@/features/routing/requestLegs'
import { useAttachmentSync } from '@/features/tickets/files'
import { SyncStatusButton } from '@/features/sync/SyncStatus'
import { useUnseenActivity } from '@/features/activity/data'
import { StowieCompanion } from '@/features/stowie/StowieCompanion'
import { Brand } from '@/ui/Brand'
import { dateRange } from '@/lib/time'
import { LoadingState } from '@/ui/LoadingState'
import { PageTransition } from '@/ui/PageTransition'

const tabs = [
  { to: 'more/vote', label: 'Vote', Icon: Vote },
  { to: 'map', label: 'Map', Icon: Map },
  { to: 'plan', label: 'Plan', Icon: CalendarDays },
  { to: 'tickets', label: 'Tickets', Icon: Ticket },
  { to: 'more', label: 'More', Icon: MoreHorizontal },
]
const tab = (to: string) => tabs.find((t) => t.to === to)!
const desktopTabs = [{ to: 'overview', label: 'Overview', Icon: Home }, tab('more/vote'), tab('map'), { to: 'money', label: 'Money', Icon: Wallet }, tab('tickets'), tab('plan'), tab('more')]

export function TripLayout() {
  const { tripId } = useParams() as { tripId: string }
  const joined = useDevice((s) => s.trips[tripId])
  const memberId = joined?.memberId ?? null
  const needsProfile = useDevice((s) => !s.quizSeen && s.travelProfile === null)
  const savedProfile = useMyTripProfile(tripId, memberId, needsProfile)

  useEffect(() => {
    if (!joined) return
    return startSync(tripId)
  }, [tripId, joined])
  useEffect(() => {
    if (savedProfile) adoptProfile(savedProfile)
  }, [savedProfile])
  useSeedMyProfile(tripId, memberId)
  useAutoLegs(tripId)
  useAttachmentSync(tripId, memberId)

  if (!joined) return <Navigate to="/app" replace />
  if (!memberId) return <Navigate to={`/t/${tripId}/who`} replace />
  // Looking up optional preferences never blocks a saved ticket or trip deep link.
  return <TripShell tripId={tripId} />
}

function TripShell({ tripId }: { tripId: string }) {
  const trip = useTrip(tripId)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const joined = useDevice((s) => s.trips)
  const trips = useLiveQuery(() => db.trips.bulkGet(Object.keys(joined)), [joined])
  const content = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)
  useEffect(() => {
    if (previousPath.current !== pathname) {
      content.current?.scrollTo(0, 0)
      // Route changes restore reading context without stealing focus on initial map load.
      const heading = content.current?.querySelector<HTMLElement>('h1')
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
      previousPath.current = pathname
    }
  }, [pathname])
  const root = `/t/${tripId}`
  const unseen = useUnseenActivity(tripId, joined[tripId]?.memberId ?? null)
  const news = unseen > 0 && <span className="rounded-full bg-brand-700 px-2 py-0.5 text-xs font-semibold text-white"><span aria-hidden="true">{unseen > 9 ? '9+' : unseen}</span><span className="sr-only"> {unseen === 1 ? '1 new update' : `${unseen} new updates`}</span></span>
  return (
    <div className="trip-shell flex h-full min-w-0 flex-col lg:flex-row">
      <a href="#trip-content" className="trip-skip">Skip to trip content</a>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-stone-200 bg-surface p-5 lg:flex" aria-label="Trip workspace">
        <Link to="/app" aria-label="Stowaway — your trips" className="mb-6"><Brand /></Link>
        <label className="text-xs font-semibold text-stone-600" htmlFor="trip-switcher">Your trips</label>
        <select id="trip-switcher" className="ui-field mt-2 min-h-11 w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 font-semibold text-brand-900" value={tripId} onChange={(event) => navigate(`/t/${event.target.value}/overview`)}>
          {!trips?.some((t) => t?.id === tripId) && <option value={tripId}>{trip?.name ?? 'Loading trip…'}</option>}
          {trips?.filter((t) => t && !t.deleted_at).map((t) => <option key={t!.id} value={t!.id}>{t!.name}</option>)}
        </select>
        <p className="mt-2 text-sm text-stone-600">{dateRange(trip?.start_date, trip?.end_date)}</p>
        <nav aria-label="Trip navigation" className="mt-6 space-y-1">
          {desktopTabs.map(({ to, label, Icon }) => <NavLink key={to} end={to === 'more'} to={`${root}/${to}`} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${isActive ? 'bg-brand-100 text-brand-900' : 'text-stone-600 hover:bg-brand-50 hover:text-brand-900'}`}><Icon aria-hidden="true" className="size-5 shrink-0" /><span className="flex-1">{label}</span>{to === 'overview' && news}</NavLink>)}
        </nav>
        <div className="mt-5 border-t border-stone-200 pt-4">
          <Link to={`${root}/more/tasks`} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-stone-600 hover:bg-brand-50"><ClipboardCheck aria-hidden="true" className="size-5" />Shared tasks</Link>
          <Link to={`${root}/more/settings`} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-stone-600 hover:bg-brand-50"><Settings aria-hidden="true" className="size-5" />Trip settings & sharing</Link>
        </div>
        <div className="mt-auto pt-6">
          <SyncStatusButton tripId={tripId} className="w-full justify-start" />
          <Link to="/app" className="mt-2 flex min-h-11 items-center gap-2 px-3 text-sm text-stone-600 hover:text-brand-900"><ChevronLeft aria-hidden="true" className="size-4" />All trips</Link>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 border-b border-stone-200 bg-surface px-4 pt-safe lg:hidden">
          <Link to={`${root}/overview`} className="flex min-w-0 flex-1 items-center gap-2 py-3 text-sm font-semibold text-brand-900"><span className="min-w-0 break-words">{trip?.name ?? 'Your trip'}</span>{news}</Link>
          <SyncStatusButton tripId={tripId} className="my-1 shrink-0" />
        </header>
        <main id="trip-content" tabIndex={-1} ref={content} className="relative min-h-0 min-w-0 flex-1 overflow-y-auto outline-none">
          <PageTransition routeKey={pathname} className="h-full min-w-0"><Outlet /></PageTransition>
        </main>
        <nav aria-label="Trip navigation" className="pb-safe grid shrink-0 grid-cols-5 border-t border-stone-200 bg-surface lg:hidden">
          {tabs.map(({ to, label, Icon }) => <NavLink key={to} end={to === 'more'} to={`${root}/${to}`} className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-xs ${isActive ? 'bg-brand-50 font-semibold text-brand-700' : 'text-stone-600'}`}><Icon className="size-5" aria-hidden="true" />{label}</NavLink>)}
        </nav>
        <StowieCompanion tripId={tripId} />
      </div>
    </div>
  )
}

export function TripRouteLoading() {
  return <LoadingState fullScreen title="Opening Stowaway…" description="Getting the app ready for your next trip." />
}
