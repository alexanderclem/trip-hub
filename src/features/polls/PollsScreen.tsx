import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChevronRight, Plus, Vote } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useMembers } from '@/data/hooks'
import { Button, Card, Field, Input, PageHeader, Textarea } from '@/ui'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/ui/collection'
import { createPoll, usePolls } from './data'
import { leader, rankOptions } from './rank'

export function PollsScreen() {
  const { tripId } = useParams() as { tripId: string }
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const polls = usePolls(tripId)
  const groupSize = useMembers(tripId)?.length ?? 1
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const id = await createPoll(tripId, title, description, me)
    navigate(id)
  }

  return (
    <div className="min-h-full pb-8">
      <PageHeader
        title="Votes"
        back={`/t/${tripId}/more`}
        action={
          <button onClick={() => setCreating((v) => !v)} className="flex size-10 items-center justify-center rounded-full text-brand-700 active:bg-brand-50" aria-label="New vote" aria-expanded={creating}>
            <Plus aria-hidden="true" className="size-6" />
          </button>
        }
      />
      <div className="mx-auto max-w-lg space-y-4 p-4">
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
              <Button type="submit" className="w-full" disabled={!title.trim()}>Create and add options</Button>
            </form>
          </Card>
        )}

        {polls?.length === 0 && !creating && (
          <Empty>
            <Vote aria-hidden="true" className="size-8 text-brand-700" />
            <EmptyHeader>
              <EmptyTitle>Decide things together</EmptyTitle>
              <EmptyDescription>Everyone scores each option from “No way” to “Must-do”. The best-loved option rises to the top.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <ul className="space-y-3">
          {polls?.map(({ poll, options, votes }) => {
            const ranked = rankOptions(options, votes, groupSize)
            const top = leader(ranked)
            const live = options.filter((o) => !o.deleted_at)
            const myVotes = votes.filter((v) => v.member_id === me && v.score != null).length
            const winner = poll.status === 'closed' ? live.find((o) => o.id === poll.winner_option_id) : null
            return (
              <li key={poll.id}>
                <Link to={poll.id} className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-600 active:bg-brand-50">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-stone-500">{poll.status === 'closed' ? 'Decided' : `${live.length} option${live.length === 1 ? '' : 's'} · you voted on ${myVotes}`}</p>
                      <h2 className="mt-1 break-words text-lg font-semibold tracking-tight">{poll.title}</h2>
                      <p className="mt-1 text-sm text-stone-600">
                        {winner ? `✓ ${winner.label}` : top ? `Leading: ${top.option.label}` : live.length ? 'Not enough votes yet' : 'No options yet'}
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
