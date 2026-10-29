import { useRef, useState } from 'react'
import { Check, Image, LoaderCircle } from 'lucide-react'
import type { Trip } from '@/data/types'
import { db } from '@/data/db'
import { save } from '@/data/repo'
import { Button, ErrorNote } from '@/ui'
import { Dialog } from '@/ui/Dialog'
import { TripArtwork } from './TripArtwork'
import { TRIP_COVERS, tripCover, type TripCover } from './presentation'

export function TripCoverPicker({ trip, memberId }: { trip: Trip; memberId: string | null }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<TripCover>(() => tripCover(trip))
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  async function apply() {
    if (locked.current) return
    locked.current = true
    setBusy(true); setError(null)
    try {
      // Read the current row so customizing a cover cannot overwrite another settings edit.
      const latest = await db.trips.get(trip.id)
      if (!latest || latest.deleted_at) throw new Error('This trip is no longer available.')
      await save('trips', { ...latest, settings: { ...latest.settings, journal_cover: draft } }, memberId)
      setSaved(true); setOpen(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the cover. Try again.') }
    finally { locked.current = false; setBusy(false) }
  }
  return <>
    <button type="button" className="ui-link" aria-haspopup="dialog" onClick={() => { setDraft(tripCover(trip)); setError(null); setSaved(false); setOpen(true) }}><Image aria-hidden="true" className="size-4" />Change trip cover</button>
    <span role="status" className="cover-saved">{saved && <><Check aria-hidden="true" className="size-4" />Cover saved on this device</>}</span>
    <Dialog open={open} onClose={() => setOpen(false)} dismissible={!busy} title="A little more you.">
      <p className="mb-5 text-sm leading-relaxed text-muted">Pick an illustrated cover for your group’s trip. You can change it anytime.</p>
      <fieldset disabled={busy}>
        <legend className="sr-only">Trip cover</legend>
        <div className="cover-choices">{TRIP_COVERS.map(({ id, label }) => <label key={id} className="cover-choice">
          <input type="radio" name="trip-cover" value={id} checked={draft === id} onChange={() => setDraft(id)} className="sr-only" />
          <span className="cover-choice-art">{id === 'none' ? <span className="travel-heading text-xl">Your trip.</span> : <TripArtwork cover={id} />}</span>
          <span className="cover-choice-label"><span>{label}</span><Check aria-hidden="true" className={`size-4 shrink-0 ${draft === id ? '' : 'invisible'}`} /></span>
        </label>)}</div>
      </fieldset>
      <div className="mt-4"><ErrorNote error={error} /></div>
      <div className="cover-picker-actions mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
        <Button disabled={busy} onClick={() => void apply()}>{busy ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : <Check aria-hidden="true" className="size-4" />}{busy ? 'Saving cover…' : 'Save cover'}</Button>
      </div>
    </Dialog>
  </>
}
