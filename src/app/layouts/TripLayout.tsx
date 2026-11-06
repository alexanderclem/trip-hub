import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate, useNavigationType, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { PlaneLanding, Backpack, CalendarDays, ClipboardCheck, Compass, Home, Lightbulb, Map, MapPin, MoreHorizontal, Settings, ShieldPlus, Sparkles, Ticket, Vote, Wallet } from 'lucide-react'
import { db } from '@/data/db'
import { useDevice, useTripAccess } from '@/data/device'
import { PendingScreen, RemovedScreen } from '@/features/trips/AccessScreens'
import { useTrip } from '@/data/hooks'
import { adoptProfile, useMyTripProfile, useSeedMyProfile } from '@/features/onboarding/profile'
import { startSync } from '@/data/sync/controller'
import { useAutoLegs } from '@/features/routing/requestLegs'
import { useAttachmentSync } from '@/features/tickets/files'
import { SyncStatusButton } from '@/features/sync/SyncStatus'
import { useUnseenActivity } from '@/features/activity/data'
import { StowieCompanion } from '@/features/stowie/StowieCompanion'
import { Brand } from '@/ui/Brand'
import { LoadingState } from '@/ui/LoadingState'
import { PageTransition } from '@/ui/PageTransition'
import { HeaderTools, HeaderTripName } from '@/ui'
import { QuickAdd } from '@/features/trips/QuickAdd'
import { useSlidingHighlight } from '@/ui/effects'
import { CommandMenu } from '@/ui/CommandMenu'
import { TripSwitcher } from './TripSwitcher'

// Keep the phone navigation compact; desktop exposes the full trip workspace.
const tabs = [
  { to: 'overview', label: 'Home', Icon: Home },
  { to: 'plan', label: 'Plan', Icon: CalendarDays },
  { to: 'map', label: 'Map', Icon: Map },
  { to: 'more/vote', label: 'Vote', Icon: Vote },
  { to: 'more', label: 'More', Icon: MoreHorizontal },
] as const

const desktopGroups = [
  { label: 'Your trip', items: [
    ...tabs.slice(0, 4),
    { to: 'tickets', label: 'Tickets', Icon: Ticket },
    { to: 'money', label: 'Shared expenses', Icon: Wallet },
    { to: 'more/places', label: 'Places', Icon: MapPin },
    { to: 'more/explore', label: 'Explore destination', Icon: Compass },
  ] },
  { label: 'Getting ready', items: [
    { to: 'more/arrivals', label: 'Arrivals & departures', Icon: PlaneLanding },
    { to: 'more/tasks', label: 'Tasks', Icon: ClipboardCheck },
    { to: 'more/packing', label: 'Packing list', Icon: Backpack },
    { to: 'more/ideas', label: 'Trip ideas', Icon: Lightbulb },
    { to: 'more/emergency', label: 'Emergency info', Icon: ShieldPlus },
  ] },
  { label: 'This trip', items: [
    { to: 'more/settings', label: 'Settings & sharing', Icon: Settings },
    { to: 'wrapped', label: 'Trip recap', Icon: Sparkles },
  ] },
]

function desktopTabOf(rest: string): string {
  const match = desktopGroups.flatMap((group) => group.items)
    .find(({ to }) => rest === to || rest.startsWith(`${to}/`))
  return match?.to ?? tabOf(rest)
}

/** The tab a path belongs to: tickets, money and everything under More light up More. */
function tabOf(rest: string): (typeof tabs)[number]['to'] {
  if (/^(overview|activity|travelers)(\/|$)/.test(rest)) return 'overview'
  if (/^plan(\/|$)/.test(rest)) return 'plan'
  if (/^map(\/|$)/.test(rest)) return 'map'
  if (/^more\/vote(\/|$)/.test(rest)) return 'more/vote'
  return 'more'
}

