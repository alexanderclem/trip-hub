import { TravelerLink } from '@/features/trips/TravelerLink'
import { useConfirm } from '@/ui/ConfirmProvider'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { DateTime } from 'luxon'
import { CalendarCheck, CalendarPlus, Clock, Lock, LockOpen, Plus, Search, Share2, Trash2, Trophy } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useMembers, usePlaces, useTrip } from '@/data/hooks'
import { save, softDelete } from '@/data/repo'
import { VOTE_SCORES, type Member, type Place, type Poll, type PollOption, type PollVote, type Trip, type VoteScore } from '@/data/types'
import { useOnline } from '@/lib/useOnline'
import { Button, Card, DateInput, ErrorNote, Field, Input, LinkButton, PageHeader } from '@/ui'
import { PlaceCategoryIcon, PlaceStatusBadge } from '@/features/places/PlaceSummary'
import { StarsSummary } from '@/features/ratings/Stars'
import { CommentThread } from '@/features/comments/CommentThread'
import { addDateOption, addOption, usePoll, useRatingSummaries, vote } from './data'
import { dateRangeLabel } from './deadline'
import { leader, rankOptions, scoreLabels, voterCount, votingEnded, type RankedOption } from './rank'
import { closesLabel } from './share'
import { SharePollCard, useSharePoll } from './SharePoll'

/** The current time, refreshed often enough for a deadline to pass while the page is open. */
function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const timer = setInterval(refresh, everyMs)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [everyMs])
  return now
}

const SCORE_STYLE: Record<VoteScore, string> = {
  0: 'border-red-300 bg-red-50 text-red-800',
  1: 'border-stone-400 bg-stone-100 text-stone-800',
  2: 'border-brand-500 bg-brand-50 text-brand-900',
  3: 'border-brand-700 bg-brand-700 text-white',
}

