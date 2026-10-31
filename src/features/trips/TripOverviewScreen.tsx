import { coverPhoto } from './covers'
import { use, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { DateTime } from 'luxon'
import { ArrowRight, CalendarDays, CheckCircle2, Circle, ClipboardCheck, Compass, MapPin, Sparkles, Ticket, Users, Vote, Wallet } from 'lucide-react'
import { useDevice, useMyMemberId } from '@/data/device'
import { useLegContext, useMembers, usePlaces, useTrip } from '@/data/hooks'
import { useDisplayZone, useItems } from '@/features/itinerary/data'
import { UpNextCard } from '@/features/itinerary/UpNextCard'
import { planTransfers } from '@/features/itinerary/travel'
import { useTasks } from '@/features/tasks/data'
import { Card, Disclosure, HeaderTools, LinkButton, Row, RowGroup, SectionTitle } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'
import { usePolls } from '@/features/polls/data'
import { ActivityList } from '@/features/activity/ActivityList'
import { useActivity, useMarkActivitySeen } from '@/features/activity/data'
import { votingEnded } from '@/features/polls/rank'
import { useMoney } from '@/features/money/data'
import { useMoneyFormat } from '@/features/money/format'
import { useAttachments } from '@/features/tickets/files'
import { balances } from '@/lib/money'
import { Stowie } from '@/features/stowie/Stowie'
import { dateRange, formatDate } from '@/lib/time'
import { useNow } from '@/lib/useNow'
import { ListSkeleton } from '@/ui/collection'
import { OfflineReadyCard } from '@/features/offline/OfflineReadyCard'
import { InstallAppButton } from '@/features/install/InstallAppDialog'
import { tripAreas } from '@/features/destinations/destinations'
import { InviteTripCard } from './InviteTripCard'
import { TravelerLink } from './TravelerLink'
import { TripArtwork } from './TripArtwork'
import { TripCoverPicker } from './TripCoverPicker'
import { tripCover, tripStatus } from './presentation'
import { GroupDecisions } from './GroupDecisions'

/** One useful priority, then the shared plan. All summaries stay live from local trip data. */
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
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  const [inviting, setInviting] = useState(false)
  const now = useNow()
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
  const transfers = useMemo(() => items && places && legCtx && loadedMembers && trip
    ? planTransfers(items, places, legCtx, trip.timezone, loadedMembers.map((member) => member.id)) : [], [items, places, legCtx, loadedMembers, trip])
  if (!trip || !items || !places) return <LoadingState fullScreen action={<LinkButton to="/app" variant="secondary">Your trips</LinkButton>} />

  const root = `/t/${tripId}`
  const { phase, label: phaseLabel } = tripStatus(trip, now)
  const nearDeparture = phase === 'preparing' || phase === 'traveling'
  const today = DateTime.fromMillis(now, { zone: trip.timezone }).toISODate()!
  const savedPlaces = places.filter((place) => place.status !== 'catalog' && place.status !== 'rejected')
  const cover = tripCover(trip)
  const destinations = tripAreas(trip).map((area) => area.name).join(' · ')
  const invite = () => {
    setInviting(true)
    requestAnimationFrame(() => {
      const section = document.getElementById('invite-group')
      section?.scrollIntoView({ block: 'nearest' })
      section?.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true })
    })
  }
  const steps = [
    { title: 'Invite friends', description: 'Send the trip link to your group.', done: members.length > 1, to: null, Icon: Users },
    { title: 'Save an idea', description: 'A restaurant, a beach, somewhere to stay.', done: savedPlaces.length > 0, to: `${root}/more/places/new`, Icon: MapPin },
    { title: 'Start a vote', description: 'Let the group choose between options.', done: !!polls?.length, to: `${root}/more/vote`, Icon: Vote },
  ]
  const completed = steps.filter((step) => step.done).length
  const waiting = (polls ?? []).filter(({ poll }) => !votingEnded(poll, now)).map(({ poll, options, votes }) => ({
    poll, left: options.filter((option) => !votes.some((vote) => vote.option_id === option.id && vote.member_id === me && vote.score != null)).length,
  })).filter((poll) => poll.left > 0).sort((a, b) => (a.poll.closes_at ?? '9999').localeCompare(b.poll.closes_at ?? '9999'))
  const myTasks = (tasks ?? []).filter((task) => !task.completed && task.assignee_id === me)
  const overdue = myTasks.find((task) => task.due_date && task.due_date < today)
  const unassigned = (tasks ?? []).filter((task) => !task.completed && !task.assignee_id).length
  const missing = tickets?.filter((ticket) => !ticket.onPhone).length ?? 0
  const ready = polls !== undefined && tasks !== undefined && money !== undefined && tickets !== undefined
  const focus = overdue ? { title: overdue.title, detail: `Assigned to you · overdue since ${formatDate(overdue.due_date!)}`, action: 'Review task', to: `${root}/more/tasks/${overdue.id}`, Icon: ClipboardCheck }
    : waiting[0] ? { title: waiting[0].poll.title, detail: 'Your group is waiting on your vote.', action: 'Cast your vote', to: `${root}/more/vote/${waiting[0].poll.id}`, Icon: Vote }
    : mine < 0 ? { title: `You owe ${fmt(Math.abs(mine))}`, detail: 'One less thing to keep track of.', action: 'See shared expenses', to: `${root}/money`, Icon: Wallet }
    : myTasks[0] ? { title: myTasks[0].title, detail: 'A little planning goes a long way.', action: 'Review task', to: `${root}/more/tasks/${myTasks[0].id}`, Icon: ClipboardCheck }
    : null
  const highlightedTo = ready && focus && !nearDeparture ? focus.to : null
  const otherVotes = waiting.filter(({ poll }) => `${root}/more/vote/${poll.id}` !== highlightedTo)
  const otherTasks = myTasks.filter((task) => `${root}/more/tasks/${task.id}` !== highlightedTo)
  const showBalance = mine < 0 && highlightedTo !== `${root}/money`
  const needs = otherVotes.length + otherTasks.length + (showBalance ? 1 : 0) + (missing && !nearDeparture ? 1 : 0) + (needsProfile ? 1 : 0)
  const upNext = <UpNextCard tripId={tripId} items={items} places={places} members={members} me={me} zone={zone} transfers={transfers} prominent={phase === 'traveling'} />

  return <div data-phase={phase} className="trip-page trip-overview px-4 pb-10 pt-safe sm:px-8">
    <header className={`overview-journal ${cover === 'none' ? 'overview-journal-plain' : ''}`}>
      <div className="overview-journal-top"><Link to="/app" className="ui-link"><Compass aria-hidden="true" className="size-4" />Your trips</Link><div className="overview-tools">{tools}</div></div>
      <div className="overview-journal-content">
        <div className="min-w-0">
          <p className="app-kicker">{phase === 'traveling' ? 'On your trip' : phase === 'preparing' ? 'Before you go' : phase === 'complete' ? 'Past trip' : 'Your shared trip'}</p>
          <h1 className="travel-heading mt-2 wrap-anywhere">{trip.name}</h1>
          <div className="overview-meta"><span><CalendarDays aria-hidden="true" className="size-4" />{dateRange(trip.start_date, trip.end_date) || 'Dates to be decided'}</span><span className={`trip-phase trip-phase-${phase}`}>{phaseLabel}</span></div>
          {destinations && <p className="mt-2 flex items-start gap-2 text-sm text-stone-600"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="wrap-anywhere">{destinations}</span></p>}
        </div>
        {cover !== 'none' && <div key={cover} className="overview-art"><TripArtwork cover={cover} photo={coverPhoto(trip)} /></div>}
      </div>
    </header>

    {arrival && !welcomeDismissed && <section role="status" aria-label="Welcome from Stowie" className="overview-welcome">
      <Stowie mood="delighted" size={40} />
      <div className="min-w-0 flex-1"><p className="font-semibold">{arrival === 'created' ? 'Your trip is ready. Bring everyone along.' : 'You’re in. Let’s see what’s planned.'}</p><p className="mt-1 text-sm text-stone-600">{arrival === 'created' ? 'Share the invite link, then save your first idea.' : 'Check the group’s votes and make yourself at home.'}</p><div className="mt-2 flex flex-wrap gap-3">{arrival === 'created' ? <button type="button" onClick={invite} className="ui-link">Invite friends<ArrowRight aria-hidden="true" className="size-4" /></button> : <><Link to={`${root}/more/vote`} className="ui-link">See the votes<ArrowRight aria-hidden="true" className="size-4" /></Link><Link to={`${root}/plan`} className="ui-link">Open the plan</Link></>}<button type="button" className="ui-link" onClick={() => setWelcomeDismissed(true)}>Got it</button></div></div>
    </section>}

    {phase === 'planning' && <nav aria-label="Trip planning" className="overview-planning-nav">
      <Link to={`${root}/more/places`}><MapPin aria-hidden="true" /><span>Places</span><span className="planning-count">{savedPlaces.length}</span></Link>
      <Link to={`${root}/more/vote`}><Vote aria-hidden="true" /><span>Votes</span>{polls && <span className="planning-count">{polls.filter(({ poll }) => !votingEnded(poll, now)).length}<span className="sr-only"> open</span></span>}</Link>
      <Link to={`${root}/plan`}><CalendarDays aria-hidden="true" /><span>Plan</span><span className="planning-count">{items.length}</span></Link>
    </nav>}

    <div className="overview-columns">
      <div className="min-w-0 space-y-7">
        {phase === 'traveling' && upNext}
        {phase === 'preparing' && <section aria-labelledby="prepare-title" className="overview-preparation"><div className="mb-4"><p className="app-kicker mb-1">Your next step</p><SectionTitle id="prepare-title">Get ready for offline</SectionTitle><p className="mt-2 text-sm leading-relaxed text-stone-600">Save the essentials on this phone while you have a connection.</p></div><OfflineReadyCard trip={trip} compact /></section>}
        {ready && focus && phase !== 'traveling' && phase !== 'preparing' && <section className="overview-focus" aria-labelledby="trip-focus-title"><span className="overview-focus-icon"><focus.Icon aria-hidden="true" className="size-5" /></span><div className="min-w-0 flex-1"><p className="app-kicker">{overdue ? 'Needs your attention' : 'Your next step'}</p><h2 id="trip-focus-title" className="travel-heading mt-2 wrap-anywhere">{focus.title}</h2><p className="mt-2 text-sm leading-relaxed text-stone-600">{focus.detail}</p><LinkButton to={focus.to} className="mt-4">{focus.action}<ArrowRight aria-hidden="true" className="size-4" /></LinkButton></div></section>}
        {ready && !focus && phase === 'planning' && <section className="overview-focus" aria-labelledby="trip-focus-title"><span className="overview-focus-icon"><MapPin aria-hidden="true" className="size-5" /></span><div className="min-w-0"><p className="app-kicker">Room for a little adventure</p><h2 id="trip-focus-title" className="travel-heading mt-2">{savedPlaces.length ? 'Turn a good idea into a plan.' : 'Where should we go first?'}</h2><p className="mt-2 text-sm leading-relaxed text-stone-600">{savedPlaces.length ? 'Your saved places are a good place to start.' : 'Save somewhere you’d love to take the group.'}</p><LinkButton to={`${root}/more/places${savedPlaces.length ? '' : '/new'}`} className="mt-4">{savedPlaces.length ? 'Explore saved places' : 'Save your first place'}<ArrowRight aria-hidden="true" className="size-4" /></LinkButton></div></section>}
        {phase === 'complete' && <section className="overview-recap"><Stowie mood="delighted" size={44} /><div className="min-w-0"><SectionTitle>One for the memories.</SectionTitle><p className="mt-1 text-sm text-stone-600">The places, plans, and moments you shared.</p><Link to={`${root}/wrapped`} className="ui-link">Open trip recap<Sparkles aria-hidden="true" className="size-4" /></Link></div></section>}

        {!ready ? <ListSkeleton label="Loading what needs you…" rows={2} /> : needs > 0 ? <RowGroup label="For you">
          {otherVotes.slice(0, 3).map(({ poll, left }) => <Row key={poll.id} to={`${root}/more/vote/${poll.id}`} icon={<Vote aria-hidden="true" className="size-5" />} title={poll.title} detail={`${left} ${left === 1 ? 'option' : 'options'} awaiting your vote`} />)}
          {otherVotes.length > 3 && <Row to={`${root}/more/vote`} title={`${otherVotes.length - 3} more votes need you`} />}
          {showBalance && <Row to={`${root}/money`} icon={<Wallet aria-hidden="true" className="size-5" />} title={`You owe ${fmt(Math.abs(mine))}`} detail="See your share and settle up" />}
          {otherTasks.slice(0, 2).map((task) => <Row key={task.id} to={`${root}/more/tasks/${task.id}`} icon={<ClipboardCheck aria-hidden="true" className="size-5" />} title={task.title} detail={task.due_date ? `${task.due_date < today ? 'Overdue' : 'Due'} · ${formatDate(task.due_date)}` : 'Assigned to you'} />)}
          {otherTasks.length > 2 && <Row to={`${root}/more/tasks?filter=mine`} title={`${otherTasks.length - 2} more tasks for you`} />}
          {missing > 0 && !nearDeparture && <Row to={`${root}/tickets`} icon={<Ticket aria-hidden="true" className="size-5" />} title={`${missing} ${missing === 1 ? 'ticket isn’t' : 'tickets aren’t'} on this phone yet`} detail="Download before you lose signal" />}
          {needsProfile && <Row to={`/quiz?next=${encodeURIComponent(`${root}/overview`)}`} icon={<Compass aria-hidden="true" className="size-5" />} title="Set your travel preferences" detail="Ten quick this-or-that questions" />}
        </RowGroup> : !focus && <p className="overview-caught-up"><CheckCircle2 aria-hidden="true" className="size-5" />You’re all caught up.</p>}

        {phase !== 'traveling' && upNext}
        {polls && tasks && loadedMembers && <GroupDecisions tripId={tripId} polls={polls} members={members} unassigned={unassigned} now={now} />}
        {!!news?.length && <section aria-labelledby="news-title"><SectionTitle id="news-title" className="px-1">What’s new</SectionTitle><div className="mt-2 px-1"><ActivityList tripId={tripId} events={news.slice(0, 3)} members={members} me={me} since={newsSince} /></div>{news.length > 3 && <Link to={`${root}/activity`} className="ui-link px-1">See everything<ArrowRight aria-hidden="true" className="size-4" /></Link>}</section>}
        {loadedMembers && (!dismissed ? <section className="overview-setup" aria-labelledby="setup-title"><Disclosure summary={<span><span id="setup-title">Make it happen</span> <span className="ml-2 font-normal text-stone-600">{completed} of 3 first steps complete</span></span>} defaultOpen={!!arrival && completed < 3}>
          {completed === 3 && <p role="status" className="mb-3 flex items-center gap-3 text-sm"><Stowie mood="delighted" size={32} />Your group is off to a good start.</p>}
          <ol className="divide-y divide-stone-200">{steps.map(({ title, description, done, to, Icon }) => { const content = <><span>{done ? <CheckCircle2 aria-label="Complete" className="size-5 text-brand-700" /> : <Circle aria-label="To do" className="size-5 text-stone-600" />}</span><span className="min-w-0 flex-1"><span role="heading" aria-level={3} className="block font-medium">{title}</span><span className="block text-sm text-stone-600">{description}</span></span><Icon aria-hidden="true" className="size-4 shrink-0 text-stone-600" /></>; return <li key={title}>{to ? <Link to={to} className="overview-setup-step">{content}</Link> : <button type="button" onClick={invite} className="overview-setup-step">{content}</button>}</li> })}</ol>
          <button type="button" className="ui-link mt-2" onClick={() => setDismissed(tripId, true)}>Hide guidance</button>
        </Disclosure><div className="setup-progress" aria-hidden="true">{steps.map((step) => <span key={step.title} data-complete={step.done} />)}</div></section> : completed < 3 && <button type="button" className="ui-link px-1" onClick={() => setDismissed(tripId, false)}>Show first steps · {completed}/3 complete</button>)}
      </div>

      <aside className="overview-sidebar" aria-label="Your group and essentials">
        <Card><section id="invite-group" aria-labelledby="travelers-title" className="scroll-mt-6"><div className="flex flex-wrap items-center justify-between gap-2"><SectionTitle id="travelers-title">Your group</SectionTitle>{loadedMembers && <span className="text-xs text-stone-600">{members.length} {members.length === 1 ? 'traveler' : 'travelers'}</span>}</div>
          {!loadedMembers && <ListSkeleton label="Loading travelers…" className="mt-3" />}
          <ul className="my-3 flex flex-wrap gap-x-3 gap-y-1">{members.map((member) => <li key={member.id}><TravelerLink member={member} you={member.id === me} /></li>)}</ul>
          <Disclosure summary="Invite the group" open={inviting} onToggle={setInviting} className="border-t border-stone-200 pt-1"><InviteTripCard trip={trip} bare /></Disclosure>
        </section></Card>
        {phase === 'traveling' && <section aria-labelledby="travel-essentials-title"><SectionTitle id="travel-essentials-title" className="mb-3">Your travel essentials</SectionTitle><OfflineReadyCard trip={trip} compact /></section>}
        <section aria-labelledby="essentials-title"><h2 id="essentials-title" className="ui-label mb-2">Trip essentials</h2><ul className="ui-row-group"><Row to={`${root}/tickets`} icon={<Ticket aria-hidden="true" className="size-5" />} title="Tickets & bookings" detail={tickets ? missing ? `${missing} still to download` : tickets.length ? 'Saved on this phone' : 'Ready for your first booking' : 'Checking this phone…'} /><Row to={`${root}/money`} icon={<Wallet aria-hidden="true" className="size-5" />} title="Shared expenses" detail={money ? mine < 0 ? `You owe ${fmt(Math.abs(mine))}` : mine > 0 ? `You’re owed ${fmt(mine)}` : 'You’re settled up' : 'Loading your balance…'} /></ul></section>
        <div className="overview-personalize"><TripCoverPicker trip={trip} memberId={me} /><InstallAppButton /></div>
      </aside>
    </div>
  </div>
}
