import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TripDb } from '@/data/db'
import { setWriteGuard } from '@/data/repo'
import { GROUP_ACCESS, writeRefusal } from '@/data/access'
import type { ItineraryItem, Member, Place, Poll, PollOption, PollVote, TableName, Trip } from '@/data/types'
import type { Remote } from '@/data/sync/remote'
import { pull, push } from '@/data/sync/engine'
import { saveBudget } from '@/features/money/budget'
import { saveVotePlan, suggestedAttendees, votePlanId } from './toPlan'

const tripId = '00000000-0000-4000-8000-000000000211'
const me = '00000000-0000-4000-8000-000000000212'
const sam = '00000000-0000-4000-8000-000000000213'
const trip: Trip = { id: tripId, name: 'Trip', timezone: 'America/New_York', start_date: '2027-05-01', end_date: '2027-05-03', base_currency: 'USD', local_currency: 'USD', share_token: 'local', route_factor_low: 1.4, route_factor_high: 2, settings: {}, bbox: null, offline_pack: null }
const poll: Poll = { id: 'poll', trip_id: tripId, title: 'Which tour?', description: null, status: 'closed', winner_option_id: 'option' }
const option: PollOption = { id: 'option', trip_id: tripId, poll_id: poll.id, label: 'Museum', place_id: 'place', url: 'https://example.com/book', description: 'Morning tour' }
const members: Member[] = [{ id: me, trip_id: tripId, display_name: 'Alex', color: null, avatar_emoji: null, home_timezone: null }, { id: sam, trip_id: tripId, display_name: 'Sam', color: null, avatar_emoji: null, home_timezone: null }]
const place: Place = { id: 'place', trip_id: tripId, name: 'Museum', category: 'activity', tags: [], lat: null, lng: null, address: null, area: null, status: 'shortlist', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' }
const item: ItineraryItem = { id: 'draft', trip_id: tripId, title: 'Museum', kind: 'activity', place_id: place.id, to_place_id: null, all_day: false, start_local: '2027-05-02T09:00', end_local: '2027-05-02T10:30', start_tz: trip.timezone, end_tz: trip.timezone, start_at: '', end_at: null, status: 'tentative', confirmation_code: null, attendee_ids: [me, sam], details: {}, notes: 'Morning tour', est_cost_minor: 6000, est_cost_currency: 'USD' }
const source = { pollId: poll.id, optionId: option.id }
const booking = { assigneeId: sam, dueDate: '2027-04-30' }
const databases: TripDb[] = []
afterEach(async () => { setWriteGuard(null); await Promise.all(databases.splice(0).map((db) => db.delete())) })
async function seeded() {
  const db = new TripDb(crypto.randomUUID()); databases.push(db)
  await db.trips.put(trip); await db.members.bulkPut(members); await db.polls.put(poll); await db.poll_options.put(option); await db.places.put(place)
  return db
}

describe('winning votes to finished plans', () => {
  it('syncs the linked plan and task to another phone while keeping the budget private', async () => {
    const first = await seeded(); const second = new TripDb(crypto.randomUUID()); databases.push(second)
    const remoteRows = new Map<TableName, Record<string, unknown>[]>()
    let clock = Date.parse('2027-01-01T12:00:00Z')
    const remote: Remote = {
      async write(table, rows) { remoteRows.set(table, rows.map((row) => ({ ...row, updated_at: new Date(clock += 1000).toISOString() }))); return null },
      async pull(table, _tripId, _since, offset, limit) { return { rows: (remoteRows.get(table) ?? []).slice(offset, offset + limit) } },
    }
    const id = await saveVotePlan({ ...item, details: { check_in_minutes: '15', waiting_minutes: '10' } }, source, booking, me, first)
    await saveBudget(tripId, me, '1250', 'USD', first)
    expect((await push(remote, first)).deadLettered).toBe(0)
    expect((await pull(remote, tripId, second)).error).toBeUndefined()
    const received = (await second.itinerary_items.get(id))!
    expect(received.details).toMatchObject({ vote_poll_id: poll.id, vote_option_id: option.id, check_in_minutes: '15', waiting_minutes: '10' })
    expect((await second.trip_tasks.get(received.details.booking_task_id!))!.assignee_id).toBe(sam)
    expect((await second._meta.toArray()).some((row) => row.key.startsWith('budget:'))).toBe(false)
    expect(JSON.stringify([...remoteRows])).not.toContain('125000')
  })
  it('saves the winner, estimated cost, attendees, provenance and booking task atomically offline', async () => {
    const db = await seeded()
    const id = await saveVotePlan(item, source, booking, me, db)
    const saved = (await db.itinerary_items.get(id))!
    expect(id).toBe(votePlanId(tripId, source))
    expect(saved.start_at).toBe('2027-05-02T13:00:00.000Z')
    expect(saved.end_at).toBe('2027-05-02T14:30:00.000Z')
    expect(saved.est_cost_minor).toBe(6000)
    expect(saved.attendee_ids).toEqual([me, sam])
    expect(saved.details).toMatchObject({ vote_poll_id: poll.id, vote_option_id: option.id })
    const task = (await db.trip_tasks.get(saved.details.booking_task_id!))!
    expect(task).toMatchObject({ title: 'Book Museum', assignee_id: sam, due_date: '2027-04-30', completed: false })
    expect(task.notes).toContain(`/t/${tripId}/plan/${id}`)
    expect((await db.places.get(place.id))!.status).toBe('planned')
    expect((await db._outbox.toArray()).map((entry) => entry.table)).toEqual(['itinerary_items', 'places', 'trip_tasks'])
  })
  it('makes repeated saves idempotent without overwriting the first plan or task', async () => {
    const db = await seeded()
    const ids = await Promise.all([saveVotePlan(item, source, booking, me, db), saveVotePlan({ ...item, title: 'Different', est_cost_minor: 99999 }, source, booking, me, db)])
    expect(ids[0]).toBe(ids[1])
    expect(await db.itinerary_items.count()).toBe(1)
    expect(await db.trip_tasks.count()).toBe(1)
    expect((await db.itinerary_items.get(ids[0]!))!.title).toBe('Museum')
  })
  it('rolls back the itinerary, place and outbox if the task write fails', async () => {
    const db = await seeded()
    setWriteGuard((table) => table === 'trip_tasks' ? 'Task rejected' : null)
    await expect(saveVotePlan(item, source, booking, me, db)).rejects.toThrow('Task rejected')
    expect(await db.itinerary_items.count()).toBe(0)
    expect(await db._outbox.count()).toBe(0)
    expect((await db.places.get(place.id))!.status).toBe('shortlist')
  })
  it('supports text-only winning options and scheduling without a booking task', async () => {
    const db = await seeded(); await db.poll_options.update(option.id, { place_id: null })
    const id = await saveVotePlan({ ...item, place_id: null }, source, null, me, db)
    expect((await db.itinerary_items.get(id))!.details.booking_task_id).toBeUndefined()
    expect(await db.trip_tasks.count()).toBe(0)
  })
  it('refuses reopened votes or a changed winner before any writes', async () => {
    const db = await seeded()
    for (const update of [{ status: 'open' as const }, { status: 'closed' as const, winner_option_id: 'other' }]) {
      await db.polls.update(poll.id, update)
      await expect(saveVotePlan(item, source, booking, me, db)).rejects.toThrow('choice changed')
    }
    expect(await db._outbox.count()).toBe(0)
  })
  it('rejects foreign trips, deleted options and a changed winning place', async () => {
    const db = await seeded()
    await db.poll_options.update(option.id, { trip_id: 'foreign' })
    await expect(saveVotePlan(item, source, null, me, db)).rejects.toThrow('no longer available')
    await db.poll_options.put({ ...option, deleted_at: 'removed' })
    await expect(saveVotePlan(item, source, null, me, db)).rejects.toThrow('no longer available')
    await db.poll_options.put(option)
    await expect(saveVotePlan({ ...item, place_id: null }, source, null, me, db)).rejects.toThrow('winning place changed')
  })
  it('keeps date votes in the trip-date flow', async () => {
    const db = await seeded(); await db.poll_options.update(option.id, { starts_on: '2027-05-01' })
    await expect(saveVotePlan(item, source, null, me, db)).rejects.toThrow('choice changed')
  })
  it('requires a current booking owner and a deadline no later than the activity', async () => {
    const db = await seeded()
    for (const draft of [{ assigneeId: 'former', dueDate: '2027-04-01' }, { ...booking, dueDate: '2027-02-30' }, { ...booking, dueDate: '2027-05-03' }]) await expect(saveVotePlan(item, source, draft, me, db)).rejects.toThrow()
    expect(await db._outbox.count()).toBe(0)
  })
  it('rejects former or empty attendee selections', async () => {
    const db = await seeded()
    for (const attendee_ids of [[], ['former']]) await expect(saveVotePlan({ ...item, attendee_ids }, source, null, me, db)).rejects.toThrow('current traveler')
    expect(await db._outbox.count()).toBe(0)
  })
  it('never resurrects a previously deleted or cancelled choice', async () => {
    const db = await seeded(); const id = await saveVotePlan(item, source, null, me, db)
    await db.itinerary_items.update(id, { deleted_at: 'removed' })
    await expect(saveVotePlan(item, source, null, me, db)).rejects.toThrow('removed or cancelled')
    expect(await db.itinerary_items.count()).toBe(1)
  })
  it('preserves hosted-trip permissions at the write boundary', async () => {
    const db = await seeded()
    setWriteGuard((table, row, member) => writeRefusal({ ...GROUP_ACCESS, mode: 'hosted', role: 'traveler' }, table, row, member))
    await expect(saveVotePlan(item, source, booking, me, db)).rejects.toThrow('organizers')
    expect(await db._outbox.count()).toBe(0)
  })
  it('rolls back when the winning place was deleted or an end precedes its start', async () => {
    const db = await seeded(); await db.places.update(place.id, { deleted_at: 'removed' })
    await expect(saveVotePlan(item, source, booking, me, db)).rejects.toThrow('still available')
    await db.places.put(place)
    await expect(saveVotePlan({ ...item, end_local: '2027-05-02T08:00' }, source, booking, me, db)).rejects.toThrow('ends before')
    expect(await db._outbox.count()).toBe(0)
  })
  it('suggests attendance only from current members’ positive votes for this option', () => {
    const vote = (member_id: string, score: PollVote['score'], extra: Partial<PollVote> = {}): PollVote => ({ id: member_id, trip_id: tripId, poll_id: poll.id, option_id: option.id, member_id, score, ...extra })
    expect(suggestedAttendees(option, [vote(me, 3), vote(sam, 0), vote('former', 3), vote(sam, 3, { option_id: 'other' })], members)).toEqual([me])
    expect(suggestedAttendees(option, [vote(me, null), vote(sam, 2, { deleted_at: 'removed' })], members)).toEqual([])
  })
})
