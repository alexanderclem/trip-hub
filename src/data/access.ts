// What this phone may do on a trip (supabase/migrations/20261030000001_access_roles.sql).
//
// The server decides; this mirrors its rules so screens can hide what would be refused. The answer
// from my_trip_access() is cached per trip in the device store, so it holds offline. When the
// phone's role or the trip's access epoch changes, everything held for the trip is dropped and
// pulled again: a pull only adds and updates rows, so rows this phone may no longer see would
// otherwise stay on it.

import type { AccessMode, TableName, TripRole } from './types'

export interface TripAccess {
  role: TripRole | null
  mode: AccessMode
  epoch: number
  /** An organizer (or the creator of a trip without one) removed this phone's person. */
  removed: boolean
  /** May remove people: organizers, or the creator of a trip without one. */
  canRemove: boolean
  /** The trip has an organizer (an owner or admin). */
  organized: boolean
  /** Members removed from the trip (only told to people who may remove). */
  removedMembers: string[]
}

/** Every trip from before roles existed, and every trip whose server hasn't answered yet. */
export const GROUP_ACCESS: TripAccess = { role: 'member', mode: 'group', epoch: 0, removed: false, canRemove: false, organized: false, removedMembers: [] }

/**
 * Capabilities, as in private.can(): 'read' and 'participate' (vote, rate, comment, own packing,
 * own documents and money) are what a hosted traveler has; a viewer only reads. 'staff' is an
 * organizer. Everything else ('plan', 'money', 'docs', 'roster') is anyone in a group trip and an
 * organizer in a hosted one.
 */
export type Capability = 'read' | 'participate' | 'plan' | 'money' | 'docs' | 'roster' | 'staff'

export function can(access: TripAccess, cap: Capability): boolean {
  const { role, mode } = access
  if (!role || role === 'pending' || access.removed) return false
  const staff = role === 'owner' || role === 'admin'
  if (cap === 'staff') return staff
  if (mode === 'group' || staff) return true
  if (role === 'traveler') return cap === 'read' || cap === 'participate'
  if (role === 'viewer') return cap === 'read'
  return false
}

export const isStaff = (access: TripAccess) => can(access, 'staff')

/** True when the phone must drop the trip's local copy and pull it again. */
export function needsRefetch(before: TripAccess | undefined, after: TripAccess): boolean {
  if (!before) return false
  return before.role !== after.role || before.epoch !== after.epoch || before.mode !== after.mode
}

export function parseAccess(value: unknown): TripAccess | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  return {
    role: (v.role as TripRole | null) ?? null,
    mode: v.mode === 'hosted' ? 'hosted' : 'group',
    epoch: typeof v.epoch === 'number' ? v.epoch : 0,
    removed: v.removed === true,
    canRemove: v.can_remove === true,
    organized: v.organized === true,
    removedMembers: Array.isArray(v.removed_members) ? (v.removed_members as string[]) : [],
  }
}

/**
 * Asks the server. 'unknown' means it couldn't say: offline, an error, or a server without roles
 * yet (the app can ship before the migration). Never treat 'unknown' as removal.
 */
export async function fetchAccess(tripId: string): Promise<TripAccess | 'unknown'> {
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data, error } = await supabase.rpc('my_trip_access', { p_trip_id: tripId })
    if (error) return 'unknown'
    // No row: this phone never joined (or the server forgot it); the caller re-joins as before.
    return parseAccess(data) ?? { ...GROUP_ACCESS, role: null }
  } catch {
    return 'unknown'
  }
}

/** The error join_trip raises for someone who was removed (supabase migration: errcode TH403). */
export const REMOVED_CODE = 'TH403'

const PLAN_TABLES = new Set<TableName>(['trips', 'places', 'links', 'leg_overrides', 'polls', 'poll_options', 'itinerary_items', 'day_notes'])
const OWN_ROW_TABLES = new Set<TableName>(['poll_votes', 'place_ratings', 'packing_checks'])
const SELF_ONLY_TABLES = new Set<TableName>(['member_preferences', 'member_safety', 'comments'])

const NOT_ORGANIZER = 'Only the trip’s organizers can change this.'
const NOT_YOURS = 'You can only change your own things on this trip.'

/**
 * Why the server would refuse a write, mirroring the policies in 20261030000001_access_roles.sql,
 * or null if it would accept it. Group trips refuse nothing new.
 */
export function writeRefusal(access: TripAccess, table: TableName, row: Record<string, unknown>, me: string | null): string | null {
  if (access.removed) return 'You were removed from this trip.'
  if (access.role === 'pending') return 'The organizer hasn’t let you in yet.'
  if (!access.role || access.mode === 'group' || isStaff(access)) return null
  const mine = (id: unknown) => me !== null && id === me
  const part = can(access, 'participate')
  const involves = (list: unknown) => Array.isArray(list) && list.some((x) => mine((x as { member_id?: unknown })?.member_id))
  if (PLAN_TABLES.has(table)) return NOT_ORGANIZER
  if (table === 'route_legs' || table === 'fx_snapshots') return null // derived caches any phone may fill
  if (!part) return 'You can look at this trip but not change it.'
  if (OWN_ROW_TABLES.has(table) || SELF_ONLY_TABLES.has(table)) return mine(row.member_id) ? null : NOT_YOURS
  switch (table) {
    case 'trip_tasks': return mine(row.assignee_id) ? null : NOT_ORGANIZER // ticking off their own task
    case 'packing_items': return row.kind === 'personal' && mine(row.owner_id) ? null : NOT_ORGANIZER
    case 'members': return mine(row.id) ? null : NOT_ORGANIZER
    case 'expenses': return mine(row.created_by ?? me) || involves(row.payers) || involves(row.split) ? null : NOT_YOURS
    case 'settlements': return mine(row.from_member_id) || mine(row.to_member_id) ? null : NOT_YOURS
    case 'attachments': return mine(row.owner_member_id) && row.visibility !== 'staff' ? null : NOT_YOURS
    default: return null
  }
}
