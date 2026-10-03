import { ensureSession, supabase } from '@/lib/supabase'
import { newId } from '@/lib/ids'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import { save } from '@/data/repo'
import type { TripArea } from '@/features/destinations/destinations'
import { pull } from '@/data/sync/engine'
import { supabaseRemote } from '@/data/sync/remote'

export const MEMBER_COLORS = [
  '#0d9488', '#2563eb', '#db2777', '#ea580c', '#7c3aed',
  '#16a34a', '#dc2626', '#0891b2', '#ca8a04', '#4f46e5',
]

/** Pulls the latest copy of a trip into IndexedDB. Throws if it can't reach the server. */
async function initialPull(tripId: string) {
  const r = await pull(supabaseRemote, tripId)
  if (r.error) throw new Error(`Could not download the trip: ${r.error.message}`)
}

export interface NewTrip {
  name: string
  timezone: string
  startDate: string | null
  endDate: string | null
  baseCurrency: string
  localCurrency: string | null
  yourName: string
  /** Towns chosen while creating the trip; stored in trips.settings.areas. */
  areas?: TripArea[]
}

export async function createTrip(t: NewTrip): Promise<string> {
  await ensureSession()
  const tripId = newId()
  const memberId = newId()
  const { error } = await supabase.rpc('create_trip', {
    p_trip_id: tripId,
    p_name: t.name.trim(),
    p_timezone: t.timezone,
    p_start_date: t.startDate,
    p_end_date: t.endDate,
    p_base_currency: t.baseCurrency,
    p_local_currency: t.localCurrency ?? '',
    p_member_id: memberId,
    p_member_name: t.yourName.trim(),
    p_member_color: MEMBER_COLORS[0],
  })
  if (error) throw new Error(error.message)
  useDevice.getState().rememberTrip(tripId, memberId)
  await initialPull(tripId)
  if (t.areas?.length) {
    const trip = await db.trips.get(tripId)
    if (trip) await save('trips', { ...trip, settings: { ...trip.settings, areas: t.areas } }, memberId)
  }
  return tripId
}

/** Extracts the share token from a pasted trip link (or a bare token). */
export function parseShareToken(input: string): string | null {
  const s = input.trim()
  const m = s.match(/[#&?]t=([A-Za-z0-9_-]{16,})/)
  if (m) return m[1]!
  return /^[A-Za-z0-9_-]{16,}$/.test(s) ? s : null
}

export function shareLink(token: string): string {
  return `${location.origin}/join#t=${token}`
}

/**
 * Joins a trip with its share token. Returns the trip id and, if this device was already
 * someone on the trip (e.g. re-joining after reinstalling), that member id.
 */
export async function joinTrip(token: string): Promise<{ tripId: string; memberId: string | null }> {
  const userId = await ensureSession()
  const { data, error } = await supabase.rpc('join_trip', { p_token: token })
  if (error) throw new Error(error.message)
  const tripId = data as string
  const { data: device } = await supabase
    .from('trip_devices')
    .select('member_id')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle()
  const memberId = (device?.member_id as string | null) ?? null
  useDevice.getState().rememberTrip(tripId, memberId)
  await initialPull(tripId)
  return { tripId, memberId }
}

export async function claimMember(tripId: string, memberId: string) {
  await ensureSession()
  const { error } = await supabase.rpc('claim_member', { p_trip_id: tripId, p_member_id: memberId })
  if (error) throw new Error(error.message)
  useDevice.getState().setMember(tripId, memberId)
}

export async function createMemberAndClaim(tripId: string, name: string, color: string) {
  await ensureSession()
  const memberId = newId()
  const { error } = await supabase.rpc('create_member_and_claim', {
    p_trip_id: tripId,
    p_member_id: memberId,
    p_name: name.trim(),
    p_color: color,
  })
  if (error) throw new Error(error.message)
  useDevice.getState().setMember(tripId, memberId)
  await initialPull(tripId)
}

export async function rotateShareToken(tripId: string): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_share_token', { p_trip_id: tripId })
  if (error) throw new Error(error.message)
  await initialPull(tripId)
  return data as string
}
