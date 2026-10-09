import { useMyMemberId } from '@/data/device'
import { retrySavedProfile } from '@/features/trips/retryProfile'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, CloudOff, CloudUpload, RefreshCw, TriangleAlert } from 'lucide-react'
import { db, type OutboxEntry } from '@/data/db'
import { retrySync, useSyncStatus } from '@/data/sync/controller'
import { useOnline } from '@/lib/useOnline'
import { Button, Card, ErrorNote } from '@/ui'
import { Dialog } from '@/ui/Dialog'

const belongsTo = (entry: { table: string; payload: Record<string, unknown> }, tripId: string) =>
  entry.table === 'trips' ? entry.payload.id === tripId : entry.payload.trip_id === tripId
const nameOf = (entry: { table: string; payload: Record<string, unknown> }) =>
  String(entry.payload.title ?? entry.payload.name ?? entry.payload.description ?? entry.payload.display_name ?? entry.table.replaceAll('_', ' '))

function useSyncDetails(tripId: string) {
  return useLiveQuery(async () => {
    const [pending, rejected] = await Promise.all([db._outbox.orderBy('seq').toArray(), db._deadletter.toArray()])
    return { pending, rejected: rejected.filter((entry) => belongsTo(entry, tripId)) }
  }, [tripId])
}

function syncLabel(online: boolean, phase: string, pending: number, rejected: number) {
  if (!online || phase === 'offline') return 'Offline'
  if (phase === 'syncing') return 'Syncing…'
  if (phase === 'error' || rejected) return 'Needs attention'
  if (pending) return `${pending} waiting to sync`
  return 'Up to date'
}

/** Shared by the shell and settings: queue counts explicitly describe this device. */
export function SyncDetails({ tripId }: { tripId: string }) {
  const me = useMyMemberId(tripId)
  const online = useOnline()
  const sync = useSyncStatus()
  const details = useSyncDetails(tripId)
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = details?.pending ?? []
  const rejected = details?.rejected ?? []
  const label = syncLabel(online, sync.phase, pending.length, rejected.length)
  async function retry() {
    setRetrying(true)
    setError(null)
    try { await retrySync(tripId) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not retry. Please try again.') }
    finally { setRetrying(false) }
  }
  function downloadRejected() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(rejected, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'stowaway-rejected-changes.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="space-y-4">
      <div role="status">
        <p className="font-semibold">{label}</p>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">
          {!online || sync.phase === 'offline' ? 'Saved trip data is available on this device. Waiting changes will retry when the connection returns.' :
            sync.phase === 'error' ? 'Sync could not finish. Waiting changes stay in the local queue while you retry.' :
              pending.length ? 'Your edits are saved on this device. Your group sees them after they sync.' : 'There are no waiting uploads on this device.'}
        </p>
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><dt className="text-stone-600">Waiting on this device</dt><dd className="font-medium tabular-nums">{details ? pending.length : 'Checking…'}</dd></div>
        <div className="flex flex-wrap justify-between gap-2"><dt className="text-stone-600">Trip last synced</dt><dd>{sync.lastSyncedAt && sync.tripId === tripId ? new Date(sync.lastSyncedAt).toLocaleString() : 'Not yet this session'}</dd></div>
      </dl>
      {pending.length > 0 && <details className="rounded-xl border border-stone-200 p-3">
        <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">View waiting changes</summary>
        <ul className="mt-2 max-h-48 space-y-2 overflow-auto text-sm">{pending.map((entry: OutboxEntry) => <li key={entry.seq} className="break-words border-t border-stone-200 pt-2">{nameOf(entry)}<span className="mt-0.5 block text-xs text-stone-600">{belongsTo(entry, tripId) ? 'This trip' : 'Another saved trip'} · {entry.attempts ? `Waiting after ${entry.attempts} ${entry.attempts === 1 ? 'attempt' : 'attempts'}` : 'Saved locally'}</span></li>)}</ul>
      </details>}
      {rejected.length > 0 && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        <p className="font-semibold">{rejected.length} {rejected.length === 1 ? 'change needs' : 'changes need'} review</p>
        <p className="mt-1 leading-relaxed">The server rejected these edits. Their attempted values are kept here; the current trip may show the server’s version. Review the affected item before editing again.</p>
        <ul className="mt-3 max-h-48 space-y-2 overflow-auto">{rejected.map((entry) => <li key={entry.id} className="break-words"><strong>{nameOf(entry)}</strong>{entry.table === 'members' && entry.id != null && (Object.hasOwn(entry.payload, 'avatar_url') || Object.hasOwn(entry.payload, 'venmo_username')) && <Button variant="secondary" className="mt-2 block" disabled={retrying} onClick={async () => {
          setRetrying(true); setError(null)
          try { await retrySavedProfile(entry.id!, tripId, me); if (online) await retrySync(tripId) }
          catch (e) { setError(e instanceof Error ? e.message : 'Could not restore the saved profile. Try again.') }
          finally { setRetrying(false) }
        }}>Retry saved profile</Button>}<details><summary className="min-h-11 cursor-pointer content-center">Rejection details</summary><p className="break-words">{entry.error}</p><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(entry.payload, null, 2)}</pre></details></li>)}</ul>
        <Button variant="secondary" className="mt-3" onClick={downloadRejected}>Save a copy of rejected changes</Button>
      </div>}
      {sync.lastError && sync.phase === 'error' && <details className="text-sm"><summary className="min-h-11 cursor-pointer content-center">Connection details</summary><p className="break-words text-stone-600">{sync.lastError}</p></details>}
      <ErrorNote error={error} />
      <Button variant="secondary" className="w-full" onClick={() => void retry()} disabled={!online || retrying || sync.phase === 'syncing'}><RefreshCw aria-hidden="true" className={`size-4 ${retrying ? 'motion-safe:animate-spin' : ''}`} />{retrying || sync.phase === 'syncing' ? 'Syncing…' : 'Retry sync'}</Button>
      {!online && <p className="text-sm text-stone-600">Reconnect to retry. You can keep working with saved trip data.</p>}
    </div>
  )
}

