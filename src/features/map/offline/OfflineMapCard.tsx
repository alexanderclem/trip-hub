import { useEffect, useState } from 'react'
import { CheckCircle2, Download, Trash2 } from 'lucide-react'
import { useDevice } from '@/data/device'
import type { Trip } from '@/data/types'
import { Button, Card, ErrorNote } from '@/ui'
import { useOfflinePack } from './packs'
import { SavedAreaCard } from './SavedAreaCard'
import { downloadFile, removeStoredFile, requestPersistence, storageStatus, type StorageStatus } from './packStore'

const mb = (b: number) => `${(b / 1_000_000).toFixed(1)} MB`

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

function buildDate(v: string) {
  const d = new Date(`${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function OfflineMapCard({ trip }: { trip: Trip }) {
  const [state, refresh] = useOfflinePack(trip)
  const basemap = useDevice((s) => s.basemap)
  const setBasemap = useDevice((s) => s.setBasemap)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [storage, setStorage] = useState<StorageStatus | null>(null)

  useEffect(() => {
    void storageStatus().then(setStorage)
  }, [state.status])

  // No ready-made pack for this trip: save the map around its destinations instead.
  if (state.status === 'none') return <SavedAreaCard trip={trip} />

  const { pack } = state
  const total = pack.overview.bytes + pack.detail.bytes

  async function download() {
    setError(null)
    setProgress(0)
    try {
      await requestPersistence()
      await downloadFile(pack.overview, (n) => setProgress(n))
      await downloadFile(pack.detail, (n) => setProgress(pack.overview.bytes + n))
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProgress(null)
    }
  }

  return (
    <Card>
      <h2 className="ui-section-title">Offline map</h2>
      <p className="mt-1 text-sm text-stone-600">{pack.label}. Works with no signal at all.</p>

      {isIOS() && !isStandalone() && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          On iPhone, first add Stowaway to your Home Screen (Share → Add to Home Screen) and download from there. Safari
          can wipe offline data for websites that aren't opened for a week.
        </p>
      )}

      {state.status === 'ready' ? (
        <>
          <p className="mt-3 flex items-center gap-2 text-sm text-brand-700">
            <CheckCircle2 className="size-5" /> On this phone · {mb(total)} · map data from {buildDate(pack.version)}
          </p>
          <fieldset className="mt-3">
            <legend className="text-sm font-medium">Which map to show</legend>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 text-sm">
              {(
                [
                  ['auto', 'Auto'],
                  ['online', 'Online'],
                  ['offline', 'Offline'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setBasemap(v)}
                  aria-pressed={basemap === v}
                  className={`rounded-lg py-1.5 ${basemap === v ? 'bg-white font-medium shadow-sm' : 'text-stone-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-stone-600">
              Auto uses the online map (more detail everywhere) and switches to the offline one when you lose signal. Use
              Offline to save roaming data.
            </p>
          </fieldset>
          <Button
            variant="ghost"
            className="mt-2 flex w-full items-center justify-center gap-2 text-sm"
            onClick={async () => {
              await removeStoredFile(pack.overview.name)
              await removeStoredFile(pack.detail.name)
              refresh()
            }}
          >
            <Trash2 className="size-4" /> Remove from this phone
          </Button>
        </>
      ) : (
        <>
          {progress != null ? (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${Math.round((progress / total) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-stone-600">
                {mb(progress)} of {mb(total)}
              </p>
            </div>
          ) : (
            <Button className="mt-3 flex w-full items-center justify-center gap-2" onClick={download}>
              <Download className="size-4" /> Download offline map ({mb(total)})
            </Button>
          )}
        </>
      )}
      <div className="mt-2">
        <ErrorNote error={error} />
      </div>
      {storage && (
        <p className="mt-3 text-xs text-stone-500">
          Storage protected from clean-up: {storage.persisted ? 'yes' : storage.persisted === false ? 'no' : 'unknown'}
          {storage.usage != null && ` · this app uses ${mb(storage.usage)}`}
        </p>
      )}
    </Card>
  )
}
