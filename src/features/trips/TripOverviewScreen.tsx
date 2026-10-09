import { TravelerLink } from './TravelerLink'
import { use, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { CheckCircle2, Circle, ClipboardCheck, Compass, MapPin, Ticket, Users, Vote, Wallet } from 'lucide-react'
import { useDevice, useMyMemberId } from '@/data/device'
import { useLegContext, useMembers, usePlaces, useTrip } from '@/data/hooks'
import { useDisplayZone, useItems } from '@/features/itinerary/data'
import { UpNextCard } from '@/features/itinerary/UpNextCard'
import { planTransfers } from '@/features/itinerary/travel'
import { useTasks } from '@/features/tasks/data'
import { Button, Card, Disclosure, HeaderTools, LinkButton, Row, RowGroup, SectionTitle } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'
import { usePolls } from '@/features/polls/data'
import { ActivityList } from '@/features/activity/ActivityList'
import { useActivity, useMarkActivitySeen } from '@/features/activity/data'
import { votingEnded } from '@/features/polls/rank'
import { useMoney } from '@/features/money/data'
import { useMoneyFormat } from '@/features/money/format'
import { useAttachments } from '@/features/tickets/files'
import { balances } from '@/lib/money'
import { Bubble } from '@/features/stowie/chat'
import { Stowie } from '@/features/stowie/Stowie'
import { InviteTripCard } from './InviteTripCard'
import { dateRange, formatDate } from '@/lib/time'
import { ListSkeleton } from '@/ui/collection'

/**
 * Home for a trip. In order: what needs this person, what happens next, what the group did,
 * and (until they're done) the first steps. Each destination appears once; the tabs do the rest.
 */
export function TripOverviewScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const items = useItems(tripId)
  const places = usePlaces(tripId)
  const loadedMembers = useMembers(tripId)
  const members = loadedMembers ?? []
  const tasks = useTasks(tripId)
  const polls = usePolls(tripId)
  const money = useMoney(tripId)
  const tickets = useAttachments(tripId)
  const me = useMyMemberId(tripId)
  const news = useActivity(tripId)
  const newsSince = useMarkActivitySeen(tripId, news !== undefined)
  const legCtx = useLegContext(tripId)
  const { zone } = useDisplayZone(trip)
  const { fmt } = useMoneyFormat(trip, money?.snapshot ?? null)
  const tools = use(HeaderTools)
  const [params, setParams] = useSearchParams()
  const [arrival] = useState(() => params.has('created') ? 'created' : params.has('joined') ? 'joined' : null)
  const [inviting, setInviting] = useState(false)
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
  const mine = useMemo(() => (money && me ? balances(money.expenses, money.settlements).get(me) ?? 0 : 0), [money, me])
  if (!trip || !items || !places) return <LoadingState fullScreen action={<LinkButton to="/app" variant="secondary">Your trips</LinkButton>} />

  const root = `/t/${tripId}`
  const savedPlaces = places.filter((p) => p.status !== 'catalog' && p.status !== 'rejected')
  const invite = () => {
    setInviting(true)
    requestAnimationFrame(() => document.getElementById('invite-group')?.scrollIntoView({ block: 'nearest' }))
  }
  const steps = [
    { title: 'Invite friends', description: 'Send the trip link to your group.', done: members.length > 1, to: '#invite-group', Icon: Users },
    { title: 'Save an idea', description: 'A restaurant, a beach, somewhere to stay.', done: savedPlaces.length > 0, to: `${root}/more/places/new`, Icon: MapPin },
    { title: 'Start a vote', description: 'Give everyone a say in what happens next.', done: !!polls?.length, to: `${root}/more/vote`, Icon: Vote },
  ]
  const completed = steps.filter((s) => s.done).length
  const transfers = legCtx && loadedMembers ? planTransfers(items, places, legCtx, trip.timezone, members.map((m) => m.id)) : []

  // What needs this person, most pressing first. Each row goes straight to the thing.
  const waiting = (polls ?? []).filter(({ poll }) => !votingEnded(poll, Date.now())).map(({ poll, options, votes }) => ({
    poll, left: options.filter((o) => !votes.some((v) => v.option_id === o.id && v.member_id === me && v.score != null)).length,
  })).filter((p) => p.left > 0)
  const myTasks = (tasks ?? []).filter((t) => !t.completed && (t.assignee_id === me || t.assignee_id === null))
  const missing = tickets?.filter((t) => !t.onPhone).length ?? 0
  const needs = waiting.length + myTasks.length + (mine < 0 ? 1 : 0) + (missing ? 1 : 0) + (needsProfile ? 1 : 0)

  return (
    <div className="trip-page px-4 pb-10 pt-safe sm:px-8">
      <header className="mb-6 pt-4 lg:pt-8">
        <div className="flex items-start gap-1">
          <h1 className="travel-heading min-w-0 flex-1 break-words pt-1 text-3xl text-brand-900 sm:text-4xl">{trip.name}</h1>
          {tools}
        </div>
        <p className="mt-2 text-sm text-stone-600">{dateRange(trip.start_date, trip.end_date) || 'Dates to be decided'}{loadedMembers && <> · {members.length} {members.length === 1 ? 'traveler' : 'travelers'}</>}</p>
      </header>
      {arrival && <section role="status" aria-label="Welcome from Stowie" className="mb-6 flex items-start gap-3 rounded-2xl bg-brand-50 p-4">
        <Stowie mood="delighted" size={48} />
        <div className="min-w-0 flex-1 space-y-3">
          <Bubble from="stowie">{arrival === 'created' ? 'Your trip has a home. Invite your friends, then save that place you’ve been talking about. I’ll keep the details handy.' : 'You’re in. Have your say in the group votes, then take a peek at the plan.'}</Bubble>
          <div className="flex flex-wrap gap-2">
            {arrival === 'created'
              ? <><Button onClick={invite}><Users aria-hidden="true" className="size-4" />Invite friends</Button><LinkButton to={`${root}/more/places/new`} variant="secondary">Save an idea</LinkButton></>
              : <><LinkButton to={`${root}/more/vote`}><Vote aria-hidden="true" className="size-4" />See the votes</LinkButton><LinkButton to={`${root}/plan`} variant="secondary">Open the plan</LinkButton></>}
          </div>
          <p className="text-sm text-stone-600">Need a hand? I’m the little suitcase at the top of the screen.</p>
        </div>
      </section>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
        <div className="min-w-0 space-y-6">
          {polls === undefined ? <ListSkeleton label="Loading what needs you…" rows={2} /> : needs > 0 ? (
            <RowGroup label="Needs you">
              {waiting.slice(0, 3).map(({ poll, left }) => <Row key={poll.id} to={`${root}/more/vote/${poll.id}`} icon={<Vote aria-hidden="true" className="size-5" />} title={poll.title} detail={`${left} ${left === 1 ? 'option' : 'options'} awaiting your vote`} />)}
              {mine < 0 && <Row to={`${root}/money`} icon={<Wallet aria-hidden="true" className="size-5" />} title={`You owe ${fmt(Math.abs(mine))}`} detail="Settle up when you’re ready" />}
              {myTasks.slice(0, 3).map((task) => <Row key={task.id} to={`${root}/more/tasks/${task.id}`} icon={<ClipboardCheck aria-hidden="true" className="size-5" />} title={task.title} detail={[task.assignee_id === me ? 'Yours' : 'Nobody’s yet', task.due_date && `due ${formatDate(task.due_date)}`].filter(Boolean).join(' · ')} />)}
              {myTasks.length > 3 && <Row to={`${root}/more/tasks`} icon={<ClipboardCheck aria-hidden="true" className="size-5" />} title={`${myTasks.length - 3} more open ${myTasks.length - 3 === 1 ? 'task' : 'tasks'}`} />}
              {missing > 0 && <Row to={`${root}/tickets`} icon={<Ticket aria-hidden="true" className="size-5" />} title={`${missing} ${missing === 1 ? 'ticket isn’t' : 'tickets aren’t'} on this phone yet`} detail="Download before you lose signal" />}
              {needsProfile && <Row to={`/quiz?next=${encodeURIComponent(`${root}/overview`)}`} icon={<Compass aria-hidden="true" className="size-5" />} title="Set your travel preferences" detail="Ten quick this-or-that questions" />}
            </RowGroup>
          ) : (items.length > 0 || !!polls.length) && <p className="flex items-center gap-2 px-1 text-sm text-stone-600"><CheckCircle2 aria-hidden="true" className="size-5 text-brand-700" />You’re all caught up</p>}

          <UpNextCard tripId={tripId} items={items} places={places} members={members} me={me} zone={zone} transfers={transfers} />

          {!!news?.length && <section aria-labelledby="news-title">
            <SectionTitle id="news-title" className="px-1">What’s new</SectionTitle>
            <div className="mt-1 px-1"><ActivityList tripId={tripId} events={news.slice(0, 3)} members={members} me={me} since={newsSince} /></div>
            {news.length > 3 && <Link to={`${root}/activity`} className="ui-link px-1">See everything</Link>}
          </section>}

          {loadedMembers && (!dismissed ? <section aria-labelledby="setup-title" className="ui-card">
            <div className="flex flex-wrap items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-3">{completed === 3 && <Stowie mood="delighted" size={40} />}<div><SectionTitle id="setup-title">Make it happen</SectionTitle><p role="status" className="mt-1 text-sm text-stone-600">{completed} of 3 first steps complete{completed === 3 && '. You’re off.'}</p></div></div><button type="button" className="ui-link" onClick={() => setDismissed(tripId, true)}>{completed === 3 ? 'Done' : 'Hide guidance'}</button></div>
            <ol className="mt-2 divide-y divide-stone-200">{steps.map(({ title, description, done, to, Icon }) => <li key={title}><Link to={to} onClick={to.startsWith('#') ? invite : undefined} className="flex min-h-11 items-center gap-3 rounded-xl py-3 hover:bg-brand-50"><span>{done ? <CheckCircle2 aria-label="Complete" className="size-5 text-brand-700" /> : <Circle aria-label="To do" className="size-5 text-stone-600" />}</span><div className="min-w-0 flex-1"><h3 className="font-medium text-brand-900">{title}</h3><p className="text-sm text-stone-600">{description}</p></div><Icon aria-hidden="true" className="size-5 shrink-0 text-stone-600" /></Link></li>)}</ol>
          </section> : completed < 3 && <button type="button" className="ui-link px-1" onClick={() => setDismissed(tripId, false)}>Show first steps · {completed}/3 complete</button>)}
        </div>
        <Card>
          <section id="invite-group" aria-labelledby="travelers-title" className="scroll-mt-6">
            <SectionTitle id="travelers-title">Travelers</SectionTitle>
            {!loadedMembers && <ListSkeleton label="Loading travelers…" className="mt-3" />}
            <ul className="mt-1 flex flex-wrap gap-x-3">{members.map((member) => <li key={member.id}><TravelerLink member={member} you={member.id === me} /></li>)}</ul>
            <Disclosure summary="Invite the group" open={inviting} onToggle={setInviting} className="mt-1 border-t border-stone-200 pt-1"><InviteTripCard trip={trip} bare /></Disclosure>
          </section>
        </Card>
      </div>
    </div>
  )
}
