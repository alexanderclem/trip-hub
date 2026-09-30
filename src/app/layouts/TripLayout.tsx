import { NavLink, Outlet } from 'react-router'
import { CalendarDays, Map, MoreHorizontal, Ticket, Wallet } from 'lucide-react'

const tabs = [
  { to: 'map', label: 'Map', Icon: Map },
  { to: 'plan', label: 'Plan', Icon: CalendarDays },
  { to: 'tickets', label: 'Tickets', Icon: Ticket },
  { to: 'money', label: 'Money', Icon: Wallet },
  { to: 'more', label: 'More', Icon: MoreHorizontal },
]

export function TripLayout() {
  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <nav className="pb-safe grid grid-cols-5 border-t border-stone-200 bg-white">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs ${
                isActive ? 'text-brand-700' : 'text-stone-500'
              }`
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
