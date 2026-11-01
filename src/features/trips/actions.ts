import { ensureSession, supabase } from '@/lib/supabase'
import { newId } from '@/lib/ids'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import { fetchAccess, GROUP_ACCESS, REMOVED_CODE } from '@/data/access'
import { save } from '@/data/repo'
import type { TripArea } from '@/features/destinations/destinations'
import { pull } from '@/data/sync/engine'
import { trackTripSource } from '@/features/funnel/events'
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
  void trackTripSource(tripId)
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

/** The invite link. With `to` (for example `vote/<poll id>`), joining lands on that page. */
export function shareLink(token: string, to?: string): string {
  return `${location.origin}/join${to ? `?to=${to}` : ''}#t=${token}`
}

const JOIN_TARGET = /[?&]to=vote\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=$|[&#])/i

/**
 * Where a shared link wants to land inside the trip, as a path under `/t/<trip>/`. Only known
 * shapes are accepted, so a crafted link can't send people anywhere else.
 */
export function parseJoinTarget(input: string): string | null {
  const m = input.match(JOIN_TARGET)
  return m ? `more/vote/${m[1]!.toLowerCase()}` : null
}

/** The `?to=` form of a target from `parseJoinTarget`, for passing it on to the next screen. */
export function joinTargetQuery(target: string | null): string {
  return target ? `?to=${target.replace(/^more\//, '')}` : ''
}

/** A trip already on this phone, with a claimed person, that this invite token belongs to. */
export async function joinedTripForToken(token: string): Promise<string | null> {
  const trip = await db.trips.filter((t) => t.share_token === token && !t.deleted_at).first()
  return trip && useDevice.getState().trips[trip.id]?.memberId ? trip.id : null
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
  // Know the role before the trip opens, so someone waiting for approval goes straight to that page.
  const access = await fetchAccess(tripId)
  if (access !== 'unknown' && access.role) useDevice.getState().setAccess(tripId, access)
  await initialPull(tripId)
  return { tripId, memberId }
}

/**
 * Runs a "Who are you?" RPC. The trip can be on this phone while the server no longer knows the
 * phone (its sign-in was replaced by a fresh one, or by an account), which the server reports as
 * no access. The saved invite token is what grants access, so join again with it and retry once.
 */
async function withTripAccess(tripId: string, call: () => PromiseLike<{ error: { message: string; code?: string } | null }>) {
  let { error } = await call()
  // A person who was removed must not slip back in with the link saved on this phone.
  if (error?.code === '42501' && !useDevice.getState().access[tripId]?.removed) {
    const token = (await db.trips.get(tripId))?.share_token
    if (token) {
      const rejoin = await supabase.rpc('join_trip', { p_token: token })
      if (rejoin.error?.code === REMOVED_CODE) {
        const device = useDevice.getState()
        device.setAccess(tripId, { ...(device.access[tripId] ?? GROUP_ACCESS), role: null, removed: true })
      }
      if (rejoin.error) throw new Error(rejoin.error.message)
      ;({ error } = await call())
    }
  }
  if (error) throw new Error(error.message)
}

export async function claimMember(tripId: string, memberId: string) {
  await ensureSession()
  await withTripAccess(tripId, () => supabase.rpc('claim_member', { p_trip_id: tripId, p_member_id: memberId }))
  useDevice.getState().setMember(tripId, memberId)
}

export async function createMemberAndClaim(tripId: string, name: string, color: string) {
  await ensureSession()
  const memberId = newId()
  await withTripAccess(tripId, () => supabase.rpc('create_member_and_claim', {
    p_trip_id: tripId,
    p_member_id: memberId,
    p_name: name.trim(),
    p_color: color,
  }))
  useDevice.getState().setMember(tripId, memberId)
  await initialPull(tripId)
}

export async function rotateShareToken(tripId: string): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_share_token', { p_trip_id: tripId })
  if (error) throw new Error(error.message)
  await initialPull(tripId)
  return data as string
}

// ─── Organizing: roles and removing people (supabase/migrations/20261030000001_access_roles.sql) ───

async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  await ensureSession()
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(error.message)
  return data
}

/** Removes a person and, by default, replaces the invite link. Returns the new link token, if replaced. */
export async function removeFromTrip(tripId: string, memberId: string, replaceLink = true): Promise<string | null> {
  const token = (await rpc('remove_from_trip', { p_trip_id: tripId, p_member_id: memberId, p_replace_link: replaceLink })) as string | null
  await initialPull(tripId)
  return token
}

export const undoRemove = (tripId: string, memberId: string) => rpc('undo_remove', { p_trip_id: tripId, p_member_id: memberId })

/** The trip's creator, signed in with an account, becomes its organizer. */
export const claimTrip = (tripId: string) => rpc('claim_trip', { p_trip_id: tripId })

/** Saves the organizer profile travelers will see, then claims the trip with it. */
export async function becomeOrganizer(tripId: string, displayName: string, supportEmail: string) {
  await rpc('save_organizer', { p_display_name: displayName, p_support_email: supportEmail })
  await claimTrip(tripId)
}

export const setAccessMode = (tripId: string, mode: 'group' | 'hosted') => rpc('set_access_mode', { p_trip_id: tripId, p_mode: mode })

export const setMemberRole = (tripId: string, memberId: string, role: 'admin' | 'traveler' | 'viewer' | 'pending' | 'member') =>
  rpc('set_member_role', { p_trip_id: tripId, p_member_id: memberId, p_role: role })
