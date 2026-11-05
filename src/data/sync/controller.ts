import type { RealtimeChannel } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { db } from '../db'
import { pull, push, resetBackoff, SYNCED_TABLES } from './engine'
import { supabaseRemote } from './remote'
import { publishReminders } from '@/features/notifications/reminders'
import { fetchAccess, needsRefetch } from '../access'
import { useDevice } from '../device'
import type { TableName } from '../types'
import { dropTrip } from '../reset'
import { flushEvents, sendToSupabase } from '@/features/funnel/events'

export type SyncPhase = 'idle' | 'syncing' | 'refreshing' | 'offline' | 'error'

interface SyncStatus {
  tripId: string | null
  phase: SyncPhase
  lastSyncedAt: string | null
  lastError: string | null
}

export const useSyncStatus = create<SyncStatus>(() => ({
  tripId: null,
  phase: 'idle',
  lastSyncedAt: null,
  lastError: null,
}))

const PULL_EVERY_MS = 60_000
const PUSH_RETRY_MS = 30_000
const POKE_DEBOUNCE_MS = 500

let running: Promise<void> | null = null
// null means a full reconciliation; a set holds realtime table hints. Full requests always win.
const requested = new Map<string, Set<TableName> | null>()
/** How each trip's latest cycle ended. `cycle` never throws, so this is the only record of failure. */
const outcomes = new Map<string, { ok: boolean; error: string | null }>()
let activeTripId: string | null = null

function setStatus(tripId: string, status: Partial<SyncStatus>) {
  if (activeTripId === null || activeTripId === tripId) useSyncStatus.setState({ ...status, tripId })
}

/** Runs one push+pull cycle. Calls made while a cycle is running coalesce into one more. */
export function syncNow(tripId: string, tables?: TableName[]): Promise<void> {
  const pending = requested.get(tripId)
  requested.set(tripId, !tables || pending === null ? null : new Set([...(pending ?? []), ...tables]))
  if (running) return running
  running = (async () => {
    while (requested.size) {
      const [next, changed] = requested.entries().next().value!
      requested.delete(next)
      await cycle(next, changed === null ? undefined : SYNCED_TABLES.filter((table) => changed.has(table)))
    }
  })().finally(() => {
    running = null
  })
  return running
}

/** A deliberate retry bypasses backoff, while retaining rejected changes for review. */
export async function retrySync(tripId: string) {
  await resetBackoff()
  return syncNow(tripId)
}

/**
 * Like `syncNow`, but rejects unless this trip's changes were sent and its data pulled fresh.
 * For callers that report success to people ("Ready for offline"); `syncNow` itself never rejects.
 */
export async function syncNowChecked(tripId: string): Promise<void> {
  outcomes.delete(tripId)
  await syncNow(tripId)
  const outcome = outcomes.get(tripId)
  if (!outcome?.ok) throw new Error(outcome?.error ?? 'Could not refresh the trip. Try again.')
}

async function cycle(tripId: string, tables?: TableName[]) {
  const fail = (error: string) => outcomes.set(tripId, { ok: false, error })
  try {
  if (!navigator.onLine) {
    setStatus(tripId, { phase: 'offline', lastError: null })
    fail("You're offline. Connect to Wi-Fi first.")
    return
  }
  setStatus(tripId, { phase: 'syncing', lastError: null })
  const pushed = await push(supabaseRemote)
  setStatus(tripId, { phase: 'refreshing' })
  const access = await checkAccess(tripId)
  if (access === 'removed') {
    setStatus(tripId, { phase: 'idle', lastError: null })
    fail('You no longer have access to this trip.')
    return
  }
  const pulled = await pull(supabaseRemote, tripId, db, access === 'refetch' ? undefined : tables)
  if (pulled.error) {
    setStatus(tripId, {
      phase: navigator.onLine ? 'error' : 'offline',
      lastError: pulled.error.message,
    })
    fail(`Couldn't download the latest trip data: ${pulled.error.message}`)
  } else if (pushed.retryLater) {
    const head = await db._outbox.orderBy('seq').first()
    setStatus(tripId, { phase: 'error', lastError: head?.lastError ?? 'Some changes are waiting to sync' })
    fail(`Changes from this phone haven't been shared yet: ${head?.lastError ?? 'they are waiting to sync'}`)
  } else if (await db._deadletter.filter((entry) => !entry.resolvedAt && (entry.rowId === tripId || entry.payload.trip_id === tripId)).count() > 0) {
    const error = 'Some saved changes need review. Open sync details before preparing for offline.'
    setStatus(tripId, { phase: 'error', lastError: error })
    fail(error)
  } else {
    setStatus(tripId, { phase: 'idle', lastSyncedAt: new Date().toISOString(), lastError: null })
    outcomes.set(tripId, { ok: true, error: null })
    // With fresh plans and travel times, refresh this phone's leave-by reminders (push on only).
    void publishReminders(tripId).catch((e) => console.warn('leave-by reminders failed', e))
    void flushEvents(sendToSupabase).catch((e) => console.warn('sending funnel events failed', e))
  }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not finish syncing. Try again.'
    setStatus(tripId, { phase: navigator.onLine ? 'error' : 'offline', lastError: message })
    fail(message)
  }
}

