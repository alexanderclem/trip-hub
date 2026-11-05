import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, CircleDashed, Download, Loader2, XCircle } from 'lucide-react'
import { DateTime } from 'luxon'
import { useMyMemberId } from '@/data/device'
import type { Trip } from '@/data/types'
import { syncNowChecked } from '@/data/sync/controller'
import { Button, Card, Disclosure } from '@/ui'
import { useMoney } from '@/features/money/data'
import { fetchRates } from '@/lib/fx'
import { stableId } from '@/lib/ids'
import { save } from '@/data/repo'
import { tripAreas } from '@/features/destinations/destinations'
import { useOfflinePack } from '@/features/map/offline/packs'
import { getSavedMap, saveAreaMap, useSavedMap } from '@/features/map/offline/savedArea'
import { downloadFile, requestPersistence, storageStatus } from '@/features/map/offline/packStore'
import { isIOS, isStandalone } from '@/features/map/offline/OfflineMapCard'
import { attachmentsOnPhone, downloadMissing, useAttachments } from '@/features/tickets/files'
import { refreshWeather } from '@/features/itinerary/weather'
import { db } from '@/data/db'

type StepState = 'todo' | 'running' | 'done' | 'skipped' | 'failed'
interface Step {
  id: string
  label: string
  state: StepState
  detail?: string
}

const readyKey = (tripId: string) => `trip-hub:offline-ready:${tripId}`

/**
 * The "master download": one button that puts everything needed for a trip on this phone, so it
 * works in airplane mode — data, every ticket file, the offline map, exchange rates, the app itself.
 */
