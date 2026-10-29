import type { Member, PollOption, PollVote } from '@/data/types'

/** Every live option needs an explicit score, including zero. Ignore removed/former members. */
export function travelersStillVoting(options: PollOption[], votes: PollVote[], members: Member[]) {
  const live = options.filter((option) => !option.deleted_at)
  if (!live.length) return []
  const scored = new Set(votes.filter((vote) => !vote.deleted_at && vote.score != null).map((vote) => `${vote.member_id}:${vote.option_id}`))
  return members.filter((member) => !member.deleted_at && live.some((option) => !scored.has(`${member.id}:${option.id}`)))
}
