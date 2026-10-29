import { describe, expect, it } from 'vitest'
import type { Member, PollOption, PollVote } from '@/data/types'
import { travelersStillVoting } from './decisions'

const members = [{ id: 'alex' }, { id: 'maya' }, { id: 'former', deleted_at: '2026-01-01' }] as Member[]
const options = [{ id: 'a' }, { id: 'b' }, { id: 'removed', deleted_at: '2026-01-01' }] as PollOption[]
describe('group decision summaries', () => {
  it('requires a score on each live option; zero is a completed vote', () => {
    const votes = [{ member_id: 'alex', option_id: 'a', score: 0 }, { member_id: 'alex', option_id: 'b', score: 2 }, { member_id: 'maya', option_id: 'a', score: 3 }] as PollVote[]
    expect(travelersStillVoting(options, votes, members).map((member) => member.id)).toEqual(['maya'])
  })
  it('counts people once, ignoring withdrawn and deleted votes and former members', () => {
    const votes = [{ member_id: 'alex', option_id: 'a', score: null }, { member_id: 'alex', option_id: 'b', score: 3, deleted_at: '2026-01-01' }] as PollVote[]
    expect(travelersStillVoting(options, votes, members).map((member) => member.id)).toEqual(['alex', 'maya'])
  })
  it('does not claim that people can vote before options exist', () => {
    expect(travelersStillVoting([], [], members)).toEqual([])
    expect(travelersStillVoting(options.filter((option) => option.deleted_at), [], members)).toEqual([])
  })
})
