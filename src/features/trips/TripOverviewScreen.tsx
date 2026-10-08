import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { CalendarDays, CheckCircle2, Circle, Compass, Ticket, Users, Vote } from 'lucide-react'
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
import { InviteTripCard } from './InviteTripCard'

export function TripOverviewScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const items = useItems(tripId)
  const places = usePlaces(tripId)
  const members = useMembers(tripId)
  const tasks = useTasks(tripId)
  const polls = usePolls(tripId)
  const me = useMyMemberId(tripId)
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
  if (!trip || !items || !places || !members) return <LoadingState fullScreen action={<LinkButton to="/app" variant="secondary">Your trips</LinkButton>} />
  const root = `/t/${tripId}`
  const savedPlaces = places.filter((p) => p.status !== 'catalog' && p.status !== 'rejected')
  const steps = [
    { title: 'Invite your people', description: members.length > 1 ? `${members.length} people are aboard.` : 'Share the invite link below. This step completes when someone joins.', done: members.length > 1, to: '#invite-group', Icon: Users },
    { title: 'Start a group vote', description: polls?.length ? `${polls.length} group decisions started.` : 'Compare places, stays, or activities and let everyone weigh in.', done: !!polls?.length, to: `${root}/more/vote`, Icon: Vote },
    { title: 'Add your first activity', description: items.length ? `${items.length} ${items.length === 1 ? 'item is' : 'items are'} in your shared plan.` : 'Start with a meal, a flight, or something you want to do.', done: items.length > 0, to: `${root}/plan/new`, Icon: CalendarDays },
  ]
  const completed = steps.filter((s) => s.done).length
  const transfers = legCtx ? planTransfers(items, places, legCtx, trip.timezone, members.map((m) => m.id)) : []
  const openTasks = tasks?.filter((t) => !t.completed) ?? []
  const dates = trip.start_date ? `${DateTime.fromISO(trip.start_date).toLocaleString(DateTime.DATE_MED)}${trip.end_date ? ` – ${DateTime.fromISO(trip.end_date).toLocaleString(DateTime.DATE_MED)}` : ''}` : 'Dates to be decided'
  return (
    <div className="trip-page px-5 pb-10 pt-6 sm:px-8 lg:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0 max-w-2xl"><p className="mb-2 text-sm font-medium text-muted">Trip overview</p><h1 className="travel-heading break-words text-4xl text-brand-900 sm:text-5xl">{trip.name}</h1><p className="mt-3 text-sm text-stone-600">{dates} · {members.length} {members.length === 1 ? 'traveler' : 'travelers'}</p></div>
        <div className="flex flex-wrap gap-2"><LinkButton to={`${root}/more/vote`}><Vote aria-hidden="true" className="size-4" />Decide together</LinkButton><LinkButton to={`${root}/map`} variant="secondary">Explore the map</LinkButton></div>
      </header>
      {arrival && <p role="status" className="mb-6 flex items-start gap-2 rounded-xl bg-brand-50 p-4 text-sm text-brand-900"><CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />{arrival === 'created' ? 'Your trip is ready. Invite your people and start shaping the plan.' : 'You’re aboard. Explore the shared plan or add an idea of your own.'}</p>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="group-votes-title" className="ui-card border-brand-300 bg-brand-50 p-5 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-medium text-brand-700"><Vote aria-hidden="true" className="size-5" />Everyone gets a say</p>
            <h2 id="group-votes-title" className="travel-heading mt-3 text-3xl text-brand-900">What should we do together?</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">Put your ideas up for a vote. Score each option from “No way” to “Must-do”, see what your group loves, and turn the winner into a plan.</p>
            {polls === undefined ? <p role="status" className="mt-4 text-sm">Loading your group’s votes…</p> : <ul className="mt-4 divide-y divide-brand-200">{polls.filter(({ poll }) => poll.status === 'open').slice(0, 3).map(({ poll, options, votes }) => {
              const count = options.filter((option) => votes.some((v) => v.option_id === option.id && v.member_id === me && v.score != null)).length
              return <li key={poll.id}><Link to={`${root}/more/vote/${poll.id}`} className="block min-h-11 rounded-lg py-3 text-brand-900 hover:underline"><span className="block break-words font-semibold">{poll.title}</span><span className="text-sm text-stone-600">{options.length} {options.length === 1 ? 'option' : 'options'} · {count < options.length ? `${options.length - count} awaiting your vote` : options.length ? 'You’re all caught up' : 'Add the first option'}</span></Link></li>
            })}</ul>}
            <LinkButton to={`${root}/more/vote`} className="mt-4">{polls?.some(({ poll }) => poll.status === 'open') ? 'See all votes' : 'Start a vote'}</LinkButton>
          </section>
          <UpNextCard tripId={tripId} items={items} places={places} members={members} me={me} zone={zone} transfers={transfers} />
          {items.length === 0 ? <Card className="flex flex-wrap items-center gap-5 p-6"><img src="/brand/packed-for-anywhere.svg" alt="" width="360" height="170" className="w-40 max-w-full" /><div className="min-w-0 flex-1"><h2 className="travel-heading text-2xl text-brand-900">A little room for possibility.</h2><p className="mt-2 text-sm leading-relaxed text-stone-600">Your trip is created. Start with one thing you’re looking forward to; the rest can take shape together.</p><LinkButton to={`${root}/plan/new`} variant="ghost" className="mt-2 -ml-4">Add to the plan</LinkButton></div></Card> : <Card><h2 className="text-lg font-semibold">Your shared plan</h2><p className="mt-2 text-sm text-stone-600">{items.length} {items.length === 1 ? 'item' : 'items'} planned · {savedPlaces.length} saved {savedPlaces.length === 1 ? 'place' : 'places'}</p><LinkButton to={`${root}/plan`} variant="ghost" className="mt-2 -ml-4">View the itinerary</LinkButton></Card>}
          {!dismissed ? <section aria-labelledby="setup-title" className="ui-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 id="setup-title" className="text-lg font-semibold text-brand-900">{completed === 3 ? 'Your trip is taking shape' : 'Make this trip yours'}</h2><p role="status" className="mt-1 text-sm text-stone-600">{completed} of 3 first steps complete</p></div><Button variant="ghost" className="text-sm" onClick={() => setDismissed(tripId, true)}>Hide guidance</Button></div>
            <ol className="mt-4 divide-y divide-stone-200">{steps.map(({ title, description, done, to, Icon }) => <li key={title}><Link to={to} onClick={to.startsWith('#') ? () => requestAnimationFrame(() => document.getElementById('invite-group')?.scrollIntoView({ block: 'nearest' })) : undefined} className="flex min-h-20 items-start gap-3 rounded-xl py-4 hover:bg-brand-50"><span className="pt-1">{done ? <CheckCircle2 aria-label="Complete" className="size-5 text-brand-700" /> : <Circle aria-label="To do" className="size-5 text-stone-400" />}</span><div className="min-w-0 flex-1"><h3 className="font-medium text-brand-900">{title}</h3><p className="mt-1 text-sm leading-relaxed text-stone-600">{description}</p></div><Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-brand-700" /></Link></li>)}</ol>
          </section> : <Button variant="ghost" onClick={() => setDismissed(tripId, false)}>Show first steps · {completed}/3 complete</Button>}
          {openTasks.length > 0 && <Card><h2 className="text-lg font-semibold">Before you go</h2><ul className="mt-3 divide-y divide-stone-200">{openTasks.slice(0, 3).map((task) => <li key={task.id}><Link className="block min-h-11 break-words py-3 text-sm text-brand-900 hover:underline" to={`${root}/more/tasks/${task.id}`}>{task.title}{task.due_date && <span className="ml-2 text-stone-600">· Due {task.due_date}</span>}</Link></li>)}</ul><LinkButton to={`${root}/more/tasks`} variant="ghost" className="-ml-4">View all tasks</LinkButton></Card>}
        </div>
        <div className="min-w-0 space-y-6">
          <div id="invite-group" className="scroll-mt-6"><InviteTripCard trip={trip} /></div>
          <Card><h2 className="text-lg font-semibold text-brand-900">Your people</h2><ul className="mt-3 space-y-3">{members.map((member) => <li key={member.id} className="flex items-center gap-3"><Avatar name={member.display_name} color={member.color} size="sm" /><span className="min-w-0 break-words text-sm">{member.display_name}{member.id === me ? ' (you)' : ''}</span></li>)}</ul></Card>
          {needsProfile && <Card><Compass aria-hidden="true" className="size-5 text-brand-700" /><h2 className="mt-3 text-lg font-semibold text-brand-900">Your kind of trip</h2><p className="mt-2 text-sm leading-relaxed text-stone-600">An optional one-minute quiz helps your group find ideas everyone enjoys. Take it whenever you’re ready.</p><LinkButton variant="ghost" className="mt-2 -ml-4" to={`/quiz?next=${encodeURIComponent(`${root}/overview`)}`}>Discover your travel style</LinkButton><Button variant="ghost" className="-ml-4 text-sm" onClick={() => useDevice.getState().setQuizSeen()}>Maybe later</Button></Card>}
          <Card><h2 className="text-lg font-semibold text-brand-900">Keep the essentials close</h2><Link to={`${root}/tickets`} className="mt-2 flex min-h-11 items-center gap-2 text-sm text-brand-700 hover:underline"><Ticket aria-hidden="true" className="size-4" />Tickets & documents</Link><Link to={`${root}/more/settings`} className="flex min-h-11 items-center text-sm text-brand-700 hover:underline">Trip settings & sharing</Link><p className="mt-1 text-sm leading-relaxed text-stone-600">Prepare offline access in settings before you head out.</p></Card>
        </div>
      </div>
    </div>
  )
}
