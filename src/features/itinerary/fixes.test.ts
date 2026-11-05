import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TripDb } from '@/data/db'
import type { ItineraryItem, Place, Trip } from '@/data/types'
import type { LegContext } from '@/features/routing/legs'
import { toInstant } from '@/lib/time'
import { applyScheduleFix, scheduleFixes, scheduleIssues } from './fixes'
import { planTransfers } from './travel'
import { save } from '@/data/repo'

const zone = 'America/New_York'
const tripId = '00000000-0000-4000-8000-000000000111'
const trip: Trip = { id: tripId, name: 'Test trip', timezone: zone, start_date: '2027-05-01', end_date: '2027-05-03', base_currency: 'USD', local_currency: 'USD', share_token: 'local', route_factor_low: 1.4, route_factor_high: 2, settings: {}, bbox: null, offline_pack: null }
const item = (id: string, start: string, end: string | null, place: string | null, extra: Partial<ItineraryItem> = {}): ItineraryItem => ({
  id, trip_id: tripId, title: id, kind: 'activity', place_id: place, to_place_id: null, all_day: false, start_local: `2027-05-01T${start}`, start_tz: zone,
  end_local: end ? `2027-05-01T${end}` : null, end_tz: end ? zone : null, start_at: toInstant(`2027-05-01T${start}`, zone), end_at: end ? toInstant(`2027-05-01T${end}`, zone) : null,
  status: 'tentative', confirmation_code: null, attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null, ...extra,
})
const places: Place[] = ['a', 'b', 'c'].map((id) => ({ id, trip_id: tripId, name: id, category: 'activity', tags: [], lat: null, lng: null, address: null, area: null, status: 'planned', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' }))
const ctx: LegContext = { legs: [], areaRoutes: [], factorLow: 1.4, factorHigh: 2, overrides: [{ id: 'route', trip_id: tripId, place_a_id: 'a', place_b_id: 'b', mode: 'shuttle', min_s: 1200, max_s: 1800, note: null }] }
const rows = () => [item('coffee', '09:00', '10:00', 'a'), item('tour', '10:15', '11:15', 'b')]
const issues = (items: ItineraryItem[]) => scheduleIssues(items, planTransfers(items, places, ctx, zone, ['alex']))
const fixes = (items: ItineraryItem[]) => scheduleFixes(issues(items)[0]!, items, places, ctx, zone, ['alex'], { start: trip.start_date, end: trip.end_date })
const databases: TripDb[] = []
afterEach(async () => { await Promise.all(databases.splice(0).map((db) => db.delete())) })
async function seeded(items = rows()) {
  const db = new TripDb(crypto.randomUUID()); databases.push(db)
  await db.trips.put(trip); await db.members.put({ id: 'alex', trip_id: tripId, display_name: 'Alex', color: null, avatar_emoji: null, home_timezone: null })
  await db.places.bulkPut(places); await db.leg_overrides.bulkPut(ctx.overrides); await db.itinerary_items.bulkPut(items)
  return db
}

describe('reviewed schedule fixes', () => {
  it('offers later and earlier moves with an upper travel estimate, preserving both durations', () => {
    const proposals = fixes(rows())
    expect(proposals.map((p) => p.blocked)).toEqual([null, null])
    expect(proposals.map((p) => p.preview.after[0]!.start_local)).toEqual(['2027-05-01T10:30', '2027-05-01T08:45'])
    for (const p of proposals) expect(Date.parse(p.preview.after[0]!.end_at!) - Date.parse(p.preview.after[0]!.start_at)).toBe(3600_000)
  })
  it('includes check-in and waiting in fixes and leave-by guidance', () => {
    const items = rows(); items[1]!.details = { check_in_minutes: '20', waiting_minutes: '10' }
    const transfer = planTransfers(items, places, ctx, zone, ['alex'])[0]!
    expect(transfer.requiredS).toBe(3600)
    expect(transfer.leaveAt).toBe(Date.parse(toInstant('2027-05-01T09:15', zone)))
    expect(fixes(items)[0]!.preview.after[0]!.start_local).toBe('2027-05-01T11:00')
  })
  it('repairs actual overlaps and includes travel when the locations differ', () => {
    const items = [rows()[0]!, item('tour', '09:30', '10:30', 'b')]
    expect(issues(items)).toHaveLength(1)
    expect(issues(items)[0]!.kind).toBe('overlap')
    expect(fixes(items)[0]!.preview.after[0]!.start_local).toBe('2027-05-01T10:30')
  })
  it('offers no automatic moves for coded bookings and flights', () => {
    const items = rows(); items[0]!.confirmation_code = 'CAFE'; items[1]!.kind = 'flight'
    expect(fixes(items)).toEqual([])
  })
  it('blocks fixes that create another overlap instead of hiding it', () => {
    const items = [...rows(), item('later', '11:15', '12:00', null)]
    expect(fixes(items).find((f) => f.id === 'tour')!.blocked).toContain('another overlap')
    expect(fixes(items).find((f) => f.id === 'coffee')!.blocked).toBeNull()
  })
  it('blocks a new travel shortage to the following booked plan', () => {
    const items = [...rows(), item('return', '11:45', '12:30', 'a', { confirmation_code: 'RETURN' })]
    expect(fixes(items).find((f) => f.id === 'tour')!.blocked).toContain('too little travel time')
  })
  it('does not invent an earlier activity’s unknown end', () => {
    const items = [item('coffee', '09:00', null, 'a'), item('tour', '09:30', '10:30', 'b')]
    expect(fixes(items)).toEqual([])
  })
  it('ignores disjoint attendees and cancelled, all-day, or removed entries', () => {
    expect(issues([item('alex', '09:00', '10:00', 'a', { attendee_ids: ['alex'] }), item('sam', '09:30', '10:30', 'b', { attendee_ids: ['sam'] })])).toEqual([])
    for (const extra of [{ status: 'cancelled' as const }, { all_day: true }, { deleted_at: 'removed' }]) expect(issues([rows()[0]!, { ...rows()[1]!, ...extra }])).toEqual([])
  })
  it('blocks an automatic move beyond the trip dates', () => {
    const items = [item('a', '00:00', '01:00', 'a'), item('b', '01:10', '02:00', 'b', { kind: 'flight' })]
    expect(fixes(items)[0]!.blocked).toContain('outside the trip dates')
  })
  it('saves offline through the outbox and supports guarded undo', async () => {
    const items = rows(); const db = await seeded(items)
    const undo = await applyScheduleFix(issues(items)[0]!, fixes(items)[0]!, 'alex', db)
    expect((await db.itinerary_items.get('tour'))!.start_local).toBe('2027-05-01T10:30')
    expect(await db._outbox.count()).toBe(1)
    await undo()
    expect((await db.itinerary_items.get('tour'))!.start_local).toBe('2027-05-01T10:15')
  })
  it('rejects a new activity added after the preview without saving anything', async () => {
    const items = rows(); const db = await seeded(items)
    await db.itinerary_items.put(item('new', '13:00', '14:00', null))
    await expect(applyScheduleFix(issues(items)[0]!, fixes(items)[0]!, 'alex', db)).rejects.toThrow('itinerary changed')
    expect(await db._outbox.count()).toBe(0)
  })
  it('rechecks changed route evidence at save time', async () => {
    const items = rows(); const db = await seeded(items)
    await db.leg_overrides.update('route', { max_s: 3600 })
    await expect(applyScheduleFix(issues(items)[0]!, fixes(items)[0]!, 'alex', db)).rejects.toThrow('estimate changed')
    expect(await db._outbox.count()).toBe(0)
  })
  it('keeps a later edit intact when undo is requested', async () => {
    const items = rows(); const db = await seeded(items)
    const undo = await applyScheduleFix(issues(items)[0]!, fixes(items)[0]!, 'alex', db)
    await save('itinerary_items', { ...(await db.itinerary_items.get('tour'))!, notes: 'New meeting point' }, 'alex', db)
    await expect(undo()).rejects.toThrow('overwrite')
  })
})
