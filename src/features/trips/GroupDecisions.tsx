import { Link } from 'react-router'
import { ArrowRight, CheckCircle2, ClipboardCheck, Vote } from 'lucide-react'
import type { Member } from '@/data/types'
import type { usePolls } from '@/features/polls/data'
import { votingEnded } from '@/features/polls/rank'
import { Row, SectionTitle } from '@/ui'
import { travelersStillVoting } from './decisions'

export function GroupDecisions({ tripId, polls, members, unassigned, now }: {
  tripId: string; polls: NonNullable<ReturnType<typeof usePolls>>; members: Member[]; unassigned: number; now: number
}) {
  const open = polls.filter(({ poll }) => !votingEnded(poll, now))
  if (!open.length && !unassigned) return null
  const root = `/t/${tripId}/more`
  return <section aria-labelledby="group-decisions-title" className="group-decisions">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><SectionTitle id="group-decisions-title">Group decisions</SectionTitle></div><Link to={`${root}/vote`} className="ui-link">All votes<ArrowRight aria-hidden="true" className="size-4" /></Link></div>
    <ul className="ui-row-group">{open.slice(0, 3).map(({ poll, options, votes }) => {
      const waiting = travelersStillVoting(options, votes, members)
      return <Row key={poll.id} to={`${root}/vote/${poll.id}`} icon={waiting.length || !options.length || !members.length ? <Vote aria-hidden="true" className="size-5" /> : <CheckCircle2 aria-hidden="true" className="size-5" />} title={poll.title} detail={!options.length ? 'Add options so everyone can vote' : !members.length ? 'Invite the group to start deciding' : waiting.length ? `${waiting.length} ${waiting.length === 1 ? 'traveler still needs' : 'travelers still need'} to vote` : 'Everyone’s voted · ready to decide'} />
    })}{open.length > 3 && <Row to={`${root}/vote`} title={`${open.length - 3} more open ${open.length - 3 === 1 ? 'vote' : 'votes'}`} />}
    {unassigned > 0 && <Row to={`${root}/tasks?filter=unassigned`} icon={<ClipboardCheck aria-hidden="true" className="size-5" />} title={`${unassigned} ${unassigned === 1 ? 'task needs' : 'tasks need'} an owner`} detail="Pick something you can take care of" />}</ul>
  </section>
}
