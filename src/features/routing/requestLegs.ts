import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { syncNow } from '@/data/sync/controller'
import type { Place, RouteLeg } from '@/data/types'
import { supabase } from '@/lib/supabase'
import { isStale } from './legs'

export interface LegsResult {
  legs: number
  places?: number
  providers: string[]
  warnings: string[]
}

/** Asks the route-legs Edge Function to (re)compute travel times, then pulls them in. */
export async function requestLegs(tripId: string): Promise<LegsResult> {
  const { data, error } = await supabase.functions.invoke('route-legs', { body: { trip_id: tripId } })
  if (error) {
    let detail = error.message
    try {
      detail = (await (error as { context?: Response }).context?.json())?.error ?? detail
    } catch {
      // keep the generic message
    }
    throw new Error(`Couldn't calculate travel times: ${detail}`)
  }
  await syncNow(tripId)
  return data as LegsResult
}

const ROUTABLE = new Set(['shortlist', 'planned', 'booked', 'visited'])
export const isPick = (p: Place) => ROUTABLE.has(p.status) && !p.deleted_at && p.lat != null && p.lng != null

/** True if some pair of the group's places has no up-to-date drive time. */
export function legsMissing(picks: Place[], legs: RouteLeg[]): boolean {
  const have = new Set(
    legs
      .filter((l) => l.mode === 'drive' && !l.deleted_at)
      .map((l) => [l, picks.find((p) => p.id === l.from_place_id), picks.find((p) => p.id === l.to_place_id)] as const)
      .filter(([l, a, b]) => a && b && !isStale(l, a, b))
      .map(([l]) => `${l.from_place_id}>${l.to_place_id}`),
  )
  for (const a of picks) for (const b of picks) {
    if (a.id !== b.id && !have.has(`${a.id}>${b.id}`) && !have.has(`${b.id}>${a.id}`)) return true
  }
  return false
}

const WAIT_MS = 8_000 // let legs another phone just computed arrive first
const RETRY_SAME_SET_MS = 60 * 60_000 // unroutable pairs must not cause a request loop

/**
 * Keeps travel times up to date: when the group's places change and some pair lacks a time,
 * one request is made. Other phones receive the results through sync instead of asking again.
 */
export function useAutoLegs(tripId: string) {
  const state = useLiveQuery(async () => {
    const [places, legs] = await Promise.all([
      db.places.where('trip_id').equals(tripId).toArray(),
      db.route_legs.where('trip_id').equals(tripId).toArray(),
    ])
    const picks = places.filter(isPick)
    const signature = picks.map((p) => `${p.id}:${p.lat}:${p.lng}`).sort().join('|')
    return { missing: picks.length >= 2 && legsMissing(picks, legs), signature }
  }, [tripId])

  useEffect(() => {
    if (!state?.missing || !navigator.onLine) return
    const key = `trip-hub:legs-attempt:${tripId}`
    let last: { signature: string; at: number } | null = null
    try {
      last = JSON.parse(localStorage.getItem(key) ?? 'null')
    } catch {
      // ignore
    }
    if (last?.signature === state.signature && Date.now() - last.at < RETRY_SAME_SET_MS) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ signature: state.signature, at: Date.now() }))
      } catch {
        // ignore
      }
      requestLegs(tripId).catch((e) => console.warn(e))
    }, WAIT_MS)
    return () => clearTimeout(t)
  }, [tripId, state?.missing, state?.signature])
}
