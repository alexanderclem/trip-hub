import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Check, ChevronRight, Plus } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useMembers } from '@/data/hooks'
import { DateTime } from 'luxon'
import type { PollKind } from '@/data/types'
import { Button, Card, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/ui'
import { useCommentCounts } from '@/features/comments/data'
import { createPoll, usePolls } from './data'
import { deadlineFor, tonightAvailable, type DeadlineChoice } from './deadline'
import { leader, rankOptions, votingEnded } from './rank'
import { closesLabel } from './share'

export function PollsScreen() {
  const { tripId } = useParams() as { tripId: string }
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const polls = usePolls(tripId)
  const groupSize = useMembers(tripId)?.length ?? 1
  const commentCounts = useCommentCounts(tripId, 'poll')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<PollKind>('options')
  const [deadline, setDeadline] = useState<DeadlineChoice>('none')
  const [customDeadline, setCustomDeadline] = useState('')
  // Deadlines are set and shown in this phone's own time: people vote from home.
  const zone = DateTime.local().zoneName

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || busy) return
    const closesAt = deadlineFor(deadline, Date.now(), zone, customDeadline)
    if (closesAt === undefined) return setError('Pick a closing time that is still ahead.')
    setBusy(true)
    setError(null)
    try {
      const id = await createPoll(tripId, title, description, me, { kind, closesAt })
      navigate(id)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create this vote. Try again.') }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-full pb-8">
      <PageHeader
        title="Votes"
        back={`/t/${tripId}/more`}
        action={
          <button onClick={() => setCreating((v) => !v)} className="flex size-11 items-center justify-center rounded-full text-brand-700 active:bg-brand-50" aria-label="New vote" aria-expanded={creating}>
            <Plus aria-hidden="true" className="size-6" />
          </button>
        }
      />
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {(creating || polls?.length === 0) && (
          <Card>
            <form onSubmit={submit} className="space-y-3">
              <h2 className="font-semibold">New vote</h2>
              <Field label="What are we deciding?">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Where do we stay at the lake?" required />
              </Field>
              <Field label="Details (optional)">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Budget, dates, anything that matters" />
              </Field>
              <fieldset>
                <legend className="text-sm font-medium text-stone-700">What are the choices?</legend>
                <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-sm">
                  {([['options', 'Places or ideas'], ['dates', 'Dates that work']] as const).map(([value, label]) => (
                    <label key={value} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-center has-focus-visible:outline-2 has-focus-visible:outline-brand-700 ${kind === value ? 'bg-white font-medium shadow-sm' : 'text-stone-600'}`}>
                      <input type="radio" name="vote-kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label="Voting closes">
                <Select value={deadline} onChange={(e) => setDeadline(e.target.value as DeadlineChoice)}>
                  <option value="none">When someone closes it</option>
                  {tonightAvailable(Date.now(), zone) && <option value="tonight">Tonight at 9 PM</option>}
                  <option value="day">In 24 hours</option>
                  <option value="three">In 3 days</option>
                  <option value="custom">Pick a time…</option>
                </Select>
              </Field>
              {deadline === 'custom' && (
                <Field label="Closing time">
                  <Input type="datetime-local" value={customDeadline} onChange={(e) => setCustomDeadline(e.target.value)} required />
                </Field>
              )}
              <ErrorNote error={error} />
              <Button type="submit" className="w-full" disabled={busy || !title.trim()}>{busy ? 'Creating vote…' : kind === 'dates' ? 'Create and add dates' : 'Create and add options'}</Button>
            </form>
          </Card>
        )}

        <ul className="space-y-3">
          {polls?.map(({ poll, options, votes }) => {
            const ranked = rankOptions(options, votes, groupSize)
            const top = leader(ranked)
            const live = options.filter((o) => !o.deleted_at)
            const myVotes = votes.filter((v) => v.member_id === me && v.score != null).length
            const ended = votingEnded(poll, Date.now())
            const comments = commentCounts?.get(poll.id) ?? 0
            const winner = poll.status === 'closed' ? live.find((o) => o.id === poll.winner_option_id) : ended ? top?.option : null
            return (
              <li key={poll.id}>
                <Link to={poll.id} className="block rounded-2xl border border-stone-200 bg-surface p-4 transition-colors hover:border-brand-600 active:bg-brand-50">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-stone-500">{ended ? (winner ? 'Decided' : 'Voting ended') : `${live.length} option${live.length === 1 ? '' : 's'} · you voted on ${myVotes}${poll.closes_at ? ` · closes ${closesLabel(poll.closes_at, Date.now(), zone)}` : ''}`}{comments > 0 && ` · ${comments} ${comments === 1 ? 'comment' : 'comments'}`}</p>
                      <h2 className="mt-1 break-words text-lg font-semibold tracking-tight">{poll.title}</h2>
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-stone-600">
                        {winner && <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" />}
                        {winner ? winner.label : top ? `Leading: ${top.option.label}` : live.length ? 'Not enough votes yet' : 'No options yet'}
                      </p>
                    </div>
                    <ChevronRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-stone-400" />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
