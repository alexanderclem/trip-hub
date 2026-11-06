import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTrip } from '@/data/hooks'
import { useMyMemberId } from '@/data/device'
import { db } from '@/data/db'
import { save } from '@/data/repo'
import { Button, ErrorNote, PageHeader } from '@/ui'
import { DateRangePicker } from '@/ui/DateRangePicker'

/** Change a trip's dates in one place. Reached by tapping the dates on the trip overview. */
export function TripDatesScreen() {
  const { tripId = '' } = useParams()
  const trip = useTrip(tripId)
  const memberId = useMyMemberId(tripId)
  const navigate = useNavigate()
  const [range, setRange] = useState<{ start: string; end: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Start from the saved dates once the trip loads; live sync never overwrites what's being picked.
  useEffect(() => { if (trip && !range) setRange({ start: trip.start_date ?? '', end: trip.end_date ?? '' }) }, [trip, range])

  async function submit() {
    if (!range) return
    if (range.start && !range.end) return setError('Tap the last day of the trip too, or clear the dates.')
    setError(null); setBusy(true)
    try {
      const latest = await db.trips.get(tripId)
      if (!latest || latest.deleted_at) throw new Error('This trip is no longer available.')
      await save('trips', { ...latest, start_date: range.start || null, end_date: range.end || null }, memberId)
      navigate(`/t/${tripId}/overview`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t save the dates. Try again.') } finally { setBusy(false) }
  }

  const unchanged = !!trip && !!range && range.start === (trip.start_date ?? '') && range.end === (trip.end_date ?? '')
  return (
    <div>
      <PageHeader title="Trip dates" back={`/t/${tripId}/overview`} />
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4">
        {!trip || !range ? <p role="status" className="text-sm text-muted">Loading…</p> : (
          <>
            <div className="rounded-surface border border-line bg-surface p-3"><DateRangePicker start={range.start} end={range.end} onChange={(start, end) => setRange({ start, end })} /></div>
            <p className="text-xs text-muted">Things already in the plan keep their dates. Times are in {trip.timezone.replace(/_/g, ' ')}; <Link to={`/t/${tripId}/more/settings`} className="text-action underline">change the time zone in settings</Link>.</p>
            <ErrorNote error={error} />
            <div className="flex gap-2">
              <Button onClick={() => void submit()} disabled={busy || unchanged}>{busy ? 'Saving…' : 'Save dates'}</Button>
              <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
