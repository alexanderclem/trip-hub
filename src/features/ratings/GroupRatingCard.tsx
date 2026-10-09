import { TravelerLink } from '@/features/trips/TravelerLink'
import { useEffect, useRef, useState } from 'react'
import { useMembers } from '@/data/hooks'
import type { Place } from '@/data/types'
import { Avatar, Card, Textarea } from '@/ui'
import { rate, usePlaceRatings } from '@/features/polls/data'
import { summarizeRatings } from '@/features/polls/rank'
import { StarsInput, StarsSummary } from './Stars'

/** Your rating of a place (1–5 + note) and everyone else's. Saved instantly, works offline. */
export function GroupRatingCard({ place, memberId }: { place: Place; memberId: string }) {
  const ratings = usePlaceRatings(place.id) ?? []
  const members = useMembers(place.trip_id) ?? []
  const mine = ratings.find((r) => r.member_id === memberId)
  const savedNote = mine?.note ?? ''
  const [note, setNote] = useState(savedNote)
  // Follow edits from other devices, but never overwrite what you're in the middle of typing
  // (e.g. tapping a star saves the rating, and that save echoes back here).
  const editing = useRef(false)
  useEffect(() => {
    if (!editing.current) setNote(savedNote)
  }, [savedNote])

  const others = ratings.filter((r) => r.member_id !== memberId && (r.stars != null || r.note))
  const summary = summarizeRatings(ratings)
  const name = (id: string) => members.find((m) => m.id === id)

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="ui-section-title">Group rating</h2>
        <StarsSummary summary={summary} />
      </div>
      <p className="mt-1 text-sm text-stone-600">{place.status === 'visited' ? 'How was it?' : 'Been here or heard about it? Rate it for the group.'}</p>
      <div className="mt-3">
        <StarsInput value={mine?.stars ?? null} onChange={(stars) => rate(place.trip_id, place.id, memberId, stars, note)} />
      </div>
      <Textarea
        value={note}
        onFocus={() => (editing.current = true)}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => {
          editing.current = false
          if (savedNote !== note.trim()) void rate(place.trip_id, place.id, memberId, mine?.stars ?? null, note)
        }}
        maxLength={500}
        rows={2}
        placeholder="Add a note (optional), e.g. get the pepián"
        aria-label="Your note"
        className="mt-2"
      />
      {others.length > 0 && (
        <ul className="mt-4 space-y-3 border-t border-stone-200 pt-3">
          {others.map((r) => {
            const m = name(r.member_id)
            return (
              <li key={r.id} className="flex gap-3">
                <Avatar name={m?.display_name ?? '?'} color={m?.color ?? null} photo={m?.avatar_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {m ? <TravelerLink member={m} avatar={false} /> : 'Someone'}
                    {r.stars != null && <span className="ml-2 text-amber-600" aria-label={`${r.stars} stars`}>{'★'.repeat(r.stars)}</span>}
                  </p>
                  {r.note && <p className="text-sm break-words whitespace-pre-wrap text-stone-600">{r.note}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
