import { use, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { DateTime } from 'luxon'
import { ArrowRight, CalendarDays, ClipboardCheck, Compass, MapPin, Sparkles, Ticket, Users, Vote, Wallet } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useLegContext, useMembers, usePlaces, useTrip } from '@/data/hooks'
import { useDisplayZone, useItems } from '@/features/itinerary/data'
import { UpNextCard } from '@/features/itinerary/UpNextCard'
import { planTransfers } from '@/features/itinerary/travel'
import { useTasks } from '@/features/tasks/data'
import { Avatar, Button, HeaderTools, LinkButton, Row, RowGroup } from '@/ui'
import { Dialog } from '@/ui/Dialog'
import { LoadingState } from '@/ui/LoadingState'
import { usePolls } from '@/features/polls/data'
import { useActivity } from '@/features/activity/data'
import { votingEnded } from '@/features/polls/rank'
import { useMoney } from '@/features/money/data'
import { useMoneyFormat } from '@/features/money/format'
import { useAttachments } from '@/features/tickets/files'
import { balances } from '@/lib/money'
import { dateRange, formatDate } from '@/lib/time'
import { useNow } from '@/lib/useNow'
import { OfflineReadyCard } from '@/features/offline/OfflineReadyCard'
import { tripAreas } from '@/features/destinations/destinations'
import { InviteTripCard } from './InviteTripCard'
import { TripArtwork } from './TripArtwork'
import { tripCover, tripStatus } from './presentation'
import { voteStatus } from './decisions'
import { TripDayPreview } from './TripDayPreview'
import { itemsFor } from '@/features/itinerary/calendar'
import { autoPhoto, coverPhoto } from './covers'

