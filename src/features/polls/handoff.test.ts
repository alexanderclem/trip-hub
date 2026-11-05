import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TripDb } from '@/data/db'
import type { ItineraryItem } from '@/data/types'
import { assignBooking, bookingTaskId, finishBooking, linkDecisionItem } from './handoff'
const trip = '00000000-0000-4000-8000-000000000111'
let db: TripDb
const item = { id: 'item', trip_id: trip, title: 'Shuttle', kind: 'transport', place_id: null, to_place_id: null, all_day: false, end_local: null, confirmation_code: null, notes: null, est_cost_minor: null, est_cost_currency: null, status: 'tentative', start_at: '2027-03-01T12:00:00Z', start_local: '2027-03-01T12:00', start_tz: 'UTC', end_at: null, end_tz: null, attendee_ids: null, details: { decision_poll_id: 'poll', decision_option_id: 'option' } } as ItineraryItem
beforeEach(async () => {
  db = new TripDb(`handoff-${crypto.randomUUID()}`)
  await db.polls.put({ id: 'poll', trip_id: trip, title: 'Airport transfer', description: null, status: 'closed', winner_option_id: 'option' })
  await db.poll_options.put({ id: 'option', trip_id: trip, poll_id: 'poll', label: 'Shuttle', place_id: null, url: null, description: null })
  await db.members.put({ id: 'alex', trip_id: trip, display_name: 'Alex', color: null, avatar_emoji: null, home_timezone: null })
  await db.itinerary_items.put(item)
})
afterEach(async () => { await db.delete() })
describe('decision handoff', () => {
  it('creates one offline task on repeated assignment and keeps its completion state', async () => {
    const fields = { assignee_id: 'alex', due_date: '2027-02-28' }
    const id = await assignBooking(trip, 'poll', 'option', fields, 'alex', db)
    await db.trip_tasks.update(id, { completed: true })
    await assignBooking(trip, 'poll', 'option', { ...fields, due_date: null }, 'alex', db)
    expect(await db.trip_tasks.count()).toBe(1)
    expect(await db.trip_tasks.get(id)).toMatchObject({ completed: true, due_date: null, _dirty: 1 })
    expect(await db._outbox.count()).toBe(1)
  })
  it('refuses invalid dates, outsiders, missing owners and stale decisions without queuing anything', async () => {
    for (const fields of [{ assignee_id: 'alex', due_date: '2027-02-30' }, { assignee_id: 'outsider', due_date: null }, { assignee_id: null, due_date: null }]) {
      await expect(assignBooking(trip, 'poll', 'option', fields, 'alex', db)).rejects.toThrow()
    }
    await db.polls.update('poll', { status: 'open' })
    await expect(assignBooking(trip, 'poll', 'option', { assignee_id: 'alex', due_date: null }, 'alex', db)).rejects.toThrow('decision changed')
    expect(await db._outbox.count()).toBe(0)
  })
  it('never treats a completed booking task as confirmation', async () => {
    await assignBooking(trip, 'poll', 'option', { assignee_id: 'alex', due_date: null }, 'alex', db)
    await db.trip_tasks.update(bookingTaskId(trip, 'option'), { completed: true })
    await expect(finishBooking(trip, 'poll', 'option', 'item', '', false, 'alex', db)).rejects.toThrow('confirmation code')
    expect((await db.itinerary_items.get('item'))?.status).toBe('tentative')
  })
  it('confirms explicitly and completes the linked task atomically with offline outbox records', async () => {
    await assignBooking(trip, 'poll', 'option', { assignee_id: 'alex', due_date: null }, 'alex', db)
    await finishBooking(trip, 'poll', 'option', 'item', ' REF123 ', false, 'alex', db)
    expect(await db.itinerary_items.get('item')).toMatchObject({ status: 'confirmed', confirmation_code: 'REF123', _dirty: 1 })
    expect(await db.trip_tasks.get(bookingTaskId(trip, 'option'))).toMatchObject({ completed: true })
    expect(await db._outbox.count()).toBe(2)
  })
  it('supports an explicit no-booking-needed choice without fabricating a code', async () => {
    await finishBooking(trip, 'poll', 'option', 'item', '', true, 'alex', db)
    expect(await db.itinerary_items.get('item')).toMatchObject({ status: 'confirmed', confirmation_code: null, details: { decision_booking: 'not_required' } })
  })
  it('refuses a changed winner and a plan item from another trip', async () => {
    await db.itinerary_items.update('item', { trip_id: 'other' })
    await expect(finishBooking(trip, 'poll', 'option', 'item', 'CODE', false, 'alex', db)).rejects.toThrow('changed or was removed')
    await db.polls.update('poll', { winner_option_id: 'other' })
    await expect(finishBooking(trip, 'poll', 'option', 'item', 'CODE', false, 'alex', db)).rejects.toThrow('decision changed')
    expect(await db._outbox.count()).toBe(0)
  })
  it('links an existing plan item explicitly and refuses duplicates', async () => {
    await db.itinerary_items.delete('item')
    await db.itinerary_items.put({ ...item, id: 'legacy', details: {} })
    await linkDecisionItem(trip, 'poll', 'option', 'legacy', 'alex', db)
    expect((await db.itinerary_items.get('legacy'))?.details).toMatchObject({ decision_poll_id: 'poll', decision_option_id: 'option' })
    await expect(linkDecisionItem(trip, 'poll', 'option', 'legacy', 'alex', db)).rejects.toThrow('already in the plan')
    expect(await db.itinerary_items.count()).toBe(1)
  })
})
