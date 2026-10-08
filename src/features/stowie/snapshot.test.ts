import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TripDb } from '@/data/db'
import type { Trip } from '@/data/types'
import { buildSnapshot, moneySummary } from './snapshot'

const trip = { id: 't', name: 'Guatemala', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-21', base_currency: 'USD' } as Trip
let database: TripDb
const put = (table: string, rows: object[]) => database.table(table).bulkPut(rows.map((r) => ({ trip_id: 't', ...r })))
beforeEach(async () => {
  database = new TripDb(`stowie-test-${crypto.randomUUID()}`)
  await put('members', [{ id: 'alex', display_name: 'Alex' }, { id: 'sam', display_name: 'Sam' }, { id: 'gone', display_name: 'Lee', deleted_at: '2026-10-01' }])
  await put('places', [{ id: 'p1', name: 'Café Sky', category: 'food', area: 'Antigua', status: 'planned' }, { id: 'p2', name: 'Some bakery', category: 'food', area: null, status: 'catalog' }])
  await put('itinerary_items', [
    { id: 'i2', title: 'Dinner', kind: 'meal', status: 'confirmed', all_day: false, start_local: '2027-03-14T19:00', end_local: '2027-03-14T20:30', place_id: 'p1', attendee_ids: ['alex', 'sam'], confirmation_code: 'SECRET-123', notes: 'door code 4411' },
    { id: 'i1', title: 'Fly in', kind: 'flight', status: 'confirmed', all_day: true, start_local: '2027-03-13T00:00', end_local: null, place_id: null, attendee_ids: null, confirmation_code: 'PNR999', notes: null },
    { id: 'i3', title: 'Cancelled tour', kind: 'activity', status: 'cancelled', all_day: false, start_local: '2027-03-15T09:00', end_local: null, place_id: null, attendee_ids: null },
  ])
  await put('trip_tasks', [{ id: 'k1', title: 'Book shuttle', assignee_id: 'sam', due_date: '2027-03-01', completed: false }, { id: 'k2', title: 'Old task', assignee_id: null, due_date: null, completed: true, deleted_at: '2026-10-01' }])
  await put('packing_items', [{ id: 'k3', title: 'Passport', kind: 'everyone', owner_id: null, packed: false }, { id: 'k4', title: 'Sam’s meds', kind: 'personal', owner_id: 'sam', packed: false }, { id: 'k5', title: 'Speaker', kind: 'group', owner_id: 'sam', packed: true }])
  await put('packing_checks', [{ id: 'c1', item_id: 'k3', member_id: 'alex', state: 'packed' }])
  await put('polls', [{ id: 'v1', title: 'Dinner on Monday', status: 'open', winner_option_id: null }])
  await put('poll_options', [{ id: 'o1', poll_id: 'v1', label: 'Tacos' }, { id: 'o2', poll_id: 'v1', label: 'Pizza' }])
  await put('poll_votes', [{ id: 'w1', poll_id: 'v1', option_id: 'o1', member_id: 'sam', score: 3 }, { id: 'w2', poll_id: 'v1', option_id: 'o2', member_id: 'alex', score: null }])
  await put('expenses', [{ id: 'e1', amount_minor: 6000, currency: 'USD', fx_rate: '1', base_currency: 'USD', base_amount_minor: 6000, payers: [{ member_id: 'alex', amount_minor: 6000 }], split_method: 'equal', split: [{ member_id: 'alex', value: 1 }, { member_id: 'sam', value: 1 }] }])
})
afterEach(async () => { await database.delete() })

describe('what Stowie reads about a trip', () => {
  it('builds only the sections asked for', async () => {
    const snapshot = await buildSnapshot(trip, 'alex', ['tasks', 'tasks'], database)
    expect(Object.keys(snapshot)).toEqual(['tasks'])
    expect(snapshot.tasks).toBe('[open] Book shuttle | owner: Sam | due 2027-03-01')
  })
  it('lists the plan in order without codes, notes or cancelled items', async () => {
    const { plan } = await buildSnapshot(trip, 'alex', ['plan'], database)
    expect(plan!.split('\n')).toEqual([
      'Trip: Guatemala. Dates: 2027-03-13 to 2027-03-21. Times are local (America/Guatemala).',
      'Sat 2027-03-13 all day | Fly in | flight, confirmed',
      'Sun 2027-03-14 19:00–20:30 | Dinner | meal, confirmed | at Café Sky | with Alex, Sam',
    ])
    const everything = JSON.stringify(await buildSnapshot(trip, 'alex', ['plan', 'places', 'tasks', 'packing', 'votes', 'people', 'money'], database))
    for (const secret of ['SECRET-123', 'PNR999', '4411', 'Cancelled tour', 'Old task', 'Some bakery', 'Lee']) expect(everything).not.toContain(secret)
  })
  it('keeps other people’s personal packing private, and shows this person’s own ticks and votes', async () => {
    const { packing, votes, places } = await buildSnapshot(trip, 'alex', ['packing', 'votes', 'places'], database)
    expect(packing).toContain('Passport | everyone brings one | me: packed')
    expect(packing).toContain('Speaker | group item, Sam is bringing it | packed')
    expect(packing).not.toContain('meds')
    expect(votes).toContain('Vote: Dinner on Monday | open')
    expect(votes).toContain('  - Tacos | 1 of 2 voted, average 3.0 of 3 | my vote: none yet')
    expect(places).toBe('Café Sky | food | Antigua | planned')
  })
  it('works out balances exactly, from each person’s side', async () => {
    expect((await moneySummary(trip, 'alex', database)).mine).toBe('You’re owed $30.00. Sam pays you $30.00.')
    expect((await moneySummary(trip, 'sam', database)).mine).toBe('You owe $30.00. Pay Alex $30.00.')
    expect((await moneySummary(trip, 'alex', database)).everyone.split('\n')).toEqual(['Total spent: $60.00 (USD).', 'Alex (me) is owed $30.00', 'Sam owes $30.00', 'Fewest payments to settle:', 'Sam pays Alex (me) $30.00'])
    await database.expenses.clear()
    expect((await moneySummary(trip, 'alex', database)).mine).toContain('all square')
  })
})
