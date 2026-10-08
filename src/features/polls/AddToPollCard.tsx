import { useState } from 'react'
import { Link } from 'react-router'
import { Check, Vote } from 'lucide-react'
import type { Place } from '@/data/types'
import { Button, Card, Select } from '@/ui'
import { addOption, createPoll, usePollsForPlace } from './data'
import { votingEnded } from './rank'

/** Put this place up for a group vote: add it to an open poll, or start a new one. */
export function AddToPollCard({ place, memberId }: { place: Place; memberId: string }) {
  const polls = usePollsForPlace(place.trip_id, place.id) ?? []
  const open = polls.filter((p) => !votingEnded(p.poll, Date.now()) && p.poll.kind !== 'dates' && !p.includesPlace)
  const included = polls.filter((p) => p.includesPlace)
  const [choice, setChoice] = useState('')
  const selected = open.find((p) => p.poll.id === choice)?.poll ?? open[0]?.poll

  return (
    <Card>
      <h2 className="flex items-center gap-2 font-semibold"><Vote aria-hidden="true" className="size-5 text-brand-700" />Group vote</h2>
      {included.length > 0 && (
        <ul className="mt-2 space-y-1">
          {included.map(({ poll }) => (
            <li key={poll.id}>
              <Link to={`/t/${place.trip_id}/more/vote/${poll.id}`} className="flex min-h-11 items-center gap-2 text-sm text-brand-700">
                <Check aria-hidden="true" className="size-4" /> In “{poll.title}”{votingEnded(poll, Date.now()) ? ' (closed)' : ''}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {open.length > 0 ? (
        <div className="mt-3 flex gap-2">
          {open.length > 1 && (
            <Select value={selected?.id} onChange={(e) => setChoice(e.target.value)} aria-label="Poll" className="min-w-0 flex-1">
              {open.map(({ poll }) => <option key={poll.id} value={poll.id}>{poll.title}</option>)}
            </Select>
          )}
          <Button variant="secondary" className={open.length > 1 ? '' : 'w-full'} onClick={() => selected && addOption(selected, { label: place.name, placeId: place.id }, memberId)}>
            Add to {open.length > 1 ? 'poll' : `“${selected!.title}”`}
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          className="mt-3 w-full"
          onClick={async () => {
            const title = prompt('What are we deciding?', `Which ${place.category === 'lodging' ? 'place to stay' : place.category === 'food' ? 'restaurant' : 'one'}?`)
            if (!title?.trim()) return
            const pollId = await createPoll(place.trip_id, title, '', memberId)
            await addOption({ id: pollId, trip_id: place.trip_id, title, description: null, status: 'open', winner_option_id: null }, { label: place.name, placeId: place.id }, memberId)
          }}
        >
          Start a vote with this place
        </Button>
      )}
    </Card>
  )
}
