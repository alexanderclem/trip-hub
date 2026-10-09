import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, X } from 'lucide-react'
import { db } from '@/data/db'
import { save } from '@/data/repo'
import type { Trip } from '@/data/types'
import { useOnline } from '@/lib/useOnline'
import { Button, Card, ErrorNote } from '@/ui'
import { DestinationSearch } from './DestinationSearch'
import { loadAreaPlaces, MAX_AREAS, tripAreas, type TripArea } from './destinations'

/** The towns a trip covers, and loading their places from OpenStreetMap into the idea pool. */
export function DestinationsCard({ trip, me }: { trip: Trip; me: string | null }) {
  const areas = tripAreas(trip)
  const online = useOnline()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // How many OpenStreetMap places each area already has on this phone.
  const counts = useLiveQuery(async () => {
    const rows = await db.places.where('trip_id').equals(trip.id).filter((p) => !p.deleted_at && p.source === 'osm').toArray()
    const by = new Map<string, number>()
    for (const p of rows) if (p.area) by.set(p.area, (by.get(p.area) ?? 0) + 1)
    return by
  }, [trip.id])

  const setAreas = (next: TripArea[]) => save('trips', { ...trip, settings: { ...trip.settings, areas: next } }, me)

  async function load() {
    setError(null)
    setMsg(null)
    try {
      const r = await loadAreaPlaces(trip.id, areas, me, (name) => setBusy(`Loading ${name}…`))
      setMsg(`Added ${r.added} places${r.skipped ? `, ${r.skipped} were already there` : ''}. They're in the idea pool: shortlist the ones you like.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load places. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <h2 className="ui-section-title">Destinations</h2>
      <p className="mt-1 text-sm text-stone-600">
        The towns this trip covers. Stowaway can fill the idea pool with their restaurants, stays and sights from OpenStreetMap, and save their map for offline use.
      </p>
      {areas.length > 0 && (
        <ul aria-label="Destinations" className="mt-3 space-y-1">
          {areas.map((a) => (
            <li key={a.name} className="flex min-h-11 items-center gap-2 rounded-xl bg-stone-50 pl-3">
              <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
              <span className="text-xs text-stone-600">{counts?.get(a.name) ? `${counts.get(a.name)} places` : 'no places yet'}</span>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                disabled={!!busy}
                onClick={() => void setAreas(areas.filter((x) => x.name !== a.name))}
                className="flex size-11 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {areas.length < MAX_AREAS ? (
        <div className="mt-3">
          <DestinationSearch
            placeholder={areas.length ? 'Add another town' : 'Search for a town or city'}
            onPick={(d) => {
              if (areas.some((a) => a.name === d.name)) return
              void setAreas([...areas, { name: d.name, bbox: d.bbox, lat: d.lat, lng: d.lng }])
            }}
          />
        </div>
      ) : (
        <p className="mt-3 text-xs text-stone-600">That's the most destinations one trip can have ({MAX_AREAS}).</p>
      )}
      {areas.length > 0 && (
        <Button className="mt-3 w-full" disabled={!!busy || !online} onClick={() => void load()}>
          <Download aria-hidden="true" className="size-4" /> {busy ?? 'Load places for these destinations'}
        </Button>
      )}
      {!online && areas.length > 0 && <p className="mt-2 text-xs text-stone-600">Loading places needs signal.</p>}
      {msg && <p role="status" className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">{msg}</p>}
      <div className="mt-2"><ErrorNote error={error} /></div>
      <p className="mt-3 text-xs text-stone-600">Places © OpenStreetMap contributors.</p>
    </Card>
  )
}
