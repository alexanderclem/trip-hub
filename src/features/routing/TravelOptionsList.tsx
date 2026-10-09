import { useState, type FormEvent } from 'react'
import { useMyMemberId } from '@/data/device'
import { save } from '@/data/repo'
import { TRAVEL_MODES, type LegOverride, type Place, type TravelMode } from '@/data/types'
import { formatDistance } from '@/lib/geo'
import { stableId } from '@/lib/ids'
import { Button, ErrorNote, Input, Select } from '@/ui'
import { formatRange, MODE_LABEL, pairKey, SOURCE_LABEL, type TravelOption } from './legs'

export function TravelOptionsList({ options, compact = false }: { options: TravelOption[]; compact?: boolean }) {
  if (!options.length) return <p className="text-sm text-stone-500">No travel time yet.</p>
  return (
    <ul className="space-y-1.5">
      {options.map((o) => {
        const m = MODE_LABEL[o.mode]
        return (
          <li key={`${o.mode}-${o.source}`} className="flex items-baseline gap-2 text-sm">
            <span aria-hidden>{m.emoji}</span>
            <span className="font-medium">{m.label}</span>
            <span className={o.source === 'estimate' ? 'text-stone-600' : 'text-stone-900'}>
              {o.source === 'estimate' && '~'}
              {formatRange(o.minS, o.maxS)}
            </span>
            {!compact && (
              <span className="min-w-0 truncate text-xs text-stone-600">
                {SOURCE_LABEL[o.source]}
                {o.distanceM != null && o.source !== 'estimate' ? ` · ${formatDistance(o.distanceM)}` : ''}
              </span>
            )}
          </li>
        )
      })}
      {!compact &&
        options
          .filter((o) => o.note)
          .map((o) => (
            <li key={`note-${o.mode}`} className="pl-6 text-xs text-stone-500">
              {MODE_LABEL[o.mode].emoji} {o.note}
            </li>
          ))}
    </ul>
  )
}

/** "It actually took…" — saves a reported time for this pair of places, shared with everyone. */
export function ReportTimeForm({ from, to, onDone }: { from: Place; to: Place; onDone: () => void }) {
  const me = useMyMemberId(from.trip_id)
  const [mode, setMode] = useState<TravelMode>('drive')
  const [lo, setLo] = useState('')
  const [hi, setHi] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const min = Number(lo)
    const max = hi ? Number(hi) : min
    if (!(min > 0) || !(max >= min)) return setError('Enter minutes, e.g. 30 to 45')
    const [a, b] = pairKey(from.id, to.id)
    const row: LegOverride = {
      id: stableId(from.trip_id, 'override', a, b, mode),
      trip_id: from.trip_id,
      place_a_id: a,
      place_b_id: b,
      mode,
      min_s: Math.round(min * 60),
      max_s: Math.round(max * 60),
      note: note.trim() || null,
    }
    await save('leg_overrides', row, me)
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl bg-stone-50 p-3">
      <p className="text-sm font-medium">How long does {from.name} → {to.name} take?</p>
      <div className="flex items-center gap-2">
        <Select value={mode} onChange={(e) => setMode(e.target.value as TravelMode)} className="w-36">
          {TRAVEL_MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m].emoji} {MODE_LABEL[m].label}
            </option>
          ))}
        </Select>
        <Input inputMode="numeric" value={lo} onChange={(e) => setLo(e.target.value)} placeholder="min" className="w-16 px-2" aria-label="Minimum minutes" />
        <span>–</span>
        <Input inputMode="numeric" value={hi} onChange={(e) => setHi(e.target.value)} placeholder="max" className="w-16 px-2" aria-label="Maximum minutes" />
        <span className="text-sm text-stone-500">min</span>
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional), e.g. last boat 5 pm" maxLength={140} />
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">Save for everyone</Button>
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}
