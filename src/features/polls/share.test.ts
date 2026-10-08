import { describe, expect, it } from 'vitest'
import type { Poll, PollOption } from '@/data/types'
import { dateRangeLabel, deadlineFor, tonightAvailable } from './deadline'
import { scoreLabels, voterCount, votingEnded } from './rank'
import { closesLabel, shareText } from './share'

const zone = 'America/Chicago'
// Tuesday 5 Jan 2027, 2:00 PM in Chicago.
const now = Date.parse('2027-01-05T20:00:00Z')
const poll = (over: Partial<Poll> = {}): Poll => ({ id: 'p', trip_id: 't', title: 'Where do we stay?', description: null, status: 'open', winner_option_id: null, ...over })
const opt = (id: string, over: Partial<PollOption> = {}): PollOption => ({ id, trip_id: 't', poll_id: 'p', label: id, place_id: null, url: null, description: null, ...over })

describe('votingEnded', () => {
  it('is true once closed or once the deadline has passed', () => {
    expect(votingEnded(poll(), now)).toBe(false)
    expect(votingEnded(poll({ status: 'closed' }), now)).toBe(true)
    expect(votingEnded(poll({ closes_at: '2027-01-05T20:00:01Z' }), now)).toBe(false)
    expect(votingEnded(poll({ closes_at: '2027-01-05T20:00:00Z' }), now)).toBe(true)
  })
  it('treats rows saved before deadlines existed as having none', () => {
    const old = poll()
    delete old.closes_at
    expect(votingEnded(old, now)).toBe(false)
  })
})

describe('shareText', () => {
  it('names the vote, its options and when it closes', () => {
    expect(shareText(poll({ closes_at: '2027-01-09T00:00:00Z' }), [opt('a'), opt('b'), opt('gone', { deleted_at: '2027-01-01' })], now, zone))
      .toBe('Vote: “Where do we stay?” · 2 options · closes Fri 6:00 PM')
    expect(shareText(poll(), [opt('a')], now, zone)).toBe('Vote: “Where do we stay?” · 1 option')
    expect(shareText(poll(), [], now, zone)).toBe('Vote: “Where do we stay?”')
  })
  it('announces the winner once voting has ended', () => {
    expect(shareText(poll({ status: 'closed', winner_option_id: 'b' }), [opt('a'), opt('b', { label: 'Casa del Mundo' })], now, zone)).toBe('Decided: Casa del Mundo (Where do we stay?)')
    expect(shareText(poll({ status: 'closed' }), [opt('a')], now, zone)).toBe('Voting has ended: Where do we stay?')
  })
})

describe('closesLabel', () => {
  it('uses today, tomorrow, a weekday, then a date', () => {
    expect(closesLabel('2027-01-06T03:00:00Z', now, zone)).toBe('today 9:00 PM')
    expect(closesLabel('2027-01-06T20:00:00Z', now, zone)).toBe('tomorrow 2:00 PM')
    expect(closesLabel('2027-01-09T00:00:00Z', now, zone)).toBe('Fri 6:00 PM')
    expect(closesLabel('2027-01-20T18:00:00Z', now, zone)).toBe('Wed, Jan 20 12:00 PM')
  })
})

describe('deadlineFor', () => {
  it('turns each choice into an instant', () => {
    expect(deadlineFor('none', now, zone)).toBeNull()
    expect(deadlineFor('tonight', now, zone)).toBe('2027-01-06T03:00:00.000Z')
    expect(deadlineFor('day', now, zone)).toBe('2027-01-06T20:00:00.000Z')
    expect(deadlineFor('three', now, zone)).toBe('2027-01-08T20:00:00.000Z')
    expect(deadlineFor('custom', now, zone, '2027-01-07T18:30')).toBe('2027-01-08T00:30:00.000Z')
  })
  it('rejects a custom time that is missing, invalid or already past', () => {
    expect(deadlineFor('custom', now, zone, '')).toBeUndefined()
    expect(deadlineFor('custom', now, zone, 'soon')).toBeUndefined()
    expect(deadlineFor('custom', now, zone, '2027-01-05T13:00')).toBeUndefined()
  })
  it('stops offering tonight when 9 PM is under an hour away', () => {
    expect(tonightAvailable(now, zone)).toBe(true)
    expect(tonightAvailable(Date.parse('2027-01-06T02:30:00Z'), zone)).toBe(false)
  })
  it('keeps "in 3 days" at the same wall-clock time across the US clock change', () => {
    // 12 Mar 2027 2:00 PM CST; clocks spring forward on the 14th.
    expect(deadlineFor('three', Date.parse('2027-03-12T20:00:00Z'), zone)).toBe('2027-03-15T19:00:00.000Z')
  })
})

describe('dateRangeLabel', () => {
  it('formats single days and ranges', () => {
    expect(dateRangeLabel('2027-03-13', null)).toBe('Sat, Mar 13')
    expect(dateRangeLabel('2027-03-13', '2027-03-13')).toBe('Sat, Mar 13')
    expect(dateRangeLabel('2027-03-13', '2027-03-20')).toBe('Mar 13 – 20')
    expect(dateRangeLabel('2027-03-28', '2027-04-03')).toBe('Mar 28 – Apr 3')
    expect(dateRangeLabel('2026-12-28', '2027-01-03')).toBe('Dec 28, 2026 – Jan 3, 2027')
  })
})

describe('date votes', () => {
  it('reads the four scores as availability', () => {
    expect(scoreLabels('dates')[0]).toBe('Can’t')
    expect(scoreLabels('options')[0]).toBe('No way')
    expect(scoreLabels(undefined)[3]).toBe('Must-do')
  })
  it('counts people, not votes', () => {
    const v = (option: string, member: string, score: 0 | 1 | 2 | 3 | null) => ({ id: `${option}${member}`, trip_id: 't', poll_id: 'p', option_id: option, member_id: member, score })
    expect(voterCount([v('a', 'm1', 3), v('b', 'm1', 0), v('a', 'm2', null), v('a', 'm3', 1)])).toBe(2)
  })
})
