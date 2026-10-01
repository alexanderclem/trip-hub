import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { CalendarPlus, Lock, LockOpen, Plus, Search, Trash2, Trophy } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useMembers, usePlaces } from '@/data/hooks'
import { save, softDelete } from '@/data/repo'
import { VOTE_SCORES, type Member, type Place, type Poll, type PollOption, type PollVote, type VoteScore } from '@/data/types'
import { Avatar, Button, Card, ErrorNote, Input, PageHeader } from '@/ui'
import { PlaceCategoryIcon, PlaceStatusBadge } from '@/features/places/PlaceSummary'
import { StarsSummary } from '@/features/ratings/Stars'
import { addOption, usePoll, useRatingSummaries, vote } from './data'
import { leader, rankOptions, SCORE_LABEL, type RankedOption } from './rank'

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
  const members = useMembers(tripId) ?? []
  const places = usePlaces(tripId) ?? []
  const ratings = useRatingSummaries(tripId)
  const [tab, setTab] = useState<'vote' | 'results'>('vote')

  const ranked = useMemo(() => (data ? rankOptions(data.options, data.votes, Math.max(1, members.length)) : []), [data, members.length])
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
  const closed = poll.status === 'closed'
  const placeOf = (o: PollOption) => (o.place_id ? places.find((p) => p.id === o.place_id) : undefined)
  const myScore = (o: PollOption) => votes.find((v) => v.option_id === o.id && v.member_id === me)?.score ?? null
  const myCount = options.filter((o) => myScore(o) != null).length
  const winner = closed ? options.find((o) => o.id === poll.winner_option_id) : undefined
  const winnerPlace = winner && placeOf(winner)

  async function setStatus(status: Poll['status']) {
    const top = leader(ranked)
    await save('polls', { ...poll, status, winner_option_id: status === 'closed' ? (top?.option.id ?? null) : null }, me)
    if (status === 'closed') setTab('results')
  }

  return (
    <div className="min-h-full pb-10">
      <PageHeader title={poll.title} back={`/t/${tripId}/more/vote`} />
      <div className="mx-auto max-w-lg space-y-4 p-4">
        {poll.description && <p className="text-sm whitespace-pre-wrap text-stone-600">{poll.description}</p>}

        {winner && (
          <Card className="border-brand-200 bg-brand-50">
            <p className="flex items-center gap-2 text-sm font-medium text-brand-900"><Trophy aria-hidden="true" className="size-4" />Decided</p>
            <p className="mt-1 text-lg font-semibold">{winner.label}</p>
            {winnerPlace && (
              <div className="mt-3">
                {['catalog', 'shortlist'].includes(winnerPlace.status) ? (
                  <Button onClick={() => save('places', { ...winnerPlace, status: 'planned' }, me)} className="w-full">
                    <CalendarPlus aria-hidden="true" className="size-4" />Add to the plan
                  </Button>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-brand-900">On the plan: <PlaceStatusBadge status={winnerPlace.status} /></p>
                )}
              </div>
            )}
          </Card>
        )}

        <div role="tablist" aria-label="View" className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-sm">
          {(['vote', 'results'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-11 rounded-lg ${tab === t ? 'bg-white font-medium shadow-sm' : 'text-stone-600'}`}>
              {t === 'vote' ? `Vote (${myCount}/${options.length})` : 'Results'}
            </button>
          ))}
        </div>

        {tab === 'vote' ? (
          <ul className="space-y-3">
            {options.map((o) => (
              <OptionVoteCard key={o.id} option={o} place={placeOf(o)} rating={o.place_id ? ratings?.get(o.place_id) : undefined} score={myScore(o)} closed={closed} me={me} />
            ))}
            {options.length === 0 && <p className="text-sm text-stone-500">No options yet. Add the first one below.</p>}
          </ul>
        ) : (
          <Results ranked={ranked} votes={votes} members={members} groupSize={members.length} winnerId={poll.winner_option_id} placeOf={placeOf} />
        )}

        {!closed && <AddOptionCard poll={poll} options={options} places={places} me={me} />}

        <Button variant="secondary" className="w-full" onClick={() => setStatus(closed ? 'open' : 'closed')}>
          {closed ? <><LockOpen aria-hidden="true" className="size-4" />Reopen voting</> : <><Lock aria-hidden="true" className="size-4" />Close voting and pick the winner</>}
        </Button>
      </div>
    </div>
  )
}

function OptionVoteCard({ option, place, rating, score, closed, me }: {
  option: PollOption; place?: Place; rating?: Parameters<typeof StarsSummary>[0]['summary']; score: VoteScore | null; closed: boolean; me: string
}) {
  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
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
          <button onClick={() => confirm(`Remove “${option.label}” from this vote?`) && softDelete('poll_options', option.id, me)} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100" aria-label={`Remove ${option.label}`}>
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      <div role="group" aria-label={`Your vote for ${option.label}`} className="mt-3 grid grid-cols-4 gap-1.5">
        {VOTE_SCORES.map((s) => (
          <button
            key={s}
            disabled={closed}
            aria-pressed={score === s}
            onClick={() => vote(option, me, score === s ? null : s)}
            className={`min-h-11 rounded-xl border px-1 text-sm font-medium transition-colors disabled:opacity-50 ${score === s ? SCORE_STYLE[s] : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}
          >
            {SCORE_LABEL[s]}
          </button>
        ))}
      </div>
    </li>
  )
}

function Results({ ranked, votes, members, groupSize, winnerId, placeOf }: {
  ranked: RankedOption[]; votes: PollVote[]; members: Member[]; groupSize: number; winnerId: string | null; placeOf: (o: PollOption) => Place | undefined
}) {
  const top = leader(ranked)
  if (!ranked.length) return <p className="text-sm text-stone-500">No options yet.</p>
  return (
    <ol className="space-y-3">
      {ranked.map((r, i) => {
        const isTop = r.option.id === (winnerId ?? top?.option.id)
        const place = placeOf(r.option)
        return (
          <li key={r.option.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${isTop ? 'border-brand-500' : 'border-stone-200'}`}>
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
                  {r.counts[0] > 0 && <span className="ml-2 font-medium text-red-700">{r.counts[0]} × No way</span>}
                </p>
                {r.needsVotes && r.voters > 0 && <p className="mt-1 text-xs text-amber-800">Needs votes from at least half the group to count.</p>}
                <WhoVoted optionId={r.option.id} votes={votes} members={members} />
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function WhoVoted({ optionId, votes, members }: { optionId: string; votes: PollVote[]; members: Member[] }) {
  const rows = [3, 2, 1, 0]
    .map((s) => ({ s: s as VoteScore, who: votes.filter((v) => v.option_id === optionId && v.score === s).map((v) => members.find((m) => m.id === v.member_id)).filter(Boolean) as Member[] }))
    .filter((r) => r.who.length)
  if (!rows.length) return null
  return (
    <ul className="mt-2 space-y-1">
      {rows.map(({ s, who }) => (
        <li key={s} className="flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
          <span className="w-16 shrink-0 font-medium">{SCORE_LABEL[s]}</span>
          {who.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1"><Avatar name={m.display_name} color={m.color} size="sm" />{m.display_name}</span>
          ))}
        </li>
      ))}
    </ul>
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
