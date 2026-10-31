import { useRef, useState } from 'react'
import { Check, Image, LoaderCircle } from 'lucide-react'
import type { Trip } from '@/data/types'
import { db } from '@/data/db'
import { save } from '@/data/repo'
import { Button, ErrorNote } from '@/ui'
import { Dialog } from '@/ui/Dialog'
import { TripArtwork } from './TripArtwork'
import { PhotoUpload } from './PhotoUpload'
import { TRIP_COVERS, coverChoice, coverPhoto, destinationCovers, type CoverChoice } from './covers'

export function TripCoverPicker({ trip, memberId }: { trip: Trip; memberId: string | null }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CoverChoice>(() => coverChoice(trip))
  const [photo, setPhoto] = useState<string | undefined>(() => coverPhoto(trip))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const locked = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const inspiration = destinationCovers(trip)
  const recommended = inspiration.covers
  const automatic = recommended[0]!
  const isRecommended = (id: string) => inspiration.destinations.length > 0 && recommended.some((cover) => cover === id)
  const covers = [...TRIP_COVERS].sort((a, b) => Number(isRecommended(b.id)) - Number(isRecommended(a.id)))
  const pending = busy || uploading
  async function apply() {
    if (locked.current || uploading) return
    locked.current = true
    setBusy(true); setError(null)
    try {
      if (draft === 'custom' && !photo) throw new Error('Choose a photo for your custom cover.')
      const latest = await db.trips.get(trip.id)
      if (!latest || latest.deleted_at) throw new Error('This trip is no longer available.')
      const settings: Record<string, unknown> = { ...latest.settings, journal_cover: draft }
      // Remove unused image bytes from the synced settings when switching back to artwork.
      delete settings.journal_cover_image
      if (draft === 'custom') settings.journal_cover_image = photo
      await save('trips', { ...latest, settings }, memberId)
      setSaved(true); setOpen(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the cover. Try again.') }
    finally { locked.current = false; setBusy(false) }
  }
  return <>
    <button type="button" className="ui-link" aria-haspopup="dialog" onClick={() => { setDraft(coverChoice(trip)); setPhoto(coverPhoto(trip)); setError(null); setSaved(false); setOpen(true) }}><Image aria-hidden="true" className="size-4" />Change trip cover</button>
    <span role="status" className="cover-saved">{saved && <><Check aria-hidden="true" className="size-4" />Cover saved on this device. Changes sync when online.</>}</span>
    <Dialog open={open} onClose={() => setOpen(false)} dismissible={!pending} title="A little more you.">
      {open && <>
        <p className="mb-4 text-sm leading-relaxed text-muted">A postcard for your destination, or a photo of your own. Everyone in the trip sees the saved cover.</p>
        <div className="cover-preview" aria-label="Trip cover preview">{draft === 'custom' && !photo ? <span className="p-4 text-center text-sm text-muted">Choose a photo to preview it.</span> : <TripArtwork cover={draft === 'auto' ? automatic : draft} photo={photo} />}{draft === 'none' && <span className="travel-heading text-2xl">Your trip.</span>}</div>
        <fieldset disabled={pending} className="mt-4">
          <legend className="sr-only">Trip cover</legend>
          <label className="cover-mode"><input type="radio" name="trip-cover" value="auto" checked={draft === 'auto'} onChange={() => setDraft('auto')} /><span><strong>Automatic · match my destination</strong><span className="mt-1 block text-sm text-muted">{inspiration.destinations.length ? `Inspired by ${inspiration.destinations.join(' · ')}. Updates when destinations change.` : 'Starts by the water. Add a destination to match your trip.'}</span></span></label>
          <label className="cover-mode"><input type="radio" name="trip-cover" value="custom" checked={draft === 'custom'} onChange={() => setDraft('custom')} /><span><strong>Use my own photo</strong><span className="mt-1 block text-sm text-muted">Upload a favorite and frame it your way.</span></span></label>
          {draft === 'custom' && <div className="mb-5 mt-2">
            <PhotoUpload label="Trip cover photo" kind="cover" disabled={busy} onChange={(value) => { setPhoto(value); setError(null) }} onBusy={setUploading} />
            {photo && <Button type="button" variant="ghost" onClick={() => { setPhoto(undefined); setDraft('auto') }}>Remove cover photo</Button>}
          </div>}
          <p className="mb-3 mt-5 text-sm font-semibold">Choose an illustration</p>
          <div className="cover-choices">{covers.map(({ id, label }) => <label key={id} className="cover-choice">
            <input type="radio" name="trip-cover" value={id} checked={draft === id} onChange={() => setDraft(id)} className="sr-only" />
            <span className="cover-choice-art">{id === 'none' ? <span className="travel-heading text-xl">Your trip.</span> : <TripArtwork cover={id} thumbnail />}</span>
            <span className="cover-choice-label"><span>{label}{isRecommended(id) && <small className="block font-normal text-muted">Destination pick</small>}</span><Check aria-hidden="true" className={`size-4 shrink-0 ${draft === id ? '' : 'invisible'}`} /></span>
          </label>)}</div>
        </fieldset>
        <div className="mt-4"><ErrorNote error={error} /></div>
        <div className="cover-picker-actions mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => void apply()}>{pending ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : <Check aria-hidden="true" className="size-4" />}{uploading ? 'Preparing photo…' : busy ? 'Saving cover…' : 'Save cover'}</Button>
        </div>
      </>}
    </Dialog>
  </>
}
