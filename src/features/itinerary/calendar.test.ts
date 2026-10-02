import { describe, expect, it } from 'vitest'
import type { ItineraryItem, Member, Place } from '@/data/types'
import { itemEvent, itemsFor, planIcs } from './calendar'

const TRIP = 'trip-1'
const item = (over: Partial<ItineraryItem>): ItineraryItem => ({
  id: 'i1', trip_id: TRIP, title: 'Coffee tour', kind: 'activity', place_id: null, to_place_id: null, all_day: false,
  start_local: '2027-03-15T09:00', start_tz: 'America/Guatemala', end_local: '2027-03-15T11:00', end_tz: 'America/Guatemala',
  start_at: '2027-03-15T15:00:00Z', end_at: '2027-03-15T17:00:00Z', status: 'confirmed', confirmation_code: null,
  attendee_ids: null, details: {}, notes: null, est_cost_minor: null, est_cost_currency: null, ...over,
})
const place = (id: string, name: string, over: Partial<Place> = {}) => ({ id, trip_id: TRIP, name, address: null, area: 'Antigua', lat: 14.5, lng: -90.7, ...over }) as Place
const members = [{ id: 'ana', display_name: 'Ana' }, { id: 'ben', display_name: 'Ben' }] as Member[]

describe('itemsFor', () => {
  const items = [
    item({ id: 'all' }),
    item({ id: 'ana-only', attendee_ids: ['ana'] }),
    item({ id: 'ben-only', attendee_ids: ['ben'] }),
    item({ id: 'cancelled', status: 'cancelled' }),
    item({ id: 'removed', deleted_at: '2027-03-01T00:00:00Z' }),
  ]

  it("keeps everyone-items and the person's own, and drops cancelled and removed ones", () => {
    expect(itemsFor(items, 'ana').map((i) => i.id)).toEqual(['all', 'ana-only'])
  })

  it('keeps every live item when the phone has no member yet', () => {
    expect(itemsFor(items, null).map((i) => i.id)).toEqual(['all', 'ana-only', 'ben-only'])
  })
})

describe('itemEvent', () => {
  it('uses the stored instants, the place and a link back to the plan', () => {
    const e = itemEvent(item({ place_id: 'p1', confirmation_code: 'K7XQ2P', attendee_ids: ['ben'], notes: 'Bring cash', updated_at: '2027-03-01T00:00:00Z' }), [place('p1', 'Finca Filadelfia')], members, 'https://app.test')
    expect(e).toMatchObject({
      uid: 'i1@stowaway', allDay: false, start: '2027-03-15T15:00:00Z', end: '2027-03-15T17:00:00Z',
      location: 'Finca Filadelfia, Antigua', geo: { lat: 14.5, lng: -90.7 }, url: 'https://app.test/t/trip-1/plan/i1',
      tentative: false, updatedAt: '2027-03-01T00:00:00Z',
    })
    expect(e.description).toBe('Activity\nConfirmation: K7XQ2P\nGoing: Ben\nBring cash')
  })

  it('shows both ends of a flight and pins the departure', () => {
    const e = itemEvent(item({ kind: 'flight', place_id: 'ord', to_place_id: 'gua', status: 'tentative' }), [place('ord', "O'Hare", { area: 'Chicago', lat: 41.97, lng: -87.9 }), place('gua', 'La Aurora', { area: 'Guatemala City' })], members, '')
    expect(e.location).toBe("O'Hare, Chicago → La Aurora, Guatemala City")
    expect(e.geo).toEqual({ lat: 41.97, lng: -87.9 })
    expect(e.tentative).toBe(true)
  })

  it('puts stays and all-day items on the calendar as dates', () => {
    const stay = itemEvent(item({ kind: 'lodging', start_local: '2027-03-15T15:00', end_local: '2027-03-18T11:00' }), [], members, '')
    expect(stay).toMatchObject({ allDay: true, start: '2027-03-15', end: '2027-03-18' })
    const day = itemEvent(item({ all_day: true, start_local: '2027-03-16T00:00', end_local: null, end_at: null }), [], members, '')
    expect(day).toMatchObject({ allDay: true, start: '2027-03-16', end: null })
  })

  it('ignores a place that was removed', () => {
    expect(itemEvent(item({ place_id: 'p1' }), [place('p1', 'Gone', { deleted_at: '2027-01-01T00:00:00Z' })], members, '').location).toBeNull()
  })
})

describe('planIcs', () => {
  it('produces one event per item', () => {
    const ics = planIcs([item({ id: 'a' }), item({ id: 'b' })], [], members, 'Guatemala', 'https://app.test', '2027-03-01T00:00:00Z')
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('UID:a@stowaway')
    expect(ics).toContain('X-WR-CALNAME:Guatemala')
  })
})