/** One priority and a glimpse of the plan. Details live in their own screens. */
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
  const legCtx = useLegContext(tripId)
  const { zone } = useDisplayZone(trip)
  const { fmt } = useMoneyFormat(trip, money?.snapshot ?? null)
  const tools = use(HeaderTools)
  const [params, setParams] = useSearchParams()
  const [arrival] = useState(() => params.has('created') ? 'created' : params.has('joined') ? 'joined' : null)
  const [inviting, setInviting] = useState(false)
  const now = useNow()
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
  const today = DateTime.fromMillis(now, { zone: trip.timezone }).toISODate()!
  const savedPlaces = places.filter((place) => place.status !== 'catalog' && place.status !== 'rejected')
  const cover = phase === 'traveling' || phase === 'preparing' ? 'none' : tripCover(trip)
  const destinations = tripAreas(trip).map((area) => area.name).join(' · ')
  const waiting = (polls ?? []).filter(({ poll, options, votes }) => !votingEnded(poll, now)
    && options.some((option) => !votes.some((vote) => vote.option_id === option.id && vote.member_id === me && vote.score != null)))
    .sort((a, b) => (a.poll.closes_at ?? '9999').localeCompare(b.poll.closes_at ?? '9999'))
  const myTasks = (tasks ?? []).filter((task) => !task.completed && task.assignee_id === me)
  const overdue = myTasks.find((task) => task.due_date && task.due_date < today)
  const unassigned = (tasks ?? []).filter((task) => !task.completed && !task.assignee_id).length
  const missing = tickets?.filter((ticket) => !ticket.onPhone).length ?? 0
  const ready = polls !== undefined && tasks !== undefined && money !== undefined && tickets !== undefined && loadedMembers !== undefined
  const focus = overdue ? { title: overdue.title, detail: `Overdue · ${formatDate(overdue.due_date!)}`, action: 'Review task', to: `${root}/more/tasks/${overdue.id}` }
    : waiting[0] ? { title: waiting[0].poll.title, detail: voteStatus(waiting[0].options, waiting[0].votes, members, me), action: 'Cast your vote', to: `${root}/more/vote/${waiting[0].poll.id}` }
    : mine < 0 ? { title: `You owe ${fmt(Math.abs(mine))}`, detail: '', action: 'See expenses', to: `${root}/money` }
    : myTasks[0] ? { title: myTasks[0].title, detail: '', action: 'Review task', to: `${root}/more/tasks/${myTasks[0].id}` }
    : null
  const showFocus = ready && focus && phase === 'planning'
  const personalItems = itemsFor(items, me)
  const previewDay = phase === 'traveling' ? today : trip.start_date ?? personalItems[0]?.start_local.slice(0, 10) ?? today

  return <div data-phase={phase} data-introduction={!!arrival} className="trip-page trip-overview overview-simple px-4 pb-10 pt-safe sm:px-8">
    <header className={`overview-journal ${cover === 'none' ? 'overview-journal-plain' : ''}`}>
      <div className="overview-journal-top"><Link to="/app" className="ui-link"><Compass aria-hidden="true" className="size-4" />Your trips</Link><div className="overview-tools">{tools}</div></div>
      <div className="overview-journal-content">
        <div className="min-w-0">
          <h1 className="travel-heading wrap-anywhere">{trip.name}</h1>
          <div className="overview-meta"><Link to={`/t/${tripId}/more/dates`} aria-label={`${dateRange(trip.start_date, trip.end_date) || 'No dates yet'}. Change trip dates`} className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-4 hover:text-action"><CalendarDays aria-hidden="true" className="size-4" />{dateRange(trip.start_date, trip.end_date) || 'Add dates'}</Link><span className={`trip-phase trip-phase-${phase}`}>{phaseLabel}</span></div>
        </div>
        {cover !== 'none' && <figure key={cover} className="overview-postcard"><div className="overview-art"><TripArtwork cover={cover} photo={coverPhoto(trip)} destination={autoPhoto(trip)} /></div></figure>}
      </div>
      <div className="overview-group-bar">
        {loadedMembers && <Link to={`${root}/travelers`} className="overview-traveler-link"><span className="traveler-stack" aria-hidden="true">{members.slice(0, 3).map((member) => <Avatar key={member.id} name={member.display_name} color={member.color} photo={member.avatar_url} size="sm" />)}</span><span>{members.length} {members.length === 1 ? 'traveler' : 'travelers'}</span><ArrowRight aria-hidden="true" className="size-3.5" /></Link>}
        <Button variant="ghost" onClick={() => setInviting(true)} aria-haspopup="dialog">Invite</Button>
      </div>
    </header>

    <div className="overview-main space-y-5">
      {arrival && <p role="status" className="text-sm text-muted">{arrival === 'created' ? 'Trip created' : 'Joined trip'}</p>}
      {showFocus ? <section className="overview-focus" aria-labelledby="trip-focus-title"><div className="min-w-0"><h2 id="trip-focus-title" className="travel-heading wrap-anywhere">{focus.title}</h2>{focus.detail && <p className="mt-2 text-sm text-muted">{focus.detail}</p>}<LinkButton to={focus.to} className="mt-3">{focus.action}<ArrowRight aria-hidden="true" className="size-4" /></LinkButton></div></section>
        : ready && phase === 'planning' && <section className="overview-focus" aria-labelledby="trip-focus-title"><div className="min-w-0"><h2 id="trip-focus-title" className="travel-heading">{members.length < 2 ? 'Who’s coming?' : savedPlaces.length ? 'Put a place in the plan' : 'Where should we go?'}</h2>{members.length < 2 ? <Button className="mt-3" onClick={() => setInviting(true)} aria-haspopup="dialog">Invite friends<Users aria-hidden="true" className="size-4" /></Button> : <LinkButton to={`${root}/more/places${savedPlaces.length ? '' : '/new'}`} className="mt-3">{savedPlaces.length ? 'Choose a saved place' : 'Save a place'}<ArrowRight aria-hidden="true" className="size-4" /></LinkButton>}</div></section>}

      {phase === 'traveling' && <UpNextCard tripId={tripId} items={items} places={places} members={members} me={me} zone={zone} transfers={transfers} prominent />}
      {phase === 'preparing' && <OfflineReadyCard trip={trip} compact />}
      {phase === 'complete' && <LinkButton to={`${root}/wrapped`} variant="secondary"><Sparkles aria-hidden="true" className="size-4" />Trip recap</LinkButton>}
      {phase !== 'complete' && <TripDayPreview tripId={tripId} day={previewDay} items={personalItems} places={places} zone={zone} today={today} />}
      {!personalItems.length && phase !== 'complete' && <Link to={`${root}/plan`} className="overview-empty-plan ui-link"><CalendarDays aria-hidden="true" className="size-5" />Start the itinerary<ArrowRight aria-hidden="true" className="size-4" /></Link>}

      <RowGroup label="Trip essentials">
        <Row to={`${root}/more/places`} icon={<MapPin aria-hidden="true" className="size-5" />} title="Places" trailing={String(savedPlaces.length)} />
        {waiting.length > (showFocus && focus?.to.includes('/vote/') ? 1 : 0) && <Row to={`${root}/more/vote`} icon={<Vote aria-hidden="true" className="size-5" />} title="Votes" trailing={`${waiting.length} need you`} />}
        <Row to={`${root}/more/tasks${unassigned && !myTasks.length ? '?filter=unassigned' : myTasks.length ? '?filter=mine' : ''}`} icon={<ClipboardCheck aria-hidden="true" className="size-5" />} title="Tasks" trailing={tasks === undefined ? undefined : overdue ? <span className="text-danger-ink">Overdue</span> : myTasks.length ? `${myTasks.length} for you` : unassigned ? `${unassigned} unassigned` : undefined} />
        <Row to={`${root}/tickets`} icon={<Ticket aria-hidden="true" className="size-5" />} title="Tickets" trailing={missing ? `${missing} to download` : undefined} />
        <Row to={`${root}/money`} icon={<Wallet aria-hidden="true" className="size-5" />} title="Shared expenses" trailing={money && !(showFocus && focus?.to === `${root}/money`) ? mine < 0 ? `Owe ${fmt(Math.abs(mine))}` : mine > 0 ? `Owed ${fmt(mine)}` : undefined : undefined} />
      </RowGroup>
      <div className="overview-footer">
        {!!news?.length && <Link to={`${root}/activity`} className="ui-link">Recent activity<ArrowRight aria-hidden="true" className="size-4" /></Link>}
        <Link to={`${root}/more/settings`} className="ui-link">Trip settings</Link>
      </div>
      {phase === 'traveling' && <OfflineReadyCard trip={trip} compact />}
    </div>
    <Dialog open={inviting} onClose={() => setInviting(false)} title="Invite friends"><InviteTripCard trip={trip} bare /></Dialog>
    {destinations && <span className="sr-only">Destination: {destinations}</span>}
  </div>
}
