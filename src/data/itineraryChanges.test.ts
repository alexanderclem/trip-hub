import { describe, expect, it } from 'vitest'
import type { ItineraryItem } from './types'
import { planChanges, recordPlanChange } from './itineraryChanges'
import { buildFeed, type FeedRows } from '@/features/activity/feed'

const original = { id: 'dinner', trip_id: 'trip', title: 'Dinner', start_local: '2027-05-01T19:00', start_at: '2027-05-01T23:00:00.000Z', start_tz: 'America/New_York', end_at: null, end_tz: null, all_day: false, status: 'confirmed', attendee_ids: null, place_id: null, to_place_id: null, notes: null, details: {}, created_at: '2027-04-01T12:00:00Z' } as ItineraryItem
describe('itinerary change records', () => {
  it('records old and new values, retaining the original event time after later edits', () => {
    const moved = recordPlanChange(original, { ...original, start_local: '2027-05-01T20:00', start_at: '2027-05-02T00:00:00.000Z' }, 'sam', '2027-04-02T12:00:00Z', 'move')
    const first = planChanges(moved)[0]!
    expect(first.text).toBe('moved “Dinner” from 1 May 2027, 19:00 EDT to 1 May 2027, 20:00 EDT')
    const edited = recordPlanChange(moved, { ...moved, notes: 'Meet outside' }, 'alex', '2027-04-03T12:00:00Z', 'notes')
    expect(planChanges(edited)[0]).toEqual(first)
    expect(planChanges(edited)[1]!.by).toBe('alex')
    const rows: FeedRows = { members: [], polls: [], options: [], places: [], items: [edited], expenses: [], settlements: [], ratings: [], tasks: [], attachments: [], comments: [] }
    const feed = buildFeed(rows)
    expect(feed.filter(e => e.kind === 'item-change').map(e => e.at)).toEqual(['2027-04-03T12:00:00Z', '2027-04-02T12:00:00Z'])
    expect(feed.filter(e => e.kind === 'item-status')).toEqual([])
  })
  it('ignores unchanged saves and attendee ordering, and handles old or malformed details', () => {
    expect(recordPlanChange(original, { ...original }, 'sam', '2027-04-02T12:00:00Z', 'same')).toEqual(original)
    const people = { ...original, attendee_ids: ['alex', 'sam'] }
    expect(planChanges(recordPlanChange(people, { ...people, attendee_ids: ['sam', 'alex'] }, 'sam', '2027-04-02T12:00:00Z', 'same'))).toEqual([])
    expect(planChanges({ details: { stowaway_changes_v1: 'broken' } })).toEqual([])
    expect(planChanges({ details: { stowaway_changes_v1: '[{"id":"bad"}]' } })).toEqual([])
    const server = { ...original, start_at: '2027-05-01T23:00:00+00:00' }
    expect(planChanges(recordPlanChange(server, original, 'sam', '2027-04-02T12:00:00Z', 'format-only'))).toEqual([])
  })
  it('keeps removal records visible even after the item is deleted', () => {
    const removed = recordPlanChange(original, { ...original, deleted_at: '2027-04-02T12:00:00Z' }, 'sam', '2027-04-02T12:00:00Z', 'remove')
    const rows: FeedRows = { members: [], polls: [], options: [], places: [], items: [removed], expenses: [], settlements: [], ratings: [], tasks: [], attachments: [], comments: [] }
    expect(buildFeed(rows)[0]).toMatchObject({ kind: 'item-change', text: 'removed “Dinner” from the itinerary', to: 'plan', by: 'sam' })
  })
})
