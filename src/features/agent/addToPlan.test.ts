import { describe, expect, it } from 'vitest'
import { planItems } from './addToPlan'
import type { FinalPlan } from './client'

const trip = { id: '11111111-1111-4111-8111-111111111111', timezone: 'Europe/Rome' }
const stay = { name: 'Club House Roma', rateId: 'H1', refundable: false, photo: null, address: 'Via X 1', checkin: '2027-02-24', checkout: '2027-02-27' }
const plan: FinalPlan = {
  summary: 's', assumptions: [], currency: 'USD', totalMinor: 194157,
  days: [
    { date: '2027-02-24', stay, items: [{ node: 0, kind: 'flight', title: 'UA1 SEA→FCO', start: '22:00', end: '06:30', ref: 'F1', routed: false }] },
    { date: '2027-02-25', stay, items: [{ node: 1, kind: 'free', title: 'Lunch in Trastevere', start: '13:00', end: '14:30', ref: 'place-1', routed: true, placeId: 'place-1' }] },
    { date: '2027-02-27', stay: null, items: [{ node: 2, kind: 'flight', title: 'UA2 FCO→SEA', start: '07:05', end: '12:00', ref: 'F1', routed: false }] },
  ],
  bookable: [{ kind: 'flight', ref: 'F1', totalMinor: 94282, expiresAt: null }, { kind: 'hotel', ref: 'H1', totalMinor: 99875, expiresAt: null }],
  unrouted: [], usage: { modelTurns: 1, promptTokens: 0, cachedPromptTokens: 0, completionTokens: 0 },
}

describe('planItems', () => {
  const items = planItems(plan, trip, 'plan-1')
  it('adds one stay for consecutive nights and every timed item', () => {
    expect(items.map((i) => i.kind)).toEqual(['lodging', 'flight', 'free', 'flight'])
    expect(items[0]).toMatchObject({ title: 'Club House Roma', start_local: '2027-02-24T15:00', end_local: '2027-02-27T11:00', status: 'tentative' })
  })
  it('moves an overnight end to the next day', () => {
    expect(items[1]).toMatchObject({ start_local: '2027-02-24T22:00', end_local: '2027-02-25T06:30' })
  })
  it('links saved places and prices each offer once', () => {
    expect(items[2]!.place_id).toBe('place-1')
    expect(items.map((i) => i.est_cost_minor)).toEqual([99875, 94282, null, null])
  })
  it('uses stable ids so adding twice cannot duplicate', () => {
    expect(planItems(plan, trip, 'plan-1').map((i) => i.id)).toEqual(items.map((i) => i.id))
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
  })
})
