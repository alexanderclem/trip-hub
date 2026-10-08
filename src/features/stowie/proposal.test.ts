import { describe, expect, it } from 'vitest'
import type { Member, Trip } from '@/data/types'
import type { AssistReply } from '@/features/discovery/model'
import { describeProposal, toProposal } from './proposal'
import { screenOf } from './screen'

const trip = { id: 't', name: 'Guatemala', timezone: 'America/Guatemala', start_date: '2027-03-13', end_date: '2027-03-21', base_currency: 'USD' } as Trip
const members = [{ id: 'alex', trip_id: 't', display_name: 'Alex' }, { id: 'sam', trip_id: 't', display_name: 'Sam' }] as Member[]
const reply = (over: Partial<AssistReply>): AssistReply => ({ reply: 'ok', action: 'none', title: null, date: null, time: null, durationMinutes: null, assignee: null, options: [], ...over })
const propose = (over: Partial<AssistReply>) => toProposal(reply(over), trip, members, 'alex')

describe('checking what the model offers to add', () => {
  it('offers nothing when it only answered, or left out the title', () => {
    expect(propose({})).toBeNull()
    expect(propose({ action: 'task', title: '  ' })).toBeNull()
  })
  it('assigns tasks only to people in the trip, and keeps only real dates', () => {
    expect(propose({ action: 'task', title: 'Book the shuttle', assignee: 'sam', date: '2027-03-01' })).toEqual({ kind: 'task', title: 'Book the shuttle', assigneeId: 'sam', assignee: 'Sam', dueDate: '2027-03-01' })
    expect(propose({ action: 'task', title: 'Call the hotel', assignee: 'me', date: 'next Friday' })).toEqual({ kind: 'task', title: 'Call the hotel', assigneeId: 'alex', assignee: 'Alex', dueDate: null })
    expect(propose({ action: 'task', title: 'Buy sunscreen', assignee: 'Jordan', date: '2027-02-30' })).toMatchObject({ assigneeId: null, assignee: null, dueDate: null })
  })
  it('puts packing on the group list unless it is theirs', () => {
    expect(propose({ action: 'packing', title: 'Snorkel' })).toEqual({ kind: 'packing', title: 'Snorkel', personal: false })
    expect(propose({ action: 'packing', title: 'Passport', assignee: 'Alex' })).toMatchObject({ personal: true })
  })
  it('refuses a plan item without a date inside the trip, and tolerates a bad time', () => {
    expect(propose({ action: 'item', title: 'Sunset hike', date: null })).toBeNull()
    expect(propose({ action: 'item', title: 'Sunset hike', date: '2027-04-02', time: '17:00' })).toBeNull()
    expect(propose({ action: 'item', title: 'Sunset hike', date: '2027-03-15', time: '5pm' })).toEqual({ kind: 'item', title: 'Sunset hike', date: '2027-03-15', time: null, durationMinutes: 60 })
    const timed = propose({ action: 'item', title: 'Sunset hike', date: '2027-03-15', time: '17:00', durationMinutes: 90 })!
    expect(describeProposal(timed)).toEqual({ heading: 'Add a tentative plan item', title: 'Sunset hike', details: ['Mon 15 Mar 2027', '17:00–18:30'] })
  })
  it('needs two different options for a vote', () => {
    expect(propose({ action: 'vote', title: 'Dinner?', options: ['Tacos', 'tacos '] })).toBeNull()
    expect(propose({ action: 'vote', title: 'Dinner?', options: ['Tacos', 'Pizza', 'Tacos'] })).toEqual({ kind: 'vote', title: 'Dinner?', options: ['Tacos', 'Pizza'] })
  })
})

describe('where Stowie appears', () => {
  it('knows the screen it is over', () => {
    expect(screenOf('/t/abc/plan')).toEqual({ screen: 'plan' })
    expect(screenOf('/t/abc/plan/item-1')).toEqual({ screen: 'plan' })
    expect(screenOf('/t/abc/more/places/p1')).toEqual({ screen: 'place', placeId: 'p1' })
    expect(screenOf('/t/abc/more/vote/v1')).toEqual({ screen: 'votes' })
    expect(screenOf('/t/abc/money/')).toEqual({ screen: 'money' })
  })
  it('stays away from forms, tickets being viewed, emergency cards and its own page', () => {
    for (const path of ['/t/abc/plan/new', '/t/abc/plan/item-1/edit', '/t/abc/tickets/new', '/t/abc/tickets/t1', '/t/abc/money/new', '/t/abc/money/e1', '/t/abc/more/tasks/new', '/t/abc/more/places/new', '/t/abc/more/places/p1/edit', '/t/abc/more/emergency', '/t/abc/more/emergency/me', '/t/abc/more/ideas', '/t/abc/more/ideas/manual', '/t/abc/more/settings', '/t/abc/wrapped', '/inspire', '/app']) {
      expect(screenOf(path), path).toBeNull()
    }
  })
})
