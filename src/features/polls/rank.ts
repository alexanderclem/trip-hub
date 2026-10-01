// Score voting: each person gives each option 0 No way · 1 Fine · 2 Want · 3 Must-do, or skips.
// Chosen over ranked choice because options get added mid-poll (nobody has to re-rank), it
// captures how strongly people feel, and it's four big buttons on a phone.

import type { PlaceRating, PollOption, PollVote, VoteScore } from '@/data/types'

export const SCORE_LABEL: Record<VoteScore, string> = { 0: 'No way', 1: 'Fine', 2: 'Want', 3: 'Must-do' }

export interface RankedOption {
  option: PollOption
  mean: number | null // null when nobody has voted
  voters: number
  counts: [number, number, number, number] // votes per score 0..3
  needsVotes: boolean // fewer than half the group has voted on it
}

/** Votes that count: live rows with a score. */
const counted = (v: PollVote) => !v.deleted_at && v.score != null

export function rankOptions(options: PollOption[], votes: PollVote[], groupSize: number): RankedOption[] {
  const quorum = Math.ceil(groupSize / 2)
  const ranked = options
    .filter((o) => !o.deleted_at)
    .map((option): RankedOption => {
      const mine = votes.filter((v) => v.option_id === option.id && counted(v))
      const counts: RankedOption['counts'] = [0, 0, 0, 0]
      for (const v of mine) counts[v.score!]++
      const voters = mine.length
      const mean = voters ? mine.reduce((a, v) => a + v.score!, 0) / voters : null
      return { option, mean, voters, counts, needsVotes: voters < quorum }
    })
  return ranked.sort(
    (a, b) =>
      Number(a.needsVotes) - Number(b.needsVotes) ||
      (b.mean ?? -1) - (a.mean ?? -1) ||
      a.counts[0] - b.counts[0] ||
      b.voters - a.voters ||
      a.option.label.localeCompare(b.option.label),
  )
}

/** The top option, if it has quorum and at least one vote. */
export function leader(ranked: RankedOption[]): RankedOption | null {
  const top = ranked[0]
  return top && !top.needsVotes && top.mean != null ? top : null
}

export interface RatingSummary {
  average: number | null
  count: number
}

export function summarizeRatings(ratings: PlaceRating[]): RatingSummary {
  const live = ratings.filter((r) => !r.deleted_at && r.stars != null)
  if (!live.length) return { average: null, count: 0 }
  return { average: live.reduce((a, r) => a + r.stars!, 0) / live.length, count: live.length }
}