export function SyncCard({ tripId }: { tripId: string }) {
  return <Card><h2 className="mb-4 text-lg font-semibold">Sync & saved changes</h2><SyncDetails tripId={tripId} /></Card>
}

/**
 * Sync state in a screen header. Quiet when all is well (an icon); it names the state when the
 * phone is offline or something needs attention. `full` always shows the words (the sidebar).
 */
export function SyncStatusButton({ tripId, full = false, className = '' }: { tripId: string; full?: boolean; className?: string }) {
  const [open, setOpen] = useState(false)
  const online = useOnline()
  const sync = useSyncStatus()
  const details = useSyncDetails(tripId)
  const label = syncLabel(online, sync.phase, details?.pending.length ?? 0, details?.rejected.length ?? 0)
  const offline = !online || sync.phase === 'offline'
  const trouble = !offline && (sync.phase === 'error' || !!details?.rejected.length)
  const Icon = offline ? CloudOff : trouble ? TriangleAlert : sync.phase === 'syncing' || details?.pending.length ? CloudUpload : CheckCircle2
  const worded = full || offline || trouble
  return <>
    <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className={`${worded ? `inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-brand-50 ${trouble ? 'bg-red-50 text-red-800' : offline ? 'bg-amber-100 text-amber-900' : 'text-brand-900'}` : 'ui-icon-button text-stone-600'} shrink-0 ${className}`}><Icon aria-hidden="true" className={worded ? 'size-4 shrink-0' : 'size-5'} /><span aria-live="polite" className={worded ? '' : 'sr-only'}>{label}</span><span className="sr-only">. View sync details</span></button>
    <Dialog open={open} onClose={() => setOpen(false)} title="Sync & saved changes"><SyncDetails tripId={tripId} /></Dialog>
  </>
}
