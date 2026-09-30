import { Link, useParams } from 'react-router'
import { ChevronRight, MapPin, Settings, Vote } from 'lucide-react'
import { useTrip } from '@/data/hooks'
import { PageHeader } from '@/ui'

export function MoreScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const items = [
    { to: 'places', label: 'Places', Icon: MapPin, note: null },
    { to: 'vote', label: 'Votes', Icon: Vote, note: 'Coming soon' },
    { to: 'settings', label: 'Trip settings & sharing', Icon: Settings, note: null },
  ]
  return (
    <div>
      <PageHeader title={trip?.name ?? 'More'} back="/" />
      <ul className="mx-auto max-w-md space-y-2 p-4">
        {items.map(({ to, label, Icon, note }) => (
          <li key={to}>
            <Link to={to} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm active:bg-stone-50">
              <Icon className="size-5 text-brand-700" />
              <span className="flex-1 font-medium">{label}</span>
              {note && <span className="text-xs text-stone-400">{note}</span>}
              <ChevronRight className="size-5 text-stone-400" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
