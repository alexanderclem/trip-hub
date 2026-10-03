import { describe, expect, it } from 'vitest'
import type { ExpenseRow, ItineraryItem } from '@/data/types'
import { toInstant } from '@/lib/time'
import { buildExpense, type ExpenseDraft } from './build'
import { forecast } from './forecast'

const GT = 'America/Guatemala'
const snapshot = { rates: { GTQ: 7.7 }, as_of: '2027-03-01' }
const members = ['ana', 'ben', 'cy']

function item(id: string, over: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    id, trip_id: 't', title: id, kind: 'activity', place_id: null, to_place_id: null, all_day: false,
    start_local: '2027-03-15T10:00', start_tz: GT, end_local: null, end_tz: null, start_at: toInstant('2027-03-15T10:00', GT), end_at: null,
    status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null,
    est_cost_minor: null, est_cost_currency: null, ...over,
  }
}

function expense(over: Partial<ExpenseDraft>): ExpenseRow {
  const r = buildExpense({
    id: 'e1', tripId: 't', description: 'Dinner', category: 'food', spentOn: '2027-03-15', amount: '90', currency: 'USD', baseCurrency: 'USD',
    rate: { value: 1, source: 'same', asOf: null }, payers: [{ memberId: 'ana', amount: '' }], splitMethod: 'equal',
    rows: members.map((m) => ({ memberId: m, included: true, value: '' })), notes: '', itemId: null, placeId: null, ...over,
  })
  if ('error' in r) throw new Error(r.error)
  return { ...r.expense, trip_id: 't' } as ExpenseRow
}

describe('forecast', () => {
  it('adds my share of logged expenses to my share of planned estimates', () => {
    const f = forecast({
      items: [
        item('tour', { est_cost_minor: 6000, est_cost_currency: 'USD' }), // 3 people → $20 each
        item('boat', { est_cost_minor: 77000, est_cost_currency: 'GTQ', attendee_ids: ['ana', 'ben'] }), // Q770 = $100 → $50 each
        item('spa', { est_cost_minor: 5000, est_cost_currency: 'USD', attendee_ids: ['ben'] }), // not mine
      ],
      expenses: [expense({})], // $90 split 3 ways
      memberIds: members, me: 'ana', base: 'USD', snapshot,
    })
    expect(f.spentMinor).toBe(3000)
    expect(f.planned.map((p) => [p.item.id, p.shareMinor, p.people])).toEqual([['tour', 2000, 3], ['boat', 5000, 2]])
    expect(f.plannedMinor).toBe(7000)
    expect(f.groupPlannedMinor).toBe(6000 + 10000 + 5000)
  })

  it('skips plans that already have a logged expense, and cancelled or removed ones', () => {
    const f = forecast({
      items: [
        item('dinner', { est_cost_minor: 9000, est_cost_currency: 'USD' }),
        item('cancelled', { est_cost_minor: 9000, est_cost_currency: 'USD', status: 'cancelled' }),
        item('removed', { est_cost_minor: 9000, est_cost_currency: 'USD', deleted_at: '2027-03-01T00:00:00Z' }),
      ],
      expenses: [expense({ itemId: 'dinner' })],
      memberIds: members, me: 'ana', base: 'USD', snapshot,
    })
    expect(f.planned).toEqual([])
    expect(f.spentMinor).toBe(3000)
  })

  it('counts plans I go to that still need an estimate, ignoring free time', () => {
    const f = forecast({
      items: [item('a'), item('b', { kind: 'meal' }), item('free', { kind: 'free' }), item('theirs', { attendee_ids: ['ben'] })],
      expenses: [], memberIds: members, me: 'ana', base: 'USD', snapshot,
    })
    expect(f.missingEstimates).toBe(2)
  })

  it('shares always add up to the estimate, pennies included', () => {
    const f = (me: string) => forecast({ items: [item('x', { est_cost_minor: 1000, est_cost_currency: 'USD' })], expenses: [], memberIds: members, me, base: 'USD', snapshot })
    expect(members.map((m) => f(m).plannedMinor).reduce((a, b) => a + b, 0)).toBe(1000)
  })
})
