import type { RealtimeChannel } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { db } from '../db'
import { pull, push, resetBackoff, SYNCED_TABLES } from './engine'
import { supabaseRemote } from './remote'
import { publishReminders } from '@/features/notifications/reminders'

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error'

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
const requested = new Set<string>()
let activeTripId: string | null = null

function setStatus(tripId: string, status: Partial<SyncStatus>) {
  if (activeTripId === null || activeTripId === tripId) useSyncStatus.setState({ ...status, tripId })
}

/** Runs one push+pull cycle. Calls made while a cycle is running coalesce into one more. */
export function syncNow(tripId: string): Promise<void> {
  requested.add(tripId)
  if (running) return running
  running = (async () => {
    while (requested.size) {
      const next = requested.values().next().value!
      requested.delete(next)
      await cycle(next)
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

async function cycle(tripId: string) {
  try {
  if (!navigator.onLine) {
    setStatus(tripId, { phase: 'offline', lastError: null })
    return
  }
  setStatus(tripId, { phase: 'syncing', lastError: null })
  const pushed = await push(supabaseRemote)
  const pulled = await pull(supabaseRemote, tripId)
  if (pulled.error) {
    setStatus(tripId, {
      phase: pulled.error.status === 0 ? 'offline' : 'error',
      lastError: pulled.error.message,
    })
  } else if (pushed.retryLater) {
    const head = await db._outbox.orderBy('seq').first()
    setStatus(tripId, { phase: 'error', lastError: head?.lastError ?? 'Some changes are waiting to sync' })
  } else {
    setStatus(tripId, { phase: 'idle', lastSyncedAt: new Date().toISOString(), lastError: null })
    // With fresh plans and travel times, refresh this phone's leave-by reminders (push on only).
    void publishReminders(tripId).catch((e) => console.warn('leave-by reminders failed', e))
  }
  } catch (error) {
    setStatus(tripId, { phase: navigator.onLine ? 'error' : 'offline', lastError: error instanceof Error ? error.message : 'Could not finish syncing. Try again.' })
  }
}

/** Starts background sync for a trip. Returns a function that stops it. */
export function startSync(tripId: string): () => void {
  activeTripId = tripId
  useSyncStatus.setState({ tripId, phase: navigator.onLine ? 'syncing' : 'offline', lastSyncedAt: null, lastError: null })
  let pokeTimer: ReturnType<typeof setTimeout> | undefined
  const poke = () => {
    clearTimeout(pokeTimer)
    pokeTimer = setTimeout(() => void syncNow(tripId), POKE_DEBOUNCE_MS)
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
      poke,
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
