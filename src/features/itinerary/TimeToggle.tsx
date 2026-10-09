import { Clock } from 'lucide-react'
import { useDevice } from '@/data/device'
import type { Trip } from '@/data/types'
import { zoneLabel } from '@/lib/time'
import { useDisplayZone } from './data'

const city = (zone: string) => zone.split('/').pop()!.replace(/_/g, ' ')

/** Switch every time in the app between the destination's clock and this phone's clock. */
export function TimeToggle({ trip }: { trip: Trip | undefined }) {
  const setTimeView = useDevice((s) => s.setTimeView)
  const { view, tripZone, phoneZone } = useDisplayZone(trip)
  const now = new Date().toISOString()
  const same = zoneLabel(tripZone, now) === zoneLabel(phoneZone, now)
  const label = (zone: string) => `${city(zone)} · ${zoneLabel(zone, now)}`

  if (same) {
    return (
      <p className="inline-flex min-h-9 items-center gap-1.5 text-xs text-stone-500">
        <Clock aria-hidden="true" className="size-3.5" /> Times in {label(tripZone)} (same as your phone)
      </p>
    )
  }
  return (
    <div role="radiogroup" aria-label="Show times in" className="inline-grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-xs">
      {(
        [
          ['trip', `${city(tripZone)} time`, label(tripZone)],
          ['device', 'My phone', label(phoneZone)],
        ] as const
      ).map(([v, text, title]) => (
        <button
          key={v}
          role="radio"
          aria-checked={view === v}
          title={title}
          onClick={() => setTimeView(v)}
          className={`min-h-9 rounded-lg px-3 ${view === v ? 'bg-white font-medium text-stone-900 shadow-sm' : 'text-stone-600'}`}
        >
          {text}
          <span className="ml-1 text-stone-500">{zoneLabel(v === 'trip' ? tripZone : phoneZone, now)}</span>
        </button>
      ))}
    </div>
  )
}