export function PollScreen() {
  const { tripId, pollId } = useParams() as { tripId: string; pollId: string }
  const me = useMyMemberId(tripId)!
  const data = usePoll(pollId)
  const trip = useTrip(tripId)
  const loadedMembers = useMembers(tripId)
  const members = loadedMembers ?? []
  const places = usePlaces(tripId) ?? []
  const ratings = useRatingSummaries(tripId)
  const online = useOnline()
  const now = useNow()
  const [tab, setTab] = useState<'vote' | 'results'>('vote')

  const ranked = useMemo(() => (data ? rankOptions(data.options, data.votes, Math.max(1, members.length)) : []), [data, members.length])

  // A deadline that has passed closes the vote for everyone. The first phone to see it with signal
  // records the winner; the ranking is the same on every phone, so two of them agree.
  const finalised = useRef<string | null>(null)
  const due = !!data && !data.poll.deleted_at && data.poll.status === 'open' && votingEnded(data.poll, now)
  useEffect(() => {
    if (!due || !online || !loadedMembers || !data || finalised.current === data.poll.id) return
    finalised.current = data.poll.id
    void save('polls', { ...data.poll, status: 'closed', winner_option_id: leader(ranked)?.option.id ?? null }, me)
  }, [due, online, loadedMembers, data, ranked, me])

  const sharing = useSharePoll(trip, data && !data.poll.deleted_at ? data.poll : undefined, data?.options ?? [])

  if (data === undefined) return <PageHeader title="Vote" back={`/t/${tripId}/more/vote`} />
  if (data === null || data.poll.deleted_at) {
    return (
      <div>
        <PageHeader title="Vote" back={`/t/${tripId}/more/vote`} />
        <p className="p-5 text-stone-500">This vote was deleted.</p>
      </div>
    )
  }

  const { poll, options, votes } = data
  const closed = votingEnded(poll, now)
  const labels = scoreLabels(poll.kind)
  const zone = DateTime.local().zoneName
  const placeOf = (o: PollOption) => (o.place_id ? places.find((p) => p.id === o.place_id) : undefined)
  const myScore = (o: PollOption) => votes.find((v) => v.option_id === o.id && v.member_id === me)?.score ?? null
  const myCount = options.filter((o) => myScore(o) != null).length
  // Past the deadline but not yet recorded as closed: the leader is the winner-to-be.
  const winnerId = poll.status === 'closed' ? poll.winner_option_id : closed ? (leader(ranked)?.option.id ?? null) : null
  const winner = winnerId ? options.find((o) => o.id === winnerId) : undefined
  const winnerPlace = winner && placeOf(winner)
  const quiet = !closed && options.length >= 2 && voterCount(votes) < Math.ceil(Math.max(1, members.length) / 2)

  async function setStatus(status: Poll['status']) {
    const top = leader(ranked)
    // Reopening drops the deadline, or the vote would close again at once.
    await save('polls', { ...poll, status, winner_option_id: status === 'closed' ? (top?.option.id ?? null) : null, closes_at: status === 'open' ? null : poll.closes_at }, me)
    if (status === 'closed') setTab('results')
  }

  return (
    <div className="min-h-full pb-10">
      <PageHeader
        title={poll.title}
        back={`/t/${tripId}/more/vote`}
        action={sharing.ready && (
          <button onClick={() => void sharing.share()} className="ui-icon-button shrink-0 text-brand-700" aria-label="Share this vote">
            <Share2 aria-hidden="true" className="size-5" />
          </button>
        )}
      />
      <div className="mx-auto max-w-lg space-y-4 p-4">
        {poll.description && <p className="text-sm whitespace-pre-wrap text-stone-600">{poll.description}</p>}
        {poll.closes_at && (
          <p className="flex items-center gap-2 text-sm text-stone-600">
            <Clock aria-hidden="true" className="size-4 shrink-0" />
            {closed ? 'Voting has ended.' : `Voting closes ${closesLabel(poll.closes_at, now, zone)}.`}
          </p>
        )}
        {quiet && sharing.ready && <SharePollCard sharing={sharing} />}

        {winner && (
          <Card className="border-brand-200 bg-brand-50">
            <p className="flex items-center gap-2 text-sm font-medium text-brand-900"><Trophy aria-hidden="true" className="size-4" />Decided</p>
            <p className="mt-1 text-lg font-semibold">{winner.label}</p>
            <div className="mt-3">
              {winner.starts_on && trip ? (
                <TripDatesAction trip={trip} option={winner} me={me} />
              ) : winnerPlace && !['catalog', 'shortlist'].includes(winnerPlace.status) ? (
                <p className="flex items-center gap-2 text-sm text-brand-900">On the plan: <PlaceStatusBadge status={winnerPlace.status} /></p>
              ) : (
                <LinkButton to={`/t/${poll.trip_id}/plan/new?${winnerPlace ? `place=${winnerPlace.id}` : `title=${encodeURIComponent(winner.label)}`}`} className="w-full">
                  <CalendarPlus aria-hidden="true" className="size-4" />Add to the plan
                </LinkButton>
              )}
            </div>
          </Card>
        )}

        <div role="tablist" aria-label="View" className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-sm">
          {(['vote', 'results'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const next = event.key === 'Home' ? 'vote' : event.key === 'End' ? 'results' : t === 'vote' ? 'results' : 'vote'
              setTab(next)
              const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
              tabs?.[next === 'vote' ? 0 : 1]?.focus()
            }} onClick={() => setTab(t)} className={`min-h-11 rounded-lg ${tab === t ? 'bg-white font-medium shadow-sm' : 'text-stone-600'}`}>
              {t === 'vote' ? `Vote (${myCount}/${options.length})` : 'Results'}
            </button>
          ))}
        </div>

        {tab === 'vote' ? (
          <ul className="space-y-3">
            {options.map((o) => (
              <OptionVoteCard key={o.id} option={o} place={placeOf(o)} rating={o.place_id ? ratings?.get(o.place_id) : undefined} score={myScore(o)} closed={closed} me={me} labels={labels} />
            ))}
            {options.length === 0 && <p className="text-sm text-stone-500">No options yet. Add the first one below.</p>}
          </ul>
        ) : (
          <Results ranked={ranked} votes={votes} members={members} groupSize={members.length} winnerId={winnerId} placeOf={placeOf} labels={labels} dates={poll.kind === 'dates'} />
        )}

        {!closed && (poll.kind === 'dates' ? <AddDatesCard poll={poll} trip={trip} me={me} /> : <AddOptionCard poll={poll} options={options} places={places} me={me} />)}

        <CommentThread tripId={tripId} type="poll" subjectId={poll.id} me={me} prompt="Say why, or suggest something else" />

        <Button variant="secondary" className="w-full" onClick={() => setStatus(closed ? 'open' : 'closed')}>
          {closed ? <><LockOpen aria-hidden="true" className="size-4" />Reopen voting</> : <><Lock aria-hidden="true" className="size-4" />Close voting and pick the winner</>}
        </Button>
      </div>
    </div>
  )
}

