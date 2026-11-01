// Funnel events (docs/FUNNEL.md): anonymous counts of which steps people reach, never names, emails
// or what anyone wrote. Events wait in IndexedDB and go out with the next sync, so they work offline.
// The server also counts trips created and people joining by itself; these are the moments only the
// app can see.

import { db as defaultDb, type TripDb } from '@/data/db'

export type EventKind =
  | 'trip_source'
  | 'invite_shared'
  | 'money_moment_shown'
  | 'money_moment_clicked'
  | 'money_moment_dismissed'
  | 'early_access_requested'

/** At most this many events wait on a phone; the oldest go first. */
export const MAX_QUEUED = 200
const BATCH = 50

/** Records an event for the next sync. Never throws: measuring must not break the app. */
export async function track(kind: EventKind, tripId: string | null, props: Record<string, string | number | boolean> = {}, database: TripDb = defaultDb): Promise<void> {
  try {
    await database.transaction('rw', database._events, async () => {
      await database._events.add({ kind, trip_id: tripId, props, at: Date.now() })
      const extra = (await database._events.count()) - MAX_QUEUED
      if (extra > 0) await database._events.orderBy('seq').limit(extra).delete()
    })
  } catch (e) {
    console.warn('could not record event', e)
  }
}

export type SendEvents = (events: { kind: string; trip_id: string | null; props: Record<string, unknown> }[]) => Promise<{ ok: true } | { ok: false; retry: boolean }>

/**
 * Sends waiting events in batches. A batch the server refuses outright is dropped (it would never be
 * accepted); a network failure, or a server that doesn't have log_events yet, keeps the queue.
 */
export async function flushEvents(send: SendEvents, database: TripDb = defaultDb): Promise<number> {
  let sent = 0
  for (;;) {
    const batch = await database._events.orderBy('seq').limit(BATCH).toArray()
    if (!batch.length) return sent
    const result = await send(batch.map((e) => ({ kind: e.kind, trip_id: e.trip_id, props: { ...e.props, client_at: new Date(e.at).toISOString() } })))
    if (!result.ok && result.retry) return sent
    await database._events.bulkDelete(batch.map((e) => e.seq!))
    if (result.ok) sent += batch.length
  }
}

/** log_events() through Supabase. */
export const sendToSupabase: SendEvents = async (events) => {
  try {
    const { supabase } = await import('@/lib/supabase')
    const { error, status } = await supabase.rpc('log_events', { p_events: events })
    if (!error) return { ok: true }
    // 404: the server doesn't have the funnel migration yet. 5xx/0: try later. Other 4xx: drop.
    const retry = status === 0 || status === 404 || status >= 500 || error.code === 'PGRST202'
    return { ok: false, retry }
  } catch {
    return { ok: false, retry: true }
  }
}

const SOURCE_KEY = 'stowaway-source'

/** Remembers where a visit came from (?ref= or utm_source), for the trip it leads to. */
export function rememberSource(search: string) {
  const params = new URLSearchParams(search)
  const source = (params.get('ref') ?? params.get('utm_source'))?.trim().slice(0, 40)
  if (!source || !/^[\w.-]+$/.test(source)) return
  try { sessionStorage.setItem(SOURCE_KEY, source) } catch { /* private mode */ }
}

/** Sends the remembered source with the trip just created, once. */
export async function trackTripSource(tripId: string) {
  let source: string | null = null
  try { source = sessionStorage.getItem(SOURCE_KEY); sessionStorage.removeItem(SOURCE_KEY) } catch { /* private mode */ }
  await track('trip_source', tripId, { source: source ?? 'direct' })
}
