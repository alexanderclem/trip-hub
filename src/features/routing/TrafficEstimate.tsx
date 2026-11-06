import { Link } from 'react-router'
import { useEffect, useState } from 'react'
import type { Place } from '@/data/types'
import { supabase } from '@/lib/supabase'
import { formatDistance } from '@/lib/geo'
import { Button } from '@/ui'
import { formatRange } from './legs'
import { friendlyError } from '@/ui/errors'

type Estimate = { duration_s: number; distance_m: number; departure_at: string; checked_at: string }
const FRESH_MS = 5 * 60_000

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

/** The Google notice and offline state, printed once under a list of estimates (`notes={false}` rows). */
export function TrafficNotice() {
  const online = useOnline()
  return <p className="mt-3 border-t border-dashed border-line pt-3 text-xs text-muted">{online ? <>Checking traffic sends the two places’ coordinates to Google. <Link className="underline" to="/privacy">Privacy</Link> · <Link className="underline" to="/terms">Terms</Link></> : 'Connect to check current traffic.'}</p>
}

/** On-demand only: no paid background matrix requests and no offline caching.
 *  In a list, pass `notes={false}` and render one `TrafficNotice` instead of repeating it per row. */
export function TrafficEstimate({ from, to, notes = true }: { from: Place; to: Place; notes?: boolean }) {
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const online = useOnline()
  useEffect(() => { if (!online) setEstimate(null) }, [online])
  useEffect(() => {
    if (!estimate) return
    const remaining = FRESH_MS - (Date.now() - Date.parse(estimate.checked_at))
    const timeout = setTimeout(() => setEstimate(null), Math.max(0, remaining))
    return () => clearTimeout(timeout)
  }, [estimate])

  async function check() {
    if (busy) return
    setBusy(true)
    setError(null)
    setEstimate(null)
    try {
      const { data, error: requestError } = await supabase.functions.invoke('traffic-route', {
        body: { from_place_id: from.id, to_place_id: to.id },
      })
      if (requestError) {
        let message = 'Could not check traffic. Use the planning estimate for now.'
        try { message = (await (requestError as { context?: Response }).context?.json())?.error ?? message } catch { /* network error */ }
        throw new Error(message)
      }
      if (!data || !Number.isFinite(data.duration_s) || data.duration_s < 0 || !Number.isFinite(data.distance_m) || data.distance_m < 0 || !Number.isFinite(Date.parse(data.checked_at))) throw new Error('Traffic service returned an invalid estimate.')
      if (navigator.onLine) setEstimate(data as Estimate)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check traffic.')
    } finally {
      setBusy(false)
    }
  }
  const pinned = from.lat != null && from.lng != null && to.lat != null && to.lng != null
  if (!notes && !online) return null
  return (
    <div className="mt-2">
      <Button variant="secondary" type="button" onClick={() => void check()} disabled={busy || !online || !pinned} aria-label={`Check driving traffic from ${from.name} to ${to.name}`} className="min-h-11 text-xs">
        {busy ? 'Checking traffic…' : estimate ? 'Refresh traffic' : 'Check driving traffic'}
      </Button>
      {notes && <p className="mt-1 text-xs text-muted">Sends these two place coordinates to Google. <Link className="underline" to="/privacy">Privacy</Link> · <Link className="underline" to="/terms">Terms</Link></p>}
      <div aria-live="polite" aria-atomic="true">
        {estimate && (
          <div className="mt-2 border-l-2 border-control pl-3 text-sm text-ink">
            <p className="font-medium">Drive · {formatRange(estimate.duration_s, estimate.duration_s)} · {formatDistance(estimate.distance_m)}</p>
            <p className="text-xs text-muted">Leaving now · traffic-aware · checked {new Date(estimate.checked_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
            <p translate="no" className="mt-1 whitespace-nowrap font-sans text-xs font-normal not-italic text-[#5E5E5E]">Google Maps</p>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-danger-ink">{friendlyError(error)}</p>}
        {notes && !online && <p className="mt-1 text-xs text-muted">Connect to check current traffic.</p>}
        {!pinned && <p className="mt-1 text-xs text-muted">Add map pins to check traffic.</p>}
      </div>
    </div>
  )
}
