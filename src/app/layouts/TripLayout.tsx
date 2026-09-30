import { useEffect } from 'react'
import { Navigate, NavLink, Outlet, useParams } from 'react-router'
import { CalendarDays, Map, MoreHorizontal, Ticket, Wallet } from 'lucide-react'
import { useDevice } from '@/data/device'
import { usePendingCount } from '@/data/hooks'
import { startSync, useSyncStatus } from '@/data/sync/controller'

const tabs = [
  { to: 'map', label: 'Map', Icon: Map },
  { to: 'plan', label: 'Plan', Icon: CalendarDays },
  { to: 'tickets', label: 'Tickets', Icon: Ticket },
  { to: 'money', label: 'Money', Icon: Wallet },
  { to: 'more', label: 'More', Icon: MoreHorizontal },
]

export function TripLayout() {
  const { tripId } = useParams() as { tripId: string }
  const joined = useDevice((s) => s.trips[tripId])

  useEffect(() => {
    if (!joined) return
    return startSync(tripId)
  }, [tripId, joined])

  if (!joined) return <Navigate to="/" replace />
  if (!joined.memberId) return <Navigate to={`/t/${tripId}/who`} replace />

  return (
    <div className="flex h-full flex-col">
      <main className="relative min-h-0 flex-1 overflow-y-auto">
        <SyncPill />
        <Outlet />
      </main>
      <nav className="pb-safe grid grid-cols-5 border-t border-stone-200 bg-white">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'text-brand-700' : 'text-stone-500'}`
            }
          >
            <Icon className="size-6" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/** Small status badge: only shown when there's something worth knowing. */
function SyncPill() {
  const phase = useSyncStatus((s) => s.phase)
  const pending = usePendingCount()
  if (phase === 'idle' && pending === 0) return null
  const text =
    phase === 'offline'
      ? `Offline${pending ? ` · ${pending} to sync` : ''}`
      : phase === 'error'
        ? `Sync problem${pending ? ` · ${pending} waiting` : ''}`
        : phase === 'syncing'
          ? 'Syncing…'
          : `${pending} to sync`
  return (
    <div className="pointer-events-none fixed top-[calc(env(safe-area-inset-top)+0.5rem)] right-3 z-30 rounded-full bg-stone-900/80 px-3 py-1 text-xs text-white">
      {text}
    </div>
  )
}
