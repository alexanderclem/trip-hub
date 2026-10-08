import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { save } from '@/data/repo'
import type { PlaceRating, Poll, PollKind, PollOption, PollVote, VoteScore } from '@/data/types'
import { dateRangeLabel } from './deadline'
import { newId, stableId } from '@/lib/ids'
import { summarizeRatings, type RatingSummary } from './rank'

const alive = <T extends { deleted_at?: string | null }>(r: T) => !r.deleted_at

// ── Reads ──────────────────────────────────────────────────────────────────

export function usePolls(tripId: string) {
  return useLiveQuery(async () => {
    const [polls, options, votes] = await Promise.all([
      db.polls.where('trip_id').equals(tripId).filter(alive).toArray(),
      db.poll_options.where('trip_id').equals(tripId).filter(alive).toArray(),
      db.poll_votes.where('trip_id').equals(tripId).filter(alive).toArray(),
    ])
    return polls
      .sort((a, b) => Number(a.status === 'closed') - Number(b.status === 'closed') || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .map((poll) => ({
        poll,
        options: options.filter((o) => o.poll_id === poll.id),
        votes: votes.filter((v) => v.poll_id === poll.id),
      }))
  }, [tripId])
}

export function usePoll(pollId: string) {
  return useLiveQuery(async () => {
    const poll = await db.polls.get(pollId)
    if (!poll) return null
    const [options, votes] = await Promise.all([
      db.poll_options.where('poll_id').equals(pollId).filter(alive).toArray(),
      db.poll_votes.where('poll_id').equals(pollId).filter(alive).toArray(),
    ])
    return { poll, options, votes }
  }, [pollId])
}

/** Open polls and which of them already include this place. */
export function usePollsForPlace(tripId: string, placeId: string) {
  return useLiveQuery(async () => {
    const [polls, options] = await Promise.all([
      db.polls.where('trip_id').equals(tripId).filter(alive).toArray(),
      db.poll_options.where('place_id').equals(placeId).filter(alive).toArray(),
    ])
    const inPolls = new Set(options.map((o) => o.poll_id))
    return polls.map((poll) => ({ poll, includesPlace: inPolls.has(poll.id) }))
  }, [tripId, placeId])
}

export function usePlaceRatings(placeId: string | undefined) {
  return useLiveQuery(
    async () => (placeId ? db.place_ratings.where('place_id').equals(placeId).filter(alive).toArray() : []),
    [placeId],
  )
}

/** Group rating per place, for lists and map cards. */
export function useRatingSummaries(tripId: string): Map<string, RatingSummary> | undefined {
  return useLiveQuery(async () => {
    const all = await db.place_ratings.where('trip_id').equals(tripId).filter(alive).toArray()
    const byPlace = new Map<string, PlaceRating[]>()
    for (const r of all) byPlace.set(r.place_id, [...(byPlace.get(r.place_id) ?? []), r])
    return new Map([...byPlace].map(([id, rs]) => [id, summarizeRatings(rs)]))
  }, [tripId])
}

// ── Writes ─────────────────────────────────────────────────────────────────

export async function createPoll(
  tripId: string, title: string, description: string, memberId: string | null,
  extra: { kind?: PollKind; closesAt?: string | null } = {},
): Promise<string> {
  const poll: Poll = {
    id: newId(), trip_id: tripId, title: title.trim(), description: description.trim() || null, status: 'open', winner_option_id: null,
    kind: extra.kind ?? 'options', closes_at: extra.closesAt ?? null,
  }
  await save('polls', poll, memberId)
  return poll.id
}

export async function addOption(
  poll: Poll,
  option: { label: string; placeId?: string | null; url?: string | null; description?: string | null },
  memberId: string | null,
): Promise<void> {
  const row: PollOption = {
    // A place can only appear once per poll, even if two phones add it at the same time.
    id: optionId(poll, option.placeId),
    trip_id: poll.trip_id,
    poll_id: poll.id,
    label: option.label.trim(),
    place_id: option.placeId ?? null,
    url: option.url?.trim() || null,
    description: option.description?.trim() || null,
  }
  await save('poll_options', row, memberId)
}

const optionId = (poll: Poll, placeId?: string | null) => (placeId ? stableId(poll.trip_id, 'option', poll.id, placeId) : newId())

/** Adds a day or a range of days to a date vote. The same dates from two phones are one option. */
export async function addDateOption(poll: Poll, startsOn: string, endsOn: string | null, memberId: string | null): Promise<void> {
  const last = endsOn && endsOn !== startsOn ? endsOn : null
  const id = stableId(poll.trip_id, 'option', poll.id, 'dates', startsOn, last ?? startsOn)
  // Removals are permanent on the server, so the same row can't come back.
  if ((await db.poll_options.get(id))?.deleted_at) throw new Error('Those dates were removed from this vote and can’t be added again.')
  const row: PollOption = {
    id,
    trip_id: poll.trip_id,
    poll_id: poll.id,
    label: dateRangeLabel(startsOn, last),
    place_id: null,
    url: null,
    description: null,
    starts_on: startsOn,
    ends_on: last ?? startsOn,
  }
  await save('poll_options', row, memberId)
}

/** Sets (or clears, with null) one person's vote on one option. */
export async function vote(option: PollOption, memberId: string, score: VoteScore | null): Promise<void> {
  const row: PollVote = {
    id: stableId(option.trip_id, 'vote', option.id, memberId),
    trip_id: option.trip_id,
    poll_id: option.poll_id,
    option_id: option.id,
    member_id: memberId,
    score,
  }
  await save('poll_votes', row, memberId)
}

/** Sets (or withdraws, with stars null) one person's rating of a place. */
export async function rate(tripId: string, placeId: string, memberId: string, stars: number | null, note: string | null): Promise<void> {
  const row: PlaceRating = {
    id: stableId(tripId, 'rating', placeId, memberId),
    trip_id: tripId,
    place_id: placeId,
    member_id: memberId,
    stars,
    note: note?.trim() || null,
  }
  await save('place_ratings', row, memberId)
}
