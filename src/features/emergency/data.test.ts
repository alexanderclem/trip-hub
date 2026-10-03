import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TripDb } from '@/data/db'
import type { ItineraryItem, Place } from '@/data/types'
import { toInstant } from '@/lib/time'
import { EMPTY_SAFETY, safetyId, saveMySafety, stayFor, tripEmergency } from './data'

const T = '00000000-0000-4000-8000-0000000000bb'
const GT = 'America/Guatemala'
let db: TripDb
beforeEach(() => { db = new TripDb(`safety-test-${crypto.randomUUID()}`) })
afterEach(async () => { await db.delete() })

describe('my emergency card', () => {
  it('saves one row per person, trims, and stores empty fields as null', async () => {
    await saveMySafety(T, 'ana', { ...EMPTY_SAFETY, emergency_name: ' Mom ', emergency_phone: '+1 (555) 123-4567', allergies: '   ' }, db)
    await saveMySafety(T, 'ana', { ...EMPTY_SAFETY, emergency_name: 'Dad', blood_type: 'O+' }, db)
    const rows = await db.member_safety.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: safetyId(T, 'ana'), member_id: 'ana', emergency_name: 'Dad', emergency_phone: null, allergies: null, blood_type: 'O+', _dirty: 1 })
  })

  it('rejects bad phone numbers, long text and unknown people', async () => {
    await expect(saveMySafety(T, 'ana', { ...EMPTY_SAFETY, emergency_phone: 'call mom' }, db)).rejects.toThrow(/digits/)
    await expect(saveMySafety(T, 'ana', { ...EMPTY_SAFETY, blood_type: 'way too long' }, db)).rejects.toThrow(/under 10/)
    await expect(saveMySafety(T, null, EMPTY_SAFETY, db)).rejects.toThrow(/who you are/)
  })
})

describe('trip emergency numbers', () => {
  it('reads valid entries and ignores anything malformed', () => {
    expect(tripEmergency({ settings: { emergency: { numbers: [{ label: 'Police', phone: '110' }, { label: '', phone: '1' }, 'x'], hospital: { name: 'Hospital Privado', phone: '7832 0000' }, embassy: { phone: 'no name' } } } })).toEqual({
      numbers: [{ label: 'Police', phone: '110' }], hospital: { name: 'Hospital Privado', phone: '7832 0000', address: null }, embassy: null,
    })
    expect(tripEmergency({ settings: {} })).toEqual({ numbers: [], hospital: null, embassy: null })
  })
})

describe('stayFor', () => {
  const lodging = (id: string, from: string, to: string, place: string): ItineraryItem => ({
    id, trip_id: T, title: id, kind: 'lodging', place_id: place, to_place_id: null, all_day: false,
    start_local: from, start_tz: GT, end_local: to, end_tz: GT, start_at: toInstant(from, GT), end_at: toInstant(to, GT),
    status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null,
  })
  const place = (id: string): Place => ({ id, trip_id: T, name: id, category: 'lodging', tags: [], lat: 14.5, lng: -90.7, address: `${id} street`, area: null, status: 'booked', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' })
  const items = [lodging('antigua', '2027-03-13T15:00', '2027-03-16T11:00', 'casa'), lodging('lake', '2027-03-16T15:00', '2027-03-19T11:00', 'posada')]
  const places = [place('casa'), place('posada')]

  it('finds tonight’s stay, including the evening you check in', () => {
    expect(stayFor(items, places, GT, Date.parse('2027-03-14T20:00:00Z'))).toMatchObject({ tonight: true, place: { id: 'casa' } })
    expect(stayFor(items, places, GT, Date.parse('2027-03-16T23:00:00Z'))).toMatchObject({ tonight: true, place: { id: 'posada' } })
  })

  it('falls back to the next stay before the trip', () => {
    expect(stayFor(items, places, GT, Date.parse('2027-03-01T12:00:00Z'))).toMatchObject({ tonight: false, place: { id: 'casa' } })
    expect(stayFor(items, places, GT, Date.parse('2027-04-01T12:00:00Z'))).toBeNull()
  })
})
