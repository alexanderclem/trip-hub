import { useMyMemberId } from '@/data/device'
import { Link } from 'react-router'
import { ArrowRight, CheckCircle2, ClipboardCheck, Vote } from 'lucide-react'
import type { Member } from '@/data/types'
import type { usePolls } from '@/features/polls/data'
import { votingEnded } from '@/features/polls/rank'
import { Row, SectionTitle } from '@/ui'
import { useItems } from '@/features/itinerary/data'
import { useAttachments } from '@/features/tickets/files'
import { decisionItem } from '@/features/polls/handoff'
import { travelersStillVoting } from './decisions'

export function GroupDecisions({ tripId, polls, members, unassigned, now }: {
  tripId: string; polls: NonNullable<ReturnType<typeof usePolls>>; members: Member[]; unassigned: number; now: number
}) {
  const me = useMyMemberId(tripId)
  const open = polls.filter(({ poll }) => !votingEnded(poll, now))
  const items = useItems(tripId)
  const attachments = useAttachments(tripId)
  const followUp = items && attachments ? polls.filter(({ poll, options }) => {
    if (poll.status !== 'closed' || poll.kind === 'dates') return false
    const option = options.find((o) => o.id === poll.winner_option_id)
    if (!option) return false
    const item = decisionItem(items, poll, option)
    return !item || item.status !== 'confirmed' || !(item.details?.decision_booking === 'not_required' || item.confirmation_code || attachments.some((a) => a.att.item_id === item.id))
  }) : []
  if (!open.length && !followUp.length && !unassigned) return null
  const root = `/t/${tripId}/more`
  return <section aria-labelledby="group-decisions-title" className="group-decisions">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><SectionTitle id="group-decisions-title">Group decisions</SectionTitle></div><Link to={`${root}/vote`} className="ui-link">All votes<ArrowRight aria-hidden="true" className="size-4" /></Link></div>
    <ul className="ui-row-group">{open.slice(0, 3).map(({ poll, options, votes }) => {
      const waiting = travelersStillVoting(options, votes, members)
      return <Row key={poll.id} to={`${root}/vote/${poll.id}`} icon={waiting.length || !options.length || !members.length ? <Vote aria-hidden="true" className="size-5" /> : <CheckCircle2 aria-hidden="true" className="size-5" />} title={poll.title} detail={!options.length ? 'Add options so everyone can vote' : !members.length ? 'Invite the group to start deciding' : waiting.length ? waiting.length === 1 && waiting[0]?.id === me ? 'Your vote is still needed' : waiting.length <= 2 ? `Waiting on ${waiting.map((member) => member.id === me ? 'you' : member.display_name).join(' and ')}` : `${waiting.length} travelers still need to vote` : 'Everyone’s voted · ready to decide'} />
    })}{open.length > 3 && <Row to={`${root}/vote`} title={`${open.length - 3} more open ${open.length - 3 === 1 ? 'vote' : 'votes'}`} />}
    {followUp.slice(0, 3).map(({ poll }) => <Row key={poll.id} to={`${root}/vote/${poll.id}`} icon={<ClipboardCheck aria-hidden="true" className="size-5" />} title={poll.title} detail="Chosen · finish planning and booking" />)}
    {followUp.length > 3 && <Row to={`${root}/vote`} title={`${followUp.length - 3} more decisions to finish`} />}
    {unassigned > 0 && <Row to={`${root}/tasks?filter=unassigned`} icon={<ClipboardCheck aria-hidden="true" className="size-5" />} title={`${unassigned} ${unassigned === 1 ? 'task needs' : 'tasks need'} an owner`} detail="Pick something you can take care of" />}</ul>
  </section>
}