export function OfflineReadyCard({ trip, compact = false }: { trip: Trip; compact?: boolean }) {
  const me = useMyMemberId(trip.id)
  const tickets = useAttachments(trip.id)
  const [pack, refreshPack] = useOfflinePack(trip)
  const [savedMap, refreshMap] = useSavedMap(trip.id)
  const money = useMoney(trip.id)
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [running, setRunning] = useState(false)
  const locked = useRef(false)
  const [lastReady, setLastReady] = useState<string | null>(() => {
    try {
      return localStorage.getItem(readyKey(trip.id))
    } catch {
      return null
    }
  })
  const [persisted, setPersisted] = useState<boolean | null>(null)
  useEffect(() => {
    void storageStatus().then((s) => setPersisted(s.persisted))
  }, [running])

  const missingTickets = tickets?.filter((t) => !t.onPhone).length ?? 0
  const mapMissing = pack.status !== 'ready' && !(savedMap && JSON.stringify(savedMap.areas) === JSON.stringify(tripAreas(trip)))
  const appSaved = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller
  const problems = (steps ?? []).filter((step) => step.state === 'failed' || (step.state === 'skipped' && step.id === 'map'))
  const ready = !!lastReady && tickets !== undefined && missingTickets === 0 && !mapMissing && appSaved && !problems.length

  async function run() {
    if (locked.current) return
    locked.current = true
    setLastReady(null)
    try { localStorage.removeItem(readyKey(trip.id)) } catch { /* Storage can be unavailable. */ }
    const plan: Step[] = [
      { id: 'data', label: 'Trip data', state: 'todo' },
      { id: 'tickets', label: 'Tickets and documents', state: 'todo' },
      { id: 'map', label: 'Offline map', state: 'todo' },
      { id: 'fx', label: 'Exchange rates', state: 'todo' },
      { id: 'weather', label: 'Weather for each day', state: 'todo' },
      { id: 'app', label: 'The app itself', state: 'todo' },
      { id: 'persist', label: 'Protect from clean-up', state: 'todo' },
    ]
    const update = (id: string, patch: Partial<Step>) => setSteps((s) => (s ?? plan).map((x) => (x.id === id ? { ...x, ...patch } : x)))
    setSteps(plan)
    setRunning(true)
    let ok = true
    const step = async (id: string, fn: () => Promise<Partial<Step> | void>) => {
      update(id, { state: 'running' })
      try {
        const result = (await fn()) ?? {}
        if (result.state === 'skipped' && id === 'map') ok = false
        update(id, { state: 'done', ...result })
      } catch (e) {
        ok = false
        update(id, { state: 'failed', detail: e instanceof Error ? e.message : String(e) })
      }
    }

    await step('data', async () => {
      if (!navigator.onLine) throw new Error("You're offline. Connect to Wi-Fi first.")
      await syncNowChecked(trip.id)
    })
    await step('tickets', async () => {
      const r = await downloadMissing(trip.id, (d, t) => update('tickets', { detail: t ? `${d} of ${t}` : undefined }))
      if (r.failed) throw new Error(`${r.failed} couldn't be downloaded`)
      const pending = (await attachmentsOnPhone(trip.id)).filter((ticket) => !ticket.onPhone).length
      if (pending) throw new Error(`${pending} still being uploaded by someone else's phone`)
    })
    await step('map', async () => {
      if (pack.status === 'none') {
        // No ready-made pack: save the map around the trip's destinations instead.
        const areas = tripAreas(trip)
        if (!areas.length) return { state: 'skipped', detail: 'Add a destination in Trip settings to get an offline map' }
        const have = await getSavedMap(trip.id)
        if (have && JSON.stringify(have.areas) === JSON.stringify(areas)) return { detail: 'Already on this phone' }
        await saveAreaMap(trip.id, areas, (d, t) => update('map', { detail: `${d} of ${t} pieces` }))
        refreshMap()
        return { detail: undefined }
      }
      if (pack.status === 'ready') return { detail: 'Already on this phone' }
      const total = pack.pack.overview.bytes + pack.pack.detail.bytes
      const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`
      await downloadFile(pack.pack.overview, (n) => update('map', { detail: `${mb(n)} of ${mb(total)}` }))
      await downloadFile(pack.pack.detail, (n) => update('map', { detail: `${mb(pack.pack.overview.bytes + n)} of ${mb(total)}` }))
      refreshPack()
    })
    await step('fx', async () => {
      const fresh = money?.snapshot && Date.now() - Date.parse(money.snapshot.fetched_at) < 24 * 3600_000
      if (fresh) return { detail: `From ${money!.snapshot!.as_of}` }
      const t = await fetchRates()
      await save('fx_snapshots', { id: stableId(trip.id, 'fx', 'USD', t.as_of), trip_id: trip.id, base: 'USD', rates: t.rates, as_of: t.as_of, fetched_at: new Date().toISOString(), source: 'open.er-api.com' }, me)
      return { detail: `From ${t.as_of}` }
    })
    await step('weather', async () => {
      await refreshWeather(trip)
      return (await db.weather.where('trip_id').equals(trip.id).count()) ? {} : { state: 'skipped', detail: 'Add dates and a destination to get weather' }
    })
    await step('app', async () => {
      if (!('serviceWorker' in navigator)) throw new Error('This browser can’t save apps for offline use')
      if (!navigator.serviceWorker.controller) throw new Error('Close and reopen Stowaway once while online, then try again')
    })
    await step('persist', async () => {
      const granted = await requestPersistence()
      return granted ? {} : { state: 'skipped', detail: isIOS() && !isStandalone() ? 'Add Stowaway to your Home Screen first' : 'The browser decides; usually fine once installed' }
    })

    setRunning(false)
    locked.current = false
    if (ok) {
      const now = new Date().toISOString()
      setLastReady(now)
      try {
        localStorage.setItem(readyKey(trip.id), now)
      } catch {
        // storage unavailable; status just won't persist across launches
      }
    }
  }

  if (compact) {
    const active = steps?.find((step) => step.state === 'running')
    const done = steps?.filter((step) => step.state === 'done' || step.state === 'skipped').length ?? 0
    return <section aria-label="Offline access" className="offline-summary rounded-surface border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="flex min-w-0 items-center gap-2 text-sm">
          {running ? <Loader2 aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" /> : ready ? <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-ink" /> : <Download aria-hidden="true" className="size-4 shrink-0" />}
          <span>{running ? `Saving for offline · ${done} of ${steps?.length ?? 7}` : problems.length ? 'Offline download incomplete' : ready ? 'Ready for offline' : missingTickets ? `${missingTickets} ticket${missingTickets === 1 ? '' : 's'} to download` : 'Save for offline'}</span>
        </p>
        {!running && <Button variant="secondary" className="px-3 text-sm" onClick={run}>{problems.length ? 'Retry' : ready ? 'Check again' : 'Download all'}</Button>}
      </div>
      {active && <p className="mt-2 text-sm text-muted">{active.label}{active.detail ? ` · ${active.detail}` : ''}</p>}
      {problems.length > 0 && <ul aria-label="Download problems" className="mt-3 space-y-2 text-sm text-danger-ink">{problems.map((step) => <li key={step.id}>{step.label}: {step.detail}</li>)}</ul>}
      {steps && <Disclosure summary="Download details" className="mt-2"><ul className="space-y-2 text-sm">{steps.map((step) => <li key={step.id}><span className="font-medium">{step.label}</span> · {step.state === 'done' ? 'Saved' : step.state === 'failed' ? 'Failed' : step.state === 'skipped' ? 'Skipped' : step.state === 'running' ? 'Saving…' : 'Waiting'}{step.detail && <span className="block text-muted">{step.detail}</span>}</li>)}</ul></Disclosure>}
      {isIOS() && !isStandalone() && !ready && <p className="mt-2 text-sm text-muted">For offline use, add Stowaway to your Home Screen and open it there.</p>}
    </section>
  }

  return (
    <Card>
      <h2 className="ui-section-title">Ready for offline</h2>
      <p className="mt-1 text-sm text-muted">Saves trip data, tickets, the offline map, exchange rates and weather to this phone.</p>
      {isIOS() && !isStandalone() && (
        <p className="mt-3 rounded-surface bg-warning p-3 text-sm text-warning-ink">
          First add Stowaway to your Home Screen (Share → Add to Home Screen) and open it from there. Safari can clear offline data for websites, and the Home Screen app keeps its own copy.
        </p>
      )}
      {steps && (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {steps.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              {s.state === 'done' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-ink" />
                : s.state === 'running' ? <Loader2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 motion-safe:animate-spin text-action" />
                : s.state === 'failed' ? <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger-ink" />
                : <CircleDashed aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />}
              <span>
                {s.label}
                {s.detail && <span className="block text-xs text-muted">{s.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!running && (
        <Button className="mt-3 w-full" onClick={run}>
          <Download aria-hidden="true" className="size-4" /> {lastReady ? 'Check again and download anything new' : 'Download everything for offline'}
        </Button>
      )}
      <p className="mt-3 text-xs text-muted">
        {ready ? `Ready for offline · checked ${DateTime.fromISO(lastReady!).toRelative()}` : lastReady ? `Last checked ${DateTime.fromISO(lastReady).toRelative()}` : 'Not checked yet'}
        {persisted != null && ` · storage ${persisted ? 'protected' : 'not protected yet'}`}
      </p>
      <p className="mt-1 text-xs text-danger-ink">Deleting Stowaway from your Home Screen deletes everything saved offline.</p>
    </Card>
  )
}
