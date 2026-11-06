import type { Member, PollOption, PollVote } from '@/data/types'

/** Every live option needs an explicit score, including zero. Ignore removed/former members. */
export function travelersStillVoting(options: PollOption[], votes: PollVote[], members: Member[]) {
  const live = options.filter((option) => !option.deleted_at)
  if (!live.length) return []
  const scored = new Set(votes.filter((vote) => !vote.deleted_at && vote.score != null).map((vote) => `${vote.member_id}:${vote.option_id}`))
  return members.filter((member) => !member.deleted_at && live.some((option) => !scored.has(`${member.id}:${option.id}`)))
}

/** One line on where a vote stands with the group, phrased for the person reading it. */
export function voteStatus(options: PollOption[], votes: PollVote[], members: Member[], me: string | null) {
  const waiting = travelersStillVoting(options, votes, members)
  if (!options.length) return 'Add options so everyone can vote'
  if (!members.length) return 'Invite the group to start deciding'
  if (!waiting.length) return 'Everyone’s voted · ready to decide'
  if (waiting.length === 1 && waiting[0]?.id === me) return 'Your vote is still needed'
  if (waiting.length <= 2) return `Waiting on ${waiting.map((member) => member.id === me ? 'you' : member.display_name).join(' and ')}`
  return `${waiting.length} travelers still need to vote`
}
