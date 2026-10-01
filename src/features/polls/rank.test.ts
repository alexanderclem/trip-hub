import { describe, expect, it } from 'vitest'
import type { PlaceRating, PollOption, PollVote, VoteScore } from '@/data/types'
import { leader, rankOptions, summarizeRatings } from './rank'

const opt = (id: string, label = id): PollOption => ({ id, trip_id: 't', poll_id: 'p', label, place_id: null, url: null, description: null })
const vote = (option: string, member: string, score: VoteScore | null, deleted = false): PollVote => ({
  id: `${option}-${member}`, trip_id: 't', poll_id: 'p', option_id: option, member_id: member, score, deleted_at: deleted ? '2027-01-01' : null,
})

describe('rankOptions', () => {
  it('ranks by mean score', () => {
    const r = rankOptions([opt('a'), opt('b')], [vote('a', 'm1', 1), vote('a', 'm2', 1), vote('b', 'm1', 3), vote('b', 'm2', 2)], 2)
    expect(r.map((x) => x.option.id)).toEqual(['b', 'a'])
    expect(r[0]).toMatchObject({ mean: 2.5, voters: 2, counts: [0, 0, 1, 1], needsVotes: false })
  })

  it('on equal means, fewer "No way" votes wins', () => {
    // a: 3,0 (mean 1.5, one veto) vs b: 2,1 (mean 1.5, no veto)
    const r = rankOptions([opt('a'), opt('b')], [vote('a', 'm1', 3), vote('a', 'm2', 0), vote('b', 'm1', 2), vote('b', 'm2', 1)], 2)
    expect(r.map((x) => x.option.id)).toEqual(['b', 'a'])
  })

  it('then more voters wins', () => {
    const r = rankOptions([opt('a'), opt('b')], [vote('a', 'm1', 2), vote('b', 'm1', 2), vote('b', 'm2', 2)], 2)
    expect(r.map((x) => x.option.id)).toEqual(['b', 'a'])
  })

  it('options below quorum (half the group) sort after those with enough votes', () => {
    // 8 people: quorum 4. "hidden gem" has one Must-do; "popular" has four Fine.
    const votes = [vote('gem', 'm1', 3), ...['m1', 'm2', 'm3', 'm4'].map((m) => vote('popular', m, 1))]
    const r = rankOptions([opt('gem'), opt('popular')], votes, 8)
    expect(r.map((x) => [x.option.id, x.needsVotes])).toEqual([['popular', false], ['gem', true]])
    expect(leader(r)?.option.id).toBe('popular')
  })

  it('ignores withdrawn (null) and deleted votes', () => {
    const r = rankOptions([opt('a')], [vote('a', 'm1', null), vote('a', 'm2', 3, true), vote('a', 'm3', 2)], 1)
    expect(r[0]).toMatchObject({ voters: 1, mean: 2 })
  })

  it('ignores deleted options; no votes means no leader', () => {
    const r = rankOptions([opt('a'), { ...opt('b'), deleted_at: 'x' }], [], 4)
    expect(r.map((x) => x.option.id)).toEqual(['a'])
    expect(r[0]!.mean).toBeNull()
    expect(leader(r)).toBeNull()
  })
})

describe('summarizeRatings', () => {
  const rating = (stars: number | null, deleted = false): PlaceRating => ({
    id: String(Math.random()), trip_id: 't', place_id: 'p', member_id: 'm', stars, note: null, deleted_at: deleted ? 'x' : null,
  })
  it('averages live ratings with stars', () => {
    expect(summarizeRatings([rating(5), rating(4), rating(null), rating(1, true)])).toEqual({ average: 4.5, count: 2 })
  })
  it('handles no ratings', () => {
    expect(summarizeRatings([])).toEqual({ average: null, count: 0 })
  })
})
