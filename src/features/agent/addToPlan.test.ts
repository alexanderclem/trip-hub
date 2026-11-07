import { describe, expect, it } from 'vitest'
import { planItems, planPlaces } from './addToPlan'
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
  it('keeps each end of a flight in its own airport zone when the plan says so', () => {
    const withEnds: FinalPlan = { ...plan, days: [{ date: '2027-02-23', stay: null, items: [{ node: 0, kind: 'flight', title: 'UA1 SEA→FCO', start: '13:00', end: '09:30', ref: 'F1', routed: false,
      depart: { local: '2027-02-23T13:00', zone: 'America/Los_Angeles', airport: 'SEA' }, arrive: { local: '2027-02-24T09:30', zone: 'Europe/Rome', airport: 'FCO' } }] }] }
    expect(planItems(withEnds, trip, 'plan-2')[0]).toMatchObject({ start_local: '2027-02-23T13:00', start_tz: 'America/Los_Angeles', end_local: '2027-02-24T09:30', end_tz: 'Europe/Rome', est_cost_minor: 94282 })
  })
  it('uses stable ids so adding twice cannot duplicate', () => {
    expect(planItems(plan, trip, 'plan-1').map((i) => i.id)).toEqual(items.map((i) => i.id))
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
  })
})

describe('planPlaces', () => {
  const located = { ...stay, hotelId: 'lp1', lat: 41.89, lng: 12.47 }
  const withPins: FinalPlan = { ...plan, days: [
    { date: '2027-02-24', stay: located, items: [] },
    { date: '2027-02-25', stay: located, items: [
      { node: 3, kind: 'activity', title: 'Colosseum tour', start: '09:00', end: '11:00', ref: 'S1', routed: true, product: 'P9', lat: 41.89, lng: 12.49 },
      { node: 4, kind: 'activity', title: 'Food walk', start: '18:00', end: '20:00', ref: 'S2', routed: true, product: 'P10', lat: null, lng: null },
    ] },
  ] }
  it('creates one pinned place per hotel and per located tour, and links the plan items', () => {
    const { links, places } = planPlaces(withPins, trip, [], 'Rome')
    expect(places.map((p) => [p.name, p.category, p.lat, p.status, p.source])).toEqual([['Club House Roma', 'lodging', 41.89, 'planned', 'suggestion'], ['Colosseum tour', 'activity', 41.89, 'planned', 'suggestion']])
    const items = planItems(withPins, trip, 'plan-3', links)
    expect(items.find((i) => i.kind === 'lodging')!.place_id).toBe(places[0]!.id)
    expect(items.find((i) => i.title === 'Colosseum tour')!.place_id).toBe(places[1]!.id)
    expect(items.find((i) => i.title === 'Food walk')!.place_id).toBeNull()
    expect(items.every((i) => i.notes === null && i.details.live_plan_id === 'plan-3')).toBe(true)
  })
  it('reuses a place the trip already has with that name', () => {
    const known = { id: 'mine', trip_id: trip.id, name: 'Hotel Club House Roma', category: 'lodging' as const, tags: [], lat: 41.9, lng: 12.5, address: null, area: null, status: 'shortlist' as const, notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' as const }
    const { links, places } = planPlaces(withPins, trip, [known])
    expect(links.get('stay:H1')).toBe('mine')
    expect(places.map((p) => p.name)).toEqual(['Colosseum tour'])
  })
})
