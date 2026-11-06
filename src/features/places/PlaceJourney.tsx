import { Link } from 'react-router'
import { ArrowRight, CalendarPlus, Check, Vote } from 'lucide-react'
import type { ItineraryItem, Member, Place } from '@/data/types'
import type { usePolls } from '@/features/polls/data'
import { votingEnded } from '@/features/polls/rank'
import { travelersStillVoting } from '@/features/trips/decisions'
import { formatDate, formatInZone } from '@/lib/time'
import { LinkButton } from '@/ui'

/** Show recorded decisions and actual itinerary entries, never infer a booking. */
export function PlaceJourney({ place, members, items, polls, membersReady, mayPlan, now }: {
  place: Place; members: Member[]; items: ItineraryItem[] | undefined;
  polls: ReturnType<typeof usePolls>; membersReady: boolean; mayPlan: boolean; now: number
}) {
  const root = `/t/${place.trip_id}`
  const visits = items?.filter((item) => item.place_id === place.id && item.status !== 'cancelled')
  const decisions = polls?.filter(({ options }) => options.some((option) => option.place_id === place.id))
  const chosen = decisions?.some(({ poll, options }) => poll.status === 'closed' && options.some((option) => option.id === poll.winner_option_id && option.place_id === place.id))
  const stage = visits?.length ? 2 : chosen || decisions?.length ? 1 : 0
  const ready = items !== undefined && polls !== undefined && membersReady
  return <section className="place-journey" aria-labelledby="place-journey-title">
    <h2 id="place-journey-title" className="sr-only">Planning progress</h2>
    <ol className="place-journey-stages" aria-label="Place planning progress">
      {['Saved idea', chosen ? 'Group choice' : 'Group vote', 'In the plan'].map((label, index) => <li key={index} aria-current={ready && stage === index ? 'step' : undefined} data-reached={ready && (index === 0 || index === 1 && chosen || index === 2 && !!visits?.length)}><span aria-hidden="true">{ready && (index === 0 || index === 1 && chosen || index === 2 && !!visits?.length) ? <Check className="size-3.5" /> : index + 1}</span>{label}</li>)}
    </ol>
    {!ready ? <p className="text-sm text-muted" role="status">Checking the group’s votes and plan…</p> : <>
      {!!decisions?.length && <ul className="place-journey-decisions">{decisions.map(({ poll, options, votes }) => {
        const winner = poll.status === 'closed' && options.some((option) => option.id === poll.winner_option_id && option.place_id === place.id)
        const waiting = travelersStillVoting(options, votes, members)
        const ended = votingEnded(poll, now)
        const detail = winner ? 'Chosen by your group' : ended ? 'Voting has ended' : !members.length ? 'Invite your group to vote' : !waiting.length ? 'Everyone’s voted · ready to decide' : waiting.length <= 2 ? `Waiting on ${waiting.map((member) => member.display_name).join(' and ')}` : `${waiting.length} people still to vote`
        return <li key={poll.id}><Link to={`${root}/more/vote/${poll.id}`}><Vote aria-hidden="true" className="size-4 shrink-0" /><span><strong>{poll.title}</strong><span>{detail}</span></span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link></li>
      })}</ul>}
      {visits?.length ? <div className="place-journey-visits"><p className="notebook-label">On your itinerary</p>{visits.map((item) => <Link key={item.id} to={`${root}/plan/${item.id}`} className="ui-link"><span>{formatDate(item.start_local.slice(0, 10))}{item.all_day ? ' · All day' : ` · ${formatInZone(item.start_at, item.start_tz)}`}</span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link>)}</div> : <p className="place-journey-hint">{chosen ? 'The group picked this one. Give it a day and a time.' : decisions?.length ? 'Keep the decision here, then give it a place in your day.' : 'Ask the group, or give this idea a place in your day.'}</p>}
      {mayPlan && <div className="place-journey-actions">{visits?.length ? <Link to={`${root}/plan/new?place=${encodeURIComponent(place.id)}`} className="ui-link"><CalendarPlus aria-hidden="true" className="size-4" />Plan another visit</Link> : <LinkButton to={`${root}/plan/new?place=${encodeURIComponent(place.id)}`}><CalendarPlus aria-hidden="true" className="size-4" />Add to the plan</LinkButton>}</div>}
    </>}
  </section>
}
