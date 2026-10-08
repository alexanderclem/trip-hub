import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { CalendarDays, CheckCircle2, Circle, Ticket, Users, Vote } from 'lucide-react'
import { DateTime } from 'luxon'
import { useDevice, useMyMemberId } from '@/data/device'
import { useLegContext, useMembers, usePlaces, useTrip } from '@/data/hooks'
import { useDisplayZone, useItems } from '@/features/itinerary/data'
import { UpNextCard } from '@/features/itinerary/UpNextCard'
import { planTransfers } from '@/features/itinerary/travel'
import { useTasks } from '@/features/tasks/data'
import { Avatar, Button, Card, LinkButton } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'
import { usePolls } from '@/features/polls/data'
import { ActivityList } from '@/features/activity/ActivityList'
import { useActivity, useMarkActivitySeen } from '@/features/activity/data'
import { votingEnded } from '@/features/polls/rank'
import { Bubble } from '@/features/stowie/chat'
import { Stowie } from '@/features/stowie/Stowie'
import { InviteTripCard } from './InviteTripCard'

export function TripOverviewScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const items = useItems(tripId)
  const places = usePlaces(tripId)
  const loadedMembers = useMembers(tripId)
  const members = loadedMembers ?? []
  const tasks = useTasks(tripId)
  const polls = usePolls(tripId)
  const me = useMyMemberId(tripId)
  const news = useActivity(tripId)
  const newsSince = useMarkActivitySeen(tripId, news !== undefined)
  const legCtx = useLegContext(tripId)
  const { zone } = useDisplayZone(trip)
  const [params, setParams] = useSearchParams()
  const [arrival] = useState(() => params.has('created') ? 'created' : params.has('joined') ? 'joined' : null)
  const dismissed = useDevice((s) => s.setupDismissed?.[tripId] ?? false)
  const setDismissed = useDevice((s) => s.setSetupDismissed)
  const needsProfile = useDevice((s) => !s.quizSeen && s.travelProfile === null)
  useEffect(() => {
    if (params.has('created') || params.has('joined')) {
      const next = new URLSearchParams(params)
      next.delete('created'); next.delete('joined')
      setParams(next, { replace: true })
    }
  }, [params, setParams])
  if (!trip || !items || !places) return <LoadingState fullScreen action={<LinkButton to="/app" variant="secondary">Your trips</LinkButton>} />
  const root = `/t/${tripId}`
  const savedPlaces = places.filter((p) => p.status !== 'catalog' && p.status !== 'rejected')
  const steps = [
    { title: 'Invite travelers', done: members.length > 1, to: '#invite-group', Icon: Users },
    { title: 'Start a vote', done: !!polls?.length, to: `${root}/more/vote`, Icon: Vote },
    { title: 'Add an activity', done: items.length > 0, to: `${root}/plan/new`, Icon: CalendarDays },
  ]
  const completed = steps.filter((s) => s.done).length
  const transfers = legCtx && loadedMembers ? planTransfers(items, places, legCtx, trip.timezone, members.map((m) => m.id)) : []
  const openTasks = tasks?.filter((t) => !t.completed) ?? []
  const dates = trip.start_date ? `${DateTime.fromISO(trip.start_date).toLocaleString(DateTime.DATE_MED)}${trip.end_date ? ` – ${DateTime.fromISO(trip.end_date).toLocaleString(DateTime.DATE_MED)}` : ''}` : 'Dates to be decided'
  return (
    <div className="trip-page px-5 pb-10 pt-6 sm:px-8 lg:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0 max-w-2xl"><p className="mb-2 text-sm font-medium text-muted">Trip overview</p><h1 className="travel-heading break-words text-4xl text-brand-900 sm:text-5xl">{trip.name}</h1><p className="mt-3 text-sm text-stone-600">{dates}{loadedMembers && <> · {members.length} {members.length === 1 ? 'traveler' : 'travelers'}</>}</p></div>
        <div className="flex flex-wrap gap-2"><LinkButton to={`${root}/more/vote`}><Vote aria-hidden="true" className="size-4" />Group votes</LinkButton><LinkButton to={`${root}/map`} variant="secondary">Map</LinkButton></div>
      </header>
      {arrival && <section role="status" aria-label="Welcome from Stowie" className="mb-6 flex items-start gap-3 rounded-2xl bg-brand-50 p-4">
        <Stowie mood="delighted" size={48} />
        <div className="min-w-0 flex-1 space-y-3">
          <Bubble from="stowie">{arrival === 'created' ? 'Your trip’s ready. First, invite the group: the link is on this page. Then start a vote so everyone gets a say.' : 'You’re in. Start with the group votes, then have a look at the plan.'}</Bubble>
          <div className="flex flex-wrap gap-2">
            {arrival === 'created'
              ? <><Button onClick={() => document.getElementById('invite-group')?.scrollIntoView({ block: 'nearest' })}><Users aria-hidden="true" className="size-4" />Invite travelers</Button><LinkButton to={`${root}/more/vote`} variant="secondary">Start a vote</LinkButton></>
              : <><LinkButton to={`${root}/more/vote`}><Vote aria-hidden="true" className="size-4" />See the votes</LinkButton><LinkButton to={`${root}/plan`} variant="secondary">Open the plan</LinkButton></>}
          </div>
          <p className="text-sm text-stone-600">Stuck on anything? Tap me in the corner and ask.</p>
        </div>
      </section>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="group-votes-title" className="ui-card p-5 sm:p-6">
            <h2 id="group-votes-title" className="text-lg font-semibold text-brand-900">Group votes</h2>
            {polls === undefined ? <p role="status" className="mt-4 text-sm">Loading your group’s votes…</p> : <ul className="mt-4 divide-y divide-brand-200">{polls.filter(({ poll }) => !votingEnded(poll, Date.now())).slice(0, 3).map(({ poll, options, votes }) => {
              const count = options.filter((option) => votes.some((v) => v.option_id === option.id && v.member_id === me && v.score != null)).length
              return <li key={poll.id}><Link to={`${root}/more/vote/${poll.id}`} className="block min-h-11 rounded-lg py-3 text-brand-900 hover:underline"><span className="block break-words font-semibold">{poll.title}</span><span className="text-sm text-stone-600">{options.length} {options.length === 1 ? 'option' : 'options'} · {count < options.length ? `${options.length - count} awaiting your vote` : options.length ? 'You’re all caught up' : 'Add the first option'}</span></Link></li>
            })}</ul>}
            <LinkButton to={`${root}/more/vote`} className="mt-4">{polls?.some(({ poll }) => !votingEnded(poll, Date.now())) ? 'See all votes' : 'Start a vote'}</LinkButton>
          </section>
          {!!news?.length && <section aria-labelledby="news-title" className="ui-card p-5 sm:p-6">
            <h2 id="news-title" className="text-lg font-semibold text-brand-900">What’s new</h2>
            <div className="mt-2"><ActivityList tripId={tripId} events={news.slice(0, 5)} members={members} me={me} since={newsSince} /></div>
            {news.length > 5 && <LinkButton to={`${root}/activity`} variant="ghost" className="-ml-4">See everything</LinkButton>}
          </section>}
          <UpNextCard tripId={tripId} items={items} places={places} members={members} me={me} zone={zone} transfers={transfers} />
          {items.length === 0 ? <Card><div className="min-w-0"><h2 className="text-lg font-semibold text-brand-900">Itinerary</h2><p className="mt-2 text-sm leading-relaxed text-stone-600">No activities yet.</p><LinkButton to={`${root}/plan/new`} variant="ghost" className="mt-2 -ml-4">Add to the plan</LinkButton></div></Card> : <Card><h2 className="text-lg font-semibold">Your shared plan</h2><p className="mt-2 text-sm text-stone-600">{items.length} {items.length === 1 ? 'item' : 'items'} planned · {savedPlaces.length} saved {savedPlaces.length === 1 ? 'place' : 'places'}</p><LinkButton to={`${root}/plan`} variant="ghost" className="mt-2 -ml-4">View the itinerary</LinkButton></Card>}
          {loadedMembers && (!dismissed ? <section aria-labelledby="setup-title" className="ui-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 id="setup-title" className="text-lg font-semibold text-brand-900">Trip setup</h2><p role="status" className="mt-1 text-sm text-stone-600">{completed} of 3 first steps complete</p></div><Button variant="ghost" className="text-sm" onClick={() => setDismissed(tripId, true)}>Hide guidance</Button></div>
            <ol className="mt-4 divide-y divide-stone-200">{steps.map(({ title, done, to, Icon }) => <li key={title}><Link to={to} onClick={to.startsWith('#') ? () => requestAnimationFrame(() => document.getElementById('invite-group')?.scrollIntoView({ block: 'nearest' })) : undefined} className="flex min-h-11 items-center gap-3 rounded-xl py-3 hover:bg-brand-50"><span className="pt-1">{done ? <CheckCircle2 aria-label="Complete" className="size-5 text-brand-700" /> : <Circle aria-label="To do" className="size-5 text-stone-400" />}</span><div className="min-w-0 flex-1"><h3 className="font-medium text-brand-900">{title}</h3></div><Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-brand-700" /></Link></li>)}</ol>
          </section> : <Button variant="ghost" onClick={() => setDismissed(tripId, false)}>Show first steps · {completed}/3 complete</Button>)}
          {openTasks.length > 0 && <Card><h2 className="text-lg font-semibold">Open tasks</h2><ul className="mt-3 divide-y divide-stone-200">{openTasks.slice(0, 3).map((task) => <li key={task.id}><Link className="block min-h-11 break-words py-3 text-sm text-brand-900 hover:underline" to={`${root}/more/tasks/${task.id}`}>{task.title}{task.due_date && <span className="ml-2 text-stone-600">· Due {task.due_date}</span>}</Link></li>)}</ul><LinkButton to={`${root}/more/tasks`} variant="ghost" className="-ml-4">View all tasks</LinkButton></Card>}
        </div>
        <div className="min-w-0 space-y-6">
          <div id="invite-group" className="scroll-mt-6"><InviteTripCard trip={trip} /></div>
          <Card><h2 className="text-lg font-semibold text-brand-900">Travelers</h2>{!loadedMembers && <p role="status" className="mt-3 text-sm text-stone-600">Loading travelers…</p>}<ul className="mt-3 space-y-3">{members.map((member) => <li key={member.id} className="flex items-center gap-3"><Avatar name={member.display_name} color={member.color} size="sm" /><span className="min-w-0 break-words text-sm">{member.display_name}{member.id === me ? ' (you)' : ''}</span></li>)}</ul></Card>
          {needsProfile && <Card><h2 className="text-lg font-semibold text-brand-900">Travel preferences</h2><LinkButton variant="ghost" className="mt-2 -ml-4" to={`/quiz?next=${encodeURIComponent(`${root}/overview`)}`}>Set preferences</LinkButton><Button variant="ghost" className="-ml-4 text-sm" onClick={() => useDevice.getState().setQuizSeen()}>Maybe later</Button></Card>}
          <Card><h2 className="text-lg font-semibold text-brand-900">Trip essentials</h2><Link to={`${root}/tickets`} className="mt-2 flex min-h-11 items-center gap-2 text-sm text-brand-700 hover:underline"><Ticket aria-hidden="true" className="size-4" />Tickets & documents</Link><Link to={`${root}/more/settings`} className="flex min-h-11 items-center text-sm text-brand-700 hover:underline">Trip settings & sharing</Link></Card>
        </div>
      </div>
    </div>
  )
}