/** A winning set of dates becomes the trip's dates with one tap. */
function TripDatesAction({ trip, option, me }: { trip: Trip; option: PollOption; me: string }) {
  const confirm = useConfirm()
  const start = option.starts_on!
  const end = option.ends_on ?? start
  if (trip.start_date === start && trip.end_date === end) {
    return <p className="flex items-center gap-2 text-sm text-brand-900"><CalendarCheck aria-hidden="true" className="size-4" />These are the trip’s dates.</p>
  }
  async function apply() {
    if (trip.start_date && !(await confirm(`Change the trip’s dates from ${dateRangeLabel(trip.start_date, trip.end_date)} to ${dateRangeLabel(start, end)}? Plan items keep the days they already have.`))) return
    await save('trips', { ...trip, start_date: start, end_date: end }, me)
  }
  return <Button className="w-full" onClick={() => void apply()}><CalendarCheck aria-hidden="true" className="size-4" />Set as the trip’s dates</Button>
}

function OptionVoteCard({ option, place, rating, score, closed, me, labels }: {
  option: PollOption; place?: Place; rating?: Parameters<typeof StarsSummary>[0]['summary']; score: VoteScore | null; closed: boolean; me: string; labels: Record<VoteScore, string>
}) {
  const confirm = useConfirm()
  const inFlight = useRef(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function castVote(next: VoteScore | null) {
    if (closed || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setMessage('Saving your vote…')
    setError(null)
    try {
      await vote(option, me, next)
      setMessage(next === null ? 'Vote removed from this device. Changes sync when connected.' : 'Vote saved on this device. Changes sync when connected.')
    } catch {
      setMessage('')
      setError('Your vote could not be saved. Try again; your previous choice is unchanged.')
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }
  return (
    <li className="rounded-2xl border border-stone-200 bg-surface p-4">
      <div className="flex items-start gap-3">
        {place && <PlaceCategoryIcon category={place.category} />}
        <div className="min-w-0 flex-1">
          {place ? (
            <Link to={`/t/${place.trip_id}/more/places/${place.id}`} className="break-words font-semibold hover:text-brand-700">{option.label}</Link>
          ) : option.url ? (
            <a href={option.url} target="_blank" rel="noreferrer" className="break-words font-semibold text-brand-700">{option.label}<span className="sr-only"> (opens in a new tab)</span></a>
          ) : (
            <p className="break-words font-semibold">{option.label}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            {place?.area && <span>{place.area}</span>}
            <StarsSummary summary={rating} />
          </div>
          {option.description && <p className="mt-1 text-sm text-stone-600">{option.description}</p>}
        </div>
        {!closed && (
          <button onClick={async () => { if (await confirm(`Remove “${option.label}” from this vote?`)) await softDelete('poll_options', option.id, me) }} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100" aria-label={`Remove ${option.label}`}>
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      <div role="group" aria-label={`Your vote for ${option.label}`} aria-busy={saving} className="mt-3 grid grid-cols-4 gap-1.5">
        {VOTE_SCORES.map((s) => (
          <button
            key={s}
            disabled={closed || saving}
            aria-pressed={score === s}
            onClick={() => void castVote(score === s ? null : s)}
            className={`min-h-11 rounded-xl border px-1 text-sm font-medium transition-colors disabled:opacity-50 ${score === s ? SCORE_STYLE[s] : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}
          >
            {labels[s]}
          </button>
        ))}
      </div>
      <div className="mt-2 min-h-10">
        <p role="status" className="text-xs leading-5 text-stone-600">{message}</p>
        <ErrorNote error={error} />
      </div>
    </li>
  )
}

function Results({ ranked, votes, members, groupSize, winnerId, placeOf, labels, dates }: {
  ranked: RankedOption[]; votes: PollVote[]; members: Member[]; groupSize: number; winnerId: string | null; placeOf: (o: PollOption) => Place | undefined
  labels: Record<VoteScore, string>; dates: boolean
}) {
  const top = leader(ranked)
  if (!ranked.length) return <p className="text-sm text-stone-500">No options yet.</p>
  return (
    <ol className="space-y-3">
      {ranked.map((r, i) => {
        const isTop = r.option.id === (winnerId ?? top?.option.id)
        const place = placeOf(r.option)
        return (
          <li key={r.option.id} className={`rounded-2xl border bg-surface p-4 ${isTop ? 'border-brand-500' : 'border-stone-200'}`}>
            <div className="flex items-start gap-3">
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${isTop ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-600'}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold">{r.option.label}</p>
                {place?.area && <p className="text-xs text-stone-500">{place.area}</p>}
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${((r.mean ?? 0) / 3) * 100}%` }} />
                </div>
                <p className="mt-1.5 text-sm text-stone-600">
                  {r.mean != null ? `${r.mean.toFixed(1)} avg · ${r.voters} of ${groupSize} voted` : 'No votes yet'}
                  {r.counts[0] > 0 && <span className="ml-2 font-medium text-red-700">{r.counts[0]} × {labels[0]}</span>}
                </p>
                {dates && r.counts[0] === 0 && groupSize > 0 && r.voters >= groupSize && <p className="mt-1 text-sm font-medium text-brand-700">Everyone can make it.</p>}
                {r.needsVotes && r.voters > 0 && <p className="mt-1 text-xs text-amber-800">Needs votes from at least half the group to count.</p>}
                <WhoVoted optionId={r.option.id} votes={votes} members={members} labels={labels} />
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function WhoVoted({ optionId, votes, members, labels }: { optionId: string; votes: PollVote[]; members: Member[]; labels: Record<VoteScore, string> }) {
  const rows = [3, 2, 1, 0]
    .map((s) => ({ s: s as VoteScore, who: votes.filter((v) => v.option_id === optionId && v.score === s).map((v) => members.find((m) => m.id === v.member_id)).filter(Boolean) as Member[] }))
    .filter((r) => r.who.length)
  if (!rows.length) return null
  return (
    <ul className="mt-2 space-y-1">
      {rows.map(({ s, who }) => (
        <li key={s} className="flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
          <span className="w-16 shrink-0 font-medium">{labels[s]}</span>
          {who.map((m) => (
            <TravelerLink key={m.id} member={m} />
          ))}
        </li>
      ))}
    </ul>
  )
}

function AddDatesCard({ poll, trip, me }: { poll: Poll; trip: Trip | undefined; me: string }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const today = DateTime.now().setZone(trip?.timezone ?? 'utc').toISODate() ?? undefined

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!from) return
    if (to && to < from) return setError('The last day is before the first day.')
    // Clear before saving, so dates typed for the next option aren't wiped when the save lands.
    setFrom(''); setTo(''); setError(null)
    try { await addDateOption(poll, from, to || null, me) }
    catch (e) { setFrom(from); setTo(to); setError(e instanceof Error ? e.message : 'Could not add those dates. Try again.') }
  }

  return (
    <Card>
      <h2 className="font-semibold">Add dates</h2>
      <form onSubmit={add} className="mt-2 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="First day"><DateInput value={from} min={today} onValue={(date) => { setFrom(date); setError(null) }} required /></Field>
          <Field label="Last day (optional)"><DateInput value={to} min={from || today} onValue={(date) => { setTo(date); setError(null) }} /></Field>
        </div>
        <ErrorNote error={error} />
        <Button type="submit" variant="secondary" className="w-full" disabled={!from}>{from ? `Add ${dateRangeLabel(from, to || null)}` : 'Add these dates'}</Button>
      </form>
    </Card>
  )
}

function AddOptionCard({ poll, options, places, me }: { poll: Poll; options: PollOption[]; places: Place[]; me: string }) {
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const taken = new Set(options.map((o) => o.place_id).filter(Boolean))
  const needle = q.trim().toLowerCase()
  const matches = needle.length >= 2
    ? places
        .filter((p) => !p.deleted_at && !taken.has(p.id) && `${p.name} ${p.area ?? ''}`.toLowerCase().includes(needle))
        // The group's picks first, then the idea pool.
        .sort((a, b) => Number(a.status === 'catalog') - Number(b.status === 'catalog') || a.name.localeCompare(b.name))
        .slice(0, 6)
    : []

  async function addText(e: FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    if (options.some((o) => o.label.trim().toLowerCase() === q.trim().toLowerCase())) return setError('That option is already in this vote.')
    await addOption(poll, { label: q }, me)
    setQ('')
    setError(null)
  }

  return (
    <Card>
      <h2 className="font-semibold">Add an option</h2>
      <form onSubmit={addText} className="mt-2">
        <div className="relative">
          <Search aria-hidden="true" className="absolute top-3 left-3 size-5 text-stone-400" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setError(null) }} placeholder="Search places, or type any option" className="pl-10" aria-label="Option" />
        </div>
        {matches.length > 0 && (
          <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200">
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { void addOption(poll, { label: p.name, placeId: p.id }, me); setQ('') }} className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50">
                  <Plus aria-hidden="true" className="size-4 shrink-0 text-brand-700" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 text-xs text-stone-500">{p.area}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <ErrorNote error={error} />
        {q.trim() && (
          <Button type="submit" variant="secondary" className="mt-2 w-full">
            Add “{q.trim()}” as a text option
          </Button>
        )}
      </form>
    </Card>
  )
}
