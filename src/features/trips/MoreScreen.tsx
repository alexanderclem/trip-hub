import { Link, useParams } from 'react-router'
import { Backpack, ChevronRight, ClipboardCheck, Compass, MapPin, Settings, ShieldPlus, Sparkles, Vote } from 'lucide-react'
import { useTrip } from '@/data/hooks'
import { PageHeader } from '@/ui'
import { Brand } from '@/ui/Brand'
import { isRecapTime } from '@/features/wrapped/stats'

export function MoreScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const items = [
    { to: 'ideas', label: 'Trip ideas & travel preferences', Icon: Compass, note: null },
    { to: 'tasks', label: 'Tasks', Icon: ClipboardCheck, note: null },
    { to: 'packing', label: 'Packing list', Icon: Backpack, note: null },
    { to: 'emergency', label: 'Emergency info', Icon: ShieldPlus, note: null },
    { to: 'places', label: 'Places', Icon: MapPin, note: null },
    { to: 'vote', label: 'Votes', Icon: Vote, note: null },
    { to: 'settings', label: 'Trip settings & sharing', Icon: Settings, note: null },
    { to: `/t/${tripId}/wrapped`, label: 'Trip recap', Icon: Sparkles, note: trip && isRecapTime(trip, Date.now()) ? 'Ready!' : 'Preview' },
  ]
  return (
    <div>
      <PageHeader title={trip?.name ?? 'More'} back="/app" />
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
      <div className="mx-auto max-w-md px-4 py-6 text-center">
        <Link to="/app" aria-label="Stowaway — your trips" className="inline-flex min-h-11"><Brand /></Link>
        <p className="mt-2 text-xs text-stone-500">The whole trip, tucked away.</p>
      </div>
    </div>
  )
}