export function TripLayout() {
  const { tripId } = useParams() as { tripId: string }
  const joined = useDevice((s) => s.trips[tripId])
  const memberId = joined?.memberId ?? null
  const needsProfile = useDevice((s) => !s.quizSeen && s.travelProfile === null)
  const savedProfile = useMyTripProfile(tripId, memberId, needsProfile)
  const access = useTripAccess(tripId)

  const hasJoined = Boolean(joined)
  useEffect(() => {
    if (!hasJoined) return
    return startSync(tripId)
  }, [tripId, hasJoined])
  useEffect(() => {
    if (savedProfile) adoptProfile(savedProfile)
  }, [savedProfile])
  useSeedMyProfile(tripId, memberId)
  useAutoLegs(tripId)
  useAttachmentSync(tripId, memberId)

  if (!joined) return <Navigate to="/app" replace />
  if (access.removed) return <RemovedScreen tripId={tripId} />
  if (!memberId) return <Navigate to={`/t/${tripId}/who`} replace />
  if (access.role === 'pending') return <PendingScreen tripId={tripId} />
  // Looking up optional preferences never blocks a saved ticket or trip deep link.
  return <TripShell tripId={tripId} />
}

function TripShell({ tripId }: { tripId: string }) {
  const trip = useTrip(tripId)
  const navigate = useNavigate()
  const { pathname, key: locationKey } = useLocation()
  const navigationType = useNavigationType()
  const joined = useDevice((s) => s.trips)
  const trips = useLiveQuery(() => db.trips.bulkGet(Object.keys(joined)), [joined])
  const content = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)
  const scrollPositions = useRef(new globalThis.Map<string, number>())
  useLayoutEffect(() => {
    const scroller = content.current
    if (!scroller) return
    let observer: MutationObserver | undefined
    let focusObserver: MutationObserver | undefined
    let focusDeadline: ReturnType<typeof setTimeout> | undefined
    let resize: ResizeObserver | undefined
    let frame = 0
    if (previousPath.current !== pathname) {
      const saved = navigationType === 'POP' ? scrollPositions.current.get(locationKey) ?? 0 : 0
      // Browser anchoring must not add its own offset while IndexedDB restores this view.
      if (saved > 0) scroller.classList.add('[overflow-anchor:none]')
      const restore = () => {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          scroller.scrollTo(0, saved)
          if (scroller.scrollTop >= saved) { observer?.disconnect(); resize?.disconnect() }
        })
      }
      scroller.scrollTo(0, saved)
      // IndexedDB-backed screens may briefly render a short skeleton. Restore once their
      // real content can hold the saved position, rather than losing it to that first frame.
      if (saved > scroller.scrollTop) {
        observer = new MutationObserver(restore)
        observer.observe(scroller, { childList: true, subtree: true })
        resize = new ResizeObserver(restore)
        resize.observe(scroller)
        if (scroller.firstElementChild) resize.observe(scroller.firstElementChild)
      }
      // A local query may replace its temporary header after the route first commits.
      let focusedHeading: HTMLElement | null = null
      const focusHeading = () => {
        if (document.querySelector('dialog:modal')) return
        const heading = scroller.querySelector<HTMLElement>('h1')
        if (!heading || heading === focusedHeading) return
        const active = document.activeElement
        if (active && scroller.contains(active) && active.matches('input, textarea, select')) return
        heading.tabIndex = -1
        heading.focus({ preventScroll: true })
        if (document.activeElement === heading) focusedHeading = heading
      }
      focusHeading()
      focusObserver = new MutationObserver(focusHeading)
      focusObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] })
      focusDeadline = setTimeout(() => focusObserver?.disconnect(), 10_000)
      previousPath.current = pathname
    } else {
      scrollPositions.current.set(locationKey, scroller.scrollTop)
    }
    const cancelRestore = () => { observer?.disconnect(); focusObserver?.disconnect(); clearTimeout(focusDeadline); resize?.disconnect(); cancelAnimationFrame(frame); scroller.classList.remove('[overflow-anchor:none]') }
    scroller.addEventListener('pointerdown', cancelRestore, { once: true })
    scroller.addEventListener('wheel', cancelRestore, { once: true, passive: true })
    scroller.addEventListener('keydown', cancelRestore, { once: true })
    return () => {
      cancelRestore()
      scroller.removeEventListener('pointerdown', cancelRestore)
      scroller.removeEventListener('wheel', cancelRestore)
      scroller.removeEventListener('keydown', cancelRestore)
    }
  }, [pathname, locationKey, navigationType])
  const root = `/t/${tripId}`
  const rest = pathname.slice(root.length + 1)
  const current = tabOf(rest)
  const tabBar = useSlidingHighlight<HTMLElement>(current, '.trip-tab[aria-current="page"]')
  const desktopCurrent = desktopTabOf(rest)
  const unseen = useUnseenActivity(tripId, joined[tripId]?.memberId ?? null)
  const news = unseen > 0 && <span className="rounded-full bg-action px-2 py-0.5 text-xs font-semibold text-on-action"><span aria-hidden="true">{unseen > 9 ? '9+' : unseen}</span><span className="sr-only"> {unseen === 1 ? '1 new update' : `${unseen} new updates`}</span></span>
  // Shared actions stay in the header, clear of the map, forms, and floating add buttons.
  const tools = useMemo(() => <div className="trip-header-tools"><QuickAdd tripId={tripId} /><StowieCompanion tripId={tripId} /><span className="trip-header-sync lg:hidden"><SyncStatusButton tripId={tripId} /></span></div>, [tripId])
  return (
    <div className="trip-shell flex h-full min-w-0 flex-col lg:flex-row">
      <a href="#trip-content" className="trip-skip">Skip to trip content</a>
      <aside className="hidden min-h-0 w-64 shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-line bg-surface p-5 lg:flex" aria-label="Trip workspace">
        <Link to="/app" aria-label="Stowaway — your trips" className="mb-5 shrink-0"><Brand /></Link>
        <TripSwitcher current={tripId} currentName={trip?.name ?? 'Loading trip…'}
          trips={(trips ?? []).filter((t): t is NonNullable<typeof t> => !!t && !t.deleted_at)}
          onPick={(id) => navigate(`/t/${id}/overview`)} />
        <nav aria-label="Trip navigation" className="mt-5 shrink-0 space-y-4 pb-2">
          {desktopGroups.slice(0, 2).map(({ label: groupLabel, items }) => <div key={groupLabel}>
            <p className="mb-1 px-3 text-xs font-semibold text-muted">{groupLabel}</p>
            <div className="space-y-1 pointer-fine:space-y-0.5">
              {items.map(({ to, label, Icon }) => <Link key={to} to={`${root}/${to}`} aria-current={desktopCurrent === to ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-sm font-medium pointer-fine:min-h-10 ${desktopCurrent === to ? 'bg-mist text-ink' : 'text-muted hover:bg-brand-50 hover:text-ink'}`}><Icon aria-hidden="true" className="size-5 shrink-0" /><span className="flex-1">{label}</span>{to === 'overview' && news}</Link>)}
            </div>
          </div>)}
        </nav>
        <nav aria-label="Trip settings" className="shrink-0 border-t border-line pt-2">
          {desktopGroups[2]!.items.map(({ to, label, Icon }) => <Link key={to} to={`${root}/${to}`} aria-current={desktopCurrent === to ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-sm font-medium pointer-fine:min-h-10 ${desktopCurrent === to ? 'bg-mist text-ink' : 'text-muted hover:bg-brand-50 hover:text-ink'}`}><Icon aria-hidden="true" className="size-5 shrink-0" />{label}</Link>)}
        </nav>
        <div className="mt-auto shrink-0 pt-3">
          <SyncStatusButton tripId={tripId} full className="w-full justify-start" />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main id="trip-content" tabIndex={-1} ref={content} onScroll={(event) => scrollPositions.current.set(locationKey, event.currentTarget.scrollTop)} className="relative min-h-0 min-w-0 flex-1 overflow-y-auto outline-none">
          <HeaderTools value={<><CommandMenu tripId={tripId} />{tools}</>}><HeaderTripName value={trip?.name}><PageTransition routeKey={pathname} className="h-full min-w-0"><Outlet /></PageTransition></HeaderTripName></HeaderTools>
        </main>
        <nav ref={tabBar.ref} aria-label="Trip navigation" className="trip-tabs pb-safe grid shrink-0 grid-cols-5 border-t border-line bg-surface lg:hidden">
          <span className="trip-tab-track" aria-hidden="true"><span className="trip-tab-bar" style={tabBar.style} /></span>
          {tabs.map(({ to, label, Icon }) => <Link key={to} to={`${root}/${to}`} aria-current={current === to ? 'page' : undefined} className="trip-tab"><span className="relative"><Icon className="size-6" aria-hidden="true" />{to === 'overview' && unseen > 0 && <span className="absolute -right-1.5 -top-1 size-2.5 rounded-full border-2 border-surface bg-brand-accent"><span className="sr-only">{unseen === 1 ? '1 new update' : `${unseen} new updates`}</span></span>}</span>{label}</Link>)}
        </nav>
      </div>
    </div>
  )
}

export function TripRouteLoading() {
  return <LoadingState fullScreen title="Opening Stowaway…" />
}