/**
 * Re-reads what this phone may do on the trip. If its person was removed, the trip's data leaves
 * the phone. If its role or the trip's mode changed, the local copy is dropped so the pull that
 * follows brings back only what the phone may now see. Waits while changes are still queued, so
 * nothing typed on this phone is thrown away.
 */
async function checkAccess(tripId: string): Promise<'ok' | 'removed' | 'refetch'> {
  const access = await fetchAccess(tripId)
  if (access === 'unknown') return 'ok'
  const device = useDevice.getState()
  const before = device.access[tripId]
  if (access.removed) {
    device.setAccess(tripId, access)
    await dropTrip(tripId)
    return 'removed'
  }
  // No role and not removed: the server forgot this phone; "Who are you?" re-joins it (actions.ts).
  if (!access.role) return 'ok'
  if (needsRefetch(before, access)) {
    const waiting = await db._outbox.filter((e) => e.rowId === tripId || e.payload.trip_id === tripId).count()
    if (waiting > 0) return 'ok' // try again on the next cycle, after these are pushed
    await dropTrip(tripId)
    device.setAccess(tripId, access)
    return 'refetch'
  }
  device.setAccess(tripId, access)
  return 'ok'
}

/** Starts background sync for a trip. Returns a function that stops it. */
export function startSync(tripId: string): () => void {
  activeTripId = tripId
  useSyncStatus.setState({ tripId, phase: navigator.onLine ? 'syncing' : 'offline', lastSyncedAt: null, lastError: null })
  let pokeTimer: ReturnType<typeof setTimeout> | undefined
  const changed = new Set<TableName>()
  let fullPull = false
  const poke = (table?: TableName) => {
    if (table) changed.add(table)
    else fullPull = true
    clearTimeout(pokeTimer)
    pokeTimer = setTimeout(() => {
      const tables = fullPull ? undefined : [...changed]
      changed.clear()
      fullPull = false
      void syncNow(tripId, tables)
    }, POKE_DEBOUNCE_MS)
  }

  const onOnline = () => {
    void resetBackoff().then(() => syncNow(tripId))
  }
  const onOffline = () => setStatus(tripId, { phase: 'offline', lastError: null })
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow(tripId)
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)

  const pullTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow(tripId)
  }, PULL_EVERY_MS)
  const pushTimer = setInterval(async () => {
    if ((await db._outbox.count()) > 0) void syncNow(tripId)
  }, PUSH_RETRY_MS)

  // Local saves trigger a push right away.
  const outboxWatch = () => poke()
  db._outbox.hook('creating', outboxWatch)
  db._outbox.hook('updating', outboxWatch)

  // Realtime is only a "something changed" signal; the data always comes via pull().
  const channel: RealtimeChannel = supabase.channel(`trip:${tripId}`)
  for (const table of SYNCED_TABLES) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: table === 'trips' ? `id=eq.${tripId}` : `trip_id=eq.${tripId}` },
      () => poke(table),
    )
  }
  // The socket must carry this device's JWT before joining, or RLS silently filters every event.
  void supabase.realtime.setAuth().then(() => channel.subscribe())

  void syncNow(tripId)

  return () => {
    if (activeTripId === tripId) activeTripId = null
    clearTimeout(pokeTimer)
    clearInterval(pullTimer)
    clearInterval(pushTimer)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisible)
    db._outbox.hook('creating').unsubscribe(outboxWatch)
    db._outbox.hook('updating').unsubscribe(outboxWatch)
    void supabase.removeChannel(channel)
  }
}
