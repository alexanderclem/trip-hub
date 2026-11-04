import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Check, Vote } from 'lucide-react'
import type { Place } from '@/data/types'
import { Button, ErrorNote, Field, Input, Select } from '@/ui'
import { Dialog } from '@/ui/Dialog'
import { addOption, createPlacePoll, usePollsForPlace } from './data'
import { votingEnded } from './rank'
import { useNow } from '@/lib/useNow'

/** A saved place goes straight into a real group decision, retaining its notes. */
export function AddToPollCard({ place, memberId }: { place: Place; memberId: string }) {
  const polls = usePollsForPlace(place.trip_id, place.id)
  const now = useNow()
  const navigate = useNavigate()
  const open = polls?.filter((p) => !votingEnded(p.poll, now) && p.poll.kind !== 'dates' && !p.includesPlace) ?? []
  const included = polls?.filter((p) => p.includesPlace && !votingEnded(p.poll, now)) ?? []
  const [choice, setChoice] = useState('')
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState(`Which ${place.category === 'lodging' ? 'place to stay' : place.category === 'food' ? 'restaurant' : 'one'}?`)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const selected = open.find((p) => p.poll.id === choice)?.poll ?? open[0]?.poll

  async function commit(create: boolean) {
    if (inFlight.current || !create && !selected) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const id = create ? await createPlacePoll(place, title.trim(), memberId) : selected!.id
      if (!create) await addOption(selected!, { label: place.name, placeId: place.id, description: place.notes }, memberId)
      setCreating(false)
      navigate(`/t/${place.trip_id}/more/vote/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this vote. Your place is still saved. Try again.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return <section className="place-vote" aria-labelledby="place-vote-title">
    <div className="flex items-center gap-2"><Vote aria-hidden="true" className="size-4" /><h2 id="place-vote-title" className="ui-section-title">Make it a group decision.</h2></div>
    <p className="mt-2 text-sm leading-relaxed text-muted">Give everyone a say before you put it on the itinerary.</p>
    {!polls ? <p className="mt-3 text-sm text-muted" role="status">Loading your group’s votes…</p> : <>
      {included.length > 0 && <ul className="mt-2">{included.map(({ poll }) => <li key={poll.id}><Link to={`/t/${place.trip_id}/more/vote/${poll.id}`} className="ui-link"><Check aria-hidden="true" className="size-4" /><span>Open “{poll.title}”</span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link></li>)}</ul>}
      {open.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2">
        {open.length > 1 && <Select value={selected?.id} onChange={(event) => setChoice(event.target.value)} aria-label="Poll" className="min-w-0 flex-1" disabled={busy}>{open.map(({ poll }) => <option key={poll.id} value={poll.id}>{poll.title}</option>)}</Select>}
        <Button variant="secondary" disabled={busy} aria-busy={busy} onClick={() => void commit(false)}>{busy ? 'Saving…' : `Add to ${open.length > 1 ? 'vote' : `“${selected!.title}”`}`}</Button>
      </div>}
      <button type="button" className="ui-link mt-2" onClick={() => { setError(null); setCreating(true) }} disabled={busy}>Start a vote with this place<ArrowRight aria-hidden="true" className="size-4" /></button>
    </>}
    {!creating && <ErrorNote error={error} />}
    <Dialog open={creating} onClose={() => { if (!inFlight.current) setCreating(false) }} title="What are we deciding?" dismissible={!busy}>
      <form className="space-y-4" onSubmit={(event: FormEvent) => { event.preventDefault(); if (title.trim()) void commit(true) }}>
        <p className="text-sm leading-relaxed text-muted"><strong className="text-ink">{place.name}</strong> will be the first option. Add other ideas and invite everyone to vote.</p>
        <Field label="Vote title"><Input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} autoFocus disabled={busy} /></Field>
        <ErrorNote error={error} />
        <Button type="submit" className="w-full" disabled={busy || !title.trim()} aria-busy={busy}>{busy ? 'Saving…' : 'Create vote & add place'}<ArrowRight aria-hidden="true" className="size-4" /></Button>
        <p className="text-xs leading-relaxed text-muted">Saved on this device first. Shared with your group after syncing.</p>
      </form>
    </Dialog>
  </section>
}
