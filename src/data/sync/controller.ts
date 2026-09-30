import type { RealtimeChannel } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { db } from '../db'
import { pull, push, resetBackoff, SYNCED_TABLES } from './engine'
import { supabaseRemote } from './remote'

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error'

interface SyncStatus {
  phase: SyncPhase
  lastSyncedAt: string | null
  lastError: string | null
}

export const useSyncStatus = create<SyncStatus>(() => ({
  phase: 'idle',
  lastSyncedAt: null,
  lastError: null,
}))

const PULL_EVERY_MS = 60_000
const PUSH_RETRY_MS = 30_000
const POKE_DEBOUNCE_MS = 500

let running: Promise<void> | null = null
let again = false

/** Runs one push+pull cycle. Calls made while a cycle is running coalesce into one more. */
export function syncNow(tripId: string): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      await cycle(tripId)
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

async function cycle(tripId: string) {
  if (!navigator.onLine) {
    useSyncStatus.setState({ phase: 'offline' })
    return
  }
  useSyncStatus.setState({ phase: 'syncing' })
  const pushed = await push(supabaseRemote)
  const pulled = await pull(supabaseRemote, tripId)
  if (pulled.error) {
    useSyncStatus.setState({
      phase: pulled.error.status === 0 ? 'offline' : 'error',
      lastError: pulled.error.message,
    })
  } else if (pushed.retryLater) {
    const head = await db._outbox.orderBy('seq').first()
    useSyncStatus.setState({ phase: 'error', lastError: head?.lastError ?? 'Some changes are waiting to sync' })
  } else {
    useSyncStatus.setState({ phase: 'idle', lastSyncedAt: new Date().toISOString(), lastError: null })
  }
}

/** Starts background sync for a trip. Returns a function that stops it. */
export function startSync(tripId: string): () => void {
  let pokeTimer: ReturnType<typeof setTimeout> | undefined
  const poke = () => {
    clearTimeout(pokeTimer)
    pokeTimer = setTimeout(() => void syncNow(tripId), POKE_DEBOUNCE_MS)
  }

  const onOnline = () => {
    void resetBackoff().then(() => syncNow(tripId))
  }
  const onOffline = () => useSyncStatus.setState({ phase: 'offline' })
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
  channel.subscribe()

  void syncNow(tripId)

  return () => {
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
