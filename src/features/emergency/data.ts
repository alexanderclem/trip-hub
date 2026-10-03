import { useLiveQuery } from 'dexie-react-hooks'
import { DateTime } from 'luxon'
import { db, type TripDb } from '@/data/db'
import { save } from '@/data/repo'
import type { ItineraryItem, MemberSafety, Place, SyncColumns, Trip } from '@/data/types'
import { layoutDay } from '@/features/itinerary/layout'
import { stableId } from '@/lib/ids'

export const safetyId = (tripId: string, memberId: string) => stableId(tripId, 'safety', memberId)

export type SafetyFields = Omit<MemberSafety, keyof SyncColumns | 'trip_id' | 'member_id'>

export const SAFETY_LIMITS: Record<keyof SafetyFields, number> = {
  emergency_name: 120, emergency_relation: 60, emergency_phone: 40, allergies: 500, medical: 1000, blood_type: 10,
  insurance_provider: 120, insurance_policy: 80, insurance_phone: 40, notes: 1000,
}

export const EMPTY_SAFETY: SafetyFields = Object.fromEntries(Object.keys(SAFETY_LIMITS).map((k) => [k, null])) as unknown as SafetyFields

export function useSafety(tripId: string) {
  return useLiveQuery(() => db.member_safety.where('trip_id').equals(tripId).toArray(), [tripId])
}

/** Saves my own emergency card. Empty fields are stored as null (cards are never deleted). */
export async function saveMySafety(tripId: string, memberId: string | null, fields: SafetyFields, database: TripDb = db) {
  if (!memberId) throw new Error('Choose who you are in this trip first.')
  const clean = {} as SafetyFields
  for (const key of Object.keys(SAFETY_LIMITS) as (keyof SafetyFields)[]) {
    const v = fields[key]?.trim() || null
    if (v && v.length > SAFETY_LIMITS[key]) throw new Error(`Keep this under ${SAFETY_LIMITS[key]} characters.`)
    clean[key] = v
  }
  for (const key of ['emergency_phone', 'insurance_phone'] as const) {
    if (clean[key] && !/^[+\d][\d\s().-]{2,}$/.test(clean[key]!)) throw new Error('Phone numbers can only use digits, spaces, + ( ) - and .')
  }
  const id = safetyId(tripId, memberId)
  const existing = await database.member_safety.get(id)
  await save('member_safety', { ...existing, id, trip_id: tripId, member_id: memberId, ...clean }, memberId, database)
}

// ── Trip-wide numbers, kept in trips.settings.emergency ───────────────────────────────────────

export interface Contact {
  name: string
  phone: string | null
  address: string | null
}

export interface TripEmergency {
  numbers: { label: string; phone: string }[]
  embassy: Contact | null
  hospital: Contact | null
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const contact = (v: unknown): Contact | null => {
  if (!v || typeof v !== 'object') return null
  const c = v as Record<string, unknown>
  const name = str(c.name)
  return name ? { name, phone: str(c.phone), address: str(c.address) } : null
}

export function tripEmergency(trip: Pick<Trip, 'settings'> | undefined): TripEmergency {
  const raw = (trip?.settings?.emergency ?? {}) as Record<string, unknown>
  const numbers = Array.isArray(raw.numbers)
    ? raw.numbers.flatMap((n) => {
      const label = str((n as Record<string, unknown>)?.label)
      const phone = str((n as Record<string, unknown>)?.phone)
      return label && phone ? [{ label, phone }] : []
    })
    : []
  return { numbers, embassy: contact(raw.embassy), hospital: contact(raw.hospital) }
}

export async function saveTripEmergency(trip: Trip, info: TripEmergency, me: string | null, database: TripDb = db) {
  const clean: TripEmergency = {
    numbers: info.numbers.map((n) => ({ label: n.label.trim(), phone: n.phone.trim() })).filter((n) => n.label && n.phone),
    embassy: info.embassy?.name.trim() ? info.embassy : null,
    hospital: info.hospital?.name.trim() ? info.hospital : null,
  }
  const current = await database.trips.get(trip.id)
  if (!current) throw new Error('This trip is not on this phone.')
  await save('trips', { ...current, settings: { ...current.settings, emergency: clean } }, me, database)
}

// ── Where we sleep tonight, for "Show the driver" ─────────────────────────────────────────────

export interface Stay {
  item: ItineraryItem
  place: Place | null
  tonight: boolean
}

/** Tonight's lodging if there is one, else the next upcoming stay. */
export function stayFor(items: ItineraryItem[], places: Place[], zone: string, now: number): Stay | null {
  const today = DateTime.fromMillis(now, { zone }).toISODate()!
  const placeOf = (i: ItineraryItem) => places.find((p) => p.id === i.place_id && !p.deleted_at) ?? null
  const tonight = layoutDay(items, today, zone).stays[0]
  if (tonight) return { item: tonight, place: placeOf(tonight), tonight: true }
  const next = items
    .filter((i) => !i.deleted_at && i.kind === 'lodging' && i.status !== 'cancelled' && Date.parse(i.start_at) > now)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))[0]
  return next ? { item: next, place: placeOf(next), tonight: false } : null
}
