import { useState } from 'react'
import { CheckCircle2, Download, Trash2 } from 'lucide-react'
import type { Trip } from '@/data/types'
import { tripAreas } from '@/features/destinations/destinations'
import { useOnline } from '@/lib/useOnline'
import { Button, Card, ErrorNote } from '@/ui'
import { requestPersistence } from './packStore'
import { estimateBytes, removeSavedMap, saveAreaMap, useSavedMap } from './savedArea'

const mb = (b: number) => `${(b / 1_000_000).toFixed(1)} MB`
const sameAreas = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Offline map for trips without a ready-made pack: saves the map around the trip's destinations. */
export function SavedAreaCard({ trip }: { trip: Trip }) {
  const areas = tripAreas(trip)
  const online = useOnline()
  const [saved, refresh] = useSavedMap(trip.id)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setError(null)
    setProgress([0, 1])
    try {
      await requestPersistence()
      await saveAreaMap(trip.id, areas, (done, total) => setProgress([done, total]))
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the map. Try again.')
    } finally {
      setProgress(null)
    }
  }

  const stale = !!saved && !sameAreas(saved.areas, areas)
  return (
    <Card>
      <h2 className="ui-section-title">Offline map</h2>
      {areas.length === 0 ? (
        <p className="mt-1 text-sm text-stone-600">Add a destination above, then save its map here to use with no signal.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-stone-600">
            Street-level map of {areas.map((a) => a.name).join(', ')}, plus the wider region. When you lose signal the map switches to it by itself.
          </p>
          {saved && (
            <p className="mt-3 flex items-center gap-2 text-sm text-brand-700">
              <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" /> On this phone · {mb(saved.bytes)} · saved {new Date(saved.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
          {stale && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">The destinations changed since this was saved. Save again to include them.</p>}
          {progress ? (
            <div className="mt-3" role="status">
              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${Math.round((progress[0] / progress[1]) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-stone-600">Saving map: {progress[0]} of {progress[1]} pieces</p>
            </div>
          ) : (!saved || stale) && (
            <Button className="mt-3 w-full" disabled={!online} onClick={() => void download()}>
              <Download aria-hidden="true" className="size-4" /> {saved ? 'Save the map again' : `Save map for offline (about ${mb(estimateBytes(areas))})`}
            </Button>
          )}
          {!online && !saved && <p className="mt-2 text-xs text-stone-600">Saving the map needs signal.</p>}
          {saved && !progress && (
            <Button variant="ghost" className="mt-2 w-full text-sm" onClick={() => void removeSavedMap(trip.id).then(refresh)}>
              <Trash2 aria-hidden="true" className="size-4" /> Remove from this phone
            </Button>
          )}
        </>
      )}
      <div className="mt-2"><ErrorNote error={error} /></div>
    </Card>
  )
}
