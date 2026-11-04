import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import type { Trip } from '@/data/types'
import { useNow } from '@/lib/useNow'
import { Card, PageHeader } from '@/ui'
import { travelHistory } from './stats'

export function HistoryScreen() {
  const joined = useDevice((s) => s.trips), access = useDevice((s) => s.access), now = useNow()
  const data = useLiveQuery(async () => {
    const ids = Object.keys(joined).filter((id) => !access[id]?.removed && access[id]?.role !== 'pending')
    const [trips, items, places] = await Promise.all([db.trips.bulkGet(ids), db.itinerary_items.where('trip_id').anyOf(ids).toArray(), db.places.where('trip_id').anyOf(ids).toArray()])
    return { trips: trips.filter((t): t is Trip => !!t), items, places }
  }, [joined, access])
  const stats = data ? travelHistory(data.trips, data.items, data.places, Object.fromEntries(Object.entries(joined).map(([id, j]) => [id, j.memberId])), now) : null
  const names = new Intl.DisplayNames(['en'], { type: 'region' })
  return <div className="pb-10"><PageHeader title="Your travel history" back="/app" /><div className="mx-auto max-w-md space-y-4 p-4">
    <p className="text-sm text-muted">From past trips saved on this device where you selected a traveler. Based on your itinerary, including tentative plans; it does not verify completed travel. Works offline.</p>
    {!stats ? <p role="status">Loading saved trips…</p> : !stats.trips ? <p>No past trips to summarize yet. Trips appear here after their end date.</p> : <>
      <Card><dl className="grid grid-cols-2 gap-6">
        {[['Past trips', stats.trips], ['Countries in those trips', stats.countries.length], ['Hotel nights planned', stats.nights], ['Flights planned', stats.flights], ['Scheduled flight time', `${Math.floor(stats.flightMinutes / 60)}h ${stats.flightMinutes % 60}m`], ['Transport distance estimate', `${stats.distanceKm.toLocaleString()} km`]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 wrap-anywhere text-xl font-semibold tabular-nums">{value}</dd></div>)}
      </dl></Card>
      <p className="text-xs text-muted">Nights count once per trip and date. Distance uses straight lines between saved departure and arrival pins, so it understates road routes and excludes journeys without pins.</p>
      {stats.countries.length > 0 && <section><h2 className="font-semibold">Countries in your past trips</h2><ul className="mt-2 divide-y divide-line">{stats.countries.map((code) => <li key={code} className="py-3">{names.of(code) ?? code}</li>)}</ul></section>}
    </>}
  </div></div>
}
