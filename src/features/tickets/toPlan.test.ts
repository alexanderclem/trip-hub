import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/data/db'
import type { Attachment, ItineraryItem, Trip } from '@/data/types'
import { saveItem } from '@/features/itinerary/data'
import { ticketPlanDraft } from './toPlan'

const trip = { id: 't', timezone: 'America/New_York', start_date: '2027-05-01' } as Trip
const ticket = (over: Partial<Attachment> = {}) => ({ id: 'ticket', trip_id: 't', title: 'Boarding pass', kind: 'ticket', item_id: null, details: null, ...over }) as Attachment
const plan: ItineraryItem = { id: 'item', trip_id: 't', title: 'UA 42', kind: 'flight', place_id: null, to_place_id: null, all_day: false, start_local: '2027-05-01T09:00', start_tz: trip.timezone, end_local: null, end_tz: null, start_at: '', end_at: null, status: 'tentative', confirmation_code: 'ABC123', attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null }
afterEach(async () => { await db.delete() })
beforeEach(async () => { await db.open() })
describe('ticket to itinerary', () => {
  it('prefills printed travel fields and leaves missing times empty', () => {
    expect(ticketPlanDraft(ticket(), trip)).toMatchObject({ startDate: '2027-05-01', startTime: '', endTime: '' })
    const draft = ticketPlanDraft(ticket({ confirmation_code: 'ABC123', details: { title: null, merchant: 'United', amount: null, currency: null, date: '2027-04-01', confirmation_code: null, flight: 'UA 42', notes: null, start_date: '2027-05-02', start_time: '10:15', end_date: '2027-05-03', end_time: '06:20', start_timezone: 'America/New_York', end_timezone: 'Europe/London', item_kind: 'flight' } }), trip)
    expect(draft).toMatchObject({ title: 'United UA 42', kind: 'flight', startDate: '2027-05-02', startTime: '10:15', endDate: '2027-05-03', endTime: '06:20', endTz: 'Europe/London', code: 'ABC123' })
  })
  it('links the ticket and queues the new item before its attachment update', async () => {
    await db.attachments.put(ticket())
    await saveItem(plan, 'sam', 'ticket')
    expect((await db.attachments.get('ticket'))!.item_id).toBe('item')
    expect((await db._outbox.toArray()).map(entry => entry.table)).toEqual(['itinerary_items', 'attachments'])
    await saveItem(plan, 'sam', 'ticket')
    expect(await db.itinerary_items.count()).toBe(1)
  })
  it('refuses a ticket from another trip or one already used by another live item', async () => {
    await db.attachments.put(ticket({ trip_id: 'other' }))
    await expect(saveItem(plan, 'sam', 'ticket')).rejects.toThrow('no longer available')
    expect(await db.itinerary_items.count()).toBe(0)
    await db.attachments.put(ticket({ item_id: 'existing' }))
    await db.itinerary_items.put({ ...plan, id: 'existing' })
    await expect(saveItem(plan, 'sam', 'ticket')).rejects.toThrow('already linked')
    expect(await db.itinerary_items.count()).toBe(1)
  })
  it('rolls the item back if linking its ticket fails', async () => {
    await db.attachments.put(ticket())
    const fail = () => { throw new Error('No storage') }
    db.attachments.hook('updating', fail)
    try { await expect(saveItem(plan, 'sam', 'ticket')).rejects.toThrow('No storage') }
    finally { db.attachments.hook('updating').unsubscribe(fail) }
    expect(await db.itinerary_items.count()).toBe(0)
    expect((await db.attachments.get('ticket'))!.item_id).toBeNull()
    expect(await db._outbox.count()).toBe(0)
  })
})
