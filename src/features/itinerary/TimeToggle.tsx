import { Clock } from 'lucide-react'
import { useDevice } from '@/data/device'
import type { Trip } from '@/data/types'
import { zoneLabel } from '@/lib/time'
import { Segmented } from '@/ui'
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
      <p className="inline-flex min-h-9 items-center gap-1.5 text-xs text-stone-600">
        <Clock aria-hidden="true" className="size-3.5" /> Times in {label(tripZone)} (same as your phone)
      </p>
    )
  }
  return (
    <Segmented
      label="Show times in"
      value={view}
      onChange={setTimeView}
      options={[
        { value: 'trip', title: label(tripZone), label: <>{city(tripZone)} time<span className="ml-1 font-normal text-stone-600">{zoneLabel(tripZone, now)}</span></> },
        { value: 'device', title: label(phoneZone), label: <>My phone<span className="ml-1 font-normal text-stone-600">{zoneLabel(phoneZone, now)}</span></> },
      ]}
    />
  )
}
