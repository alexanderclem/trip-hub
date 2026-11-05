import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TripDb } from '@/data/db'
import type { ItineraryItem } from '@/data/types'
import { saveMany } from '@/data/repo'
import { planChanges } from '@/data/itineraryChanges'
import { toInstant } from '@/lib/time'
import { applySchedule, previewSchedule, undoDuplicate, duplicateEndDate } from './reschedule'

const item = (id: string, start = '2027-05-01T09:00', end = '2027-05-01T10:00', extra: Partial<ItineraryItem> = {}): ItineraryItem => ({
  id, trip_id: 'trip', title: id, kind: 'activity', place_id: null, to_place_id: null, all_day: false,
  start_local: start, start_tz: 'America/New_York', end_local: end, end_tz: 'America/New_York',
  start_at: toInstant(start, 'America/New_York'), end_at: toInstant(end, 'America/New_York'), status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null, ...extra,
})
const databases: TripDb[] = []
const database = () => { const db = new TripDb(crypto.randomUUID()); databases.push(db); return db }
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.delete())) })

describe('rescheduling', () => {
  it('preserves overnight and multi-day ranges when changing a copy’s start date', () => {
    expect(duplicateEndDate(item('stay', '2027-05-01T15:00', '2027-05-04T11:00'), '2027-05-08')).toBe('2027-05-11')
    expect(duplicateEndDate(item('bus', '2027-03-13T22:00', '2027-03-14T06:00'), '2027-03-14')).toBe('2027-03-15')
  })
  it('moves a cross-zone item while preserving elapsed duration and end zone', () => {
    const flight = item('flight', '2027-05-01T09:00', '2027-05-01T10:00', { end_local: '2027-05-01T16:00', end_tz: 'Europe/London', end_at: toInstant('2027-05-01T16:00', 'Europe/London') })
    const result = previewSchedule([flight], flight.id, '2027-05-02', '10:00', false, 'America/New_York').after[0]!
    expect(result.start_local).toBe('2027-05-02T10:00')
    expect(result.end_local).toBe('2027-05-02T17:00')
    expect(result.end_tz).toBe('Europe/London')
    expect(Date.parse(result.end_at!) - Date.parse(result.start_at)).toBe(Date.parse(flight.end_at!) - Date.parse(flight.start_at))
  })
  it('shifts only later timed activities from that day, with no changes to stays or tomorrow', () => {
    const rows = [item('first'), item('later', '2027-05-01T12:00', '2027-05-01T13:00'), item('tomorrow', '2027-05-02T12:00', '2027-05-02T13:00'), item('stay', '2027-05-01T15:00', '2027-05-02T11:00', { kind: 'lodging' }), item('cancelled', '2027-05-01T16:00', '2027-05-01T17:00', { status: 'cancelled' })]
    const result = previewSchedule(rows, 'first', '2027-05-01', '10:30', true, 'America/New_York')
    expect(result.after.map(i => [i.id, i.start_local])).toEqual([['first', '2027-05-01T10:30'], ['later', '2027-05-01T13:30']])
  })
  it('rejects nonexistent DST times and resolves repeated times using the app policy', () => {
    expect(() => previewSchedule([item('a')], 'a', '2027-03-14', '02:30', false, 'America/New_York')).toThrow('clocks change')
    expect(previewSchedule([item('a')], 'a', '2027-11-07', '01:30', false, 'America/New_York').after[0]!.start_at).toBe('2027-11-07T06:30:00.000Z')
  })
  it('keeps an all-day range in calendar days across DST', () => {
    const original = item('all', '2027-03-12T00:00', '2027-03-14T00:00', { all_day: true })
    const result = previewSchedule([original], 'all', '2027-03-13', '', false, 'America/New_York').after[0]!
    expect(result.start_local).toBe('2027-03-13T00:00')
    expect(result.end_local).toBe('2027-03-15T00:00')
  })
  it('reports overlaps involving the moved item', () => {
    const rows = [item('a'), item('b', '2027-05-01T12:00', '2027-05-01T13:00')]
    expect(previewSchedule(rows, 'a', '2027-05-01', '12:30', false, 'America/New_York').conflicts).toBe(1)
  })
  it('saves a batch and undo atomically, retaining both changes in synced history', async () => {
    const db = database(); const rows = [item('a'), item('b', '2027-05-01T12:00', '2027-05-01T13:00')]
    await db.itinerary_items.bulkPut(rows)
    const undo = await applySchedule(previewSchedule(rows, 'a', '2027-05-02', '10:00', true, 'America/New_York'), 'sam', db)
    expect((await db.itinerary_items.get('b'))!.start_local).toBe('2027-05-02T13:00')
    const first = planChanges((await db.itinerary_items.get('a'))!)[0]!
    expect(first.text).toContain('09:00')
    expect(first.text).toContain('10:00')
    await undo()
    const restored = (await db.itinerary_items.get('a'))!
    expect(restored.start_local).toBe(rows[0]!.start_local)
    expect(planChanges(restored)).toHaveLength(2)
    expect(planChanges(restored)[0]).toEqual(first)
    expect((await db._outbox.toArray()).every(entry => !!(entry.payload.details as Record<string, string>).stowaway_changes_v1)).toBe(true)
  })
  it('refuses stale previews and undo after another edit', async () => {
    const db = database(); const original = item('a'); await db.itinerary_items.put(original)
    const preview = previewSchedule([original], 'a', '2027-05-02', '10:00', false, 'America/New_York')
    await saveMany('itinerary_items', [{ ...original, notes: 'Someone edited this' }], 'sam', db)
    await expect(applySchedule(preview, 'alex', db)).rejects.toThrow('itinerary changed')
    const current = (await db.itinerary_items.get('a'))!
    const undo = await applySchedule(previewSchedule([current], 'a', '2027-05-02', '10:00', false, 'America/New_York'), 'alex', db)
    await saveMany('itinerary_items', [{ ...(await db.itinerary_items.get('a'))!, title: 'Updated again' }], 'sam', db)
    await expect(undo()).rejects.toThrow('changed again')
    expect((await db.itinerary_items.get('a'))!.title).toBe('Updated again')
  })
  it('rolls the whole batch back when writing the outbox fails', async () => {
    const db = database(); const rows = [item('a'), item('b', '2027-05-01T12:00', '2027-05-01T13:00')]; await db.itinerary_items.bulkPut(rows)
    db._outbox.hook('creating', () => { throw new Error('No storage') })
    await expect(applySchedule(previewSchedule(rows, 'a', '2027-05-02', '10:00', true, 'America/New_York'), 'sam', db)).rejects.toThrow('No storage')
    expect(await db.itinerary_items.toArray()).toEqual(rows)
    expect(await db._outbox.count()).toBe(0)
  })
  it('undoes only an unchanged copy and allows server timestamp formatting changes', async () => {
    const db = database(); const copy = item('copy'); await db.itinerary_items.put({ ...copy, start_at: copy.start_at.replace('.000Z', '+00:00') })
    await undoDuplicate(copy, 'sam', db)
    expect((await db.itinerary_items.get('copy'))!.deleted_at).toBeTruthy()
    const edited = item('edited'); await db.itinerary_items.put({ ...edited, notes: 'Changed by someone else' })
    await expect(undoDuplicate(edited, 'sam', db)).rejects.toThrow('copy changed')
    expect((await db.itinerary_items.get('edited'))!.deleted_at).toBeUndefined()
  })
})
