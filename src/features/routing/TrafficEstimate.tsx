import { Link } from 'react-router'
import { useEffect, useState } from 'react'
import type { Place } from '@/data/types'
import { supabase } from '@/lib/supabase'
import { formatDistance } from '@/lib/geo'
import { Button } from '@/ui'
import { formatRange } from './legs'

type Estimate = { duration_s: number; distance_m: number; departure_at: string; checked_at: string }
const FRESH_MS = 5 * 60_000

/** On-demand only: no paid background matrix requests and no offline caching. */
export function TrafficEstimate({ from, to }: { from: Place; to: Place }) {
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine)
      if (!navigator.onLine) setEstimate(null)
    }
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
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
  return (
    <div className="mt-2">
      <Button variant="secondary" type="button" onClick={() => void check()} disabled={busy || !online || !pinned} aria-label={`Check driving traffic from ${from.name} to ${to.name}`} className="min-h-11 text-xs">
        {busy ? 'Checking traffic…' : estimate ? 'Refresh traffic' : 'Check driving traffic'}
      </Button>
      <p className="mt-1 text-xs text-stone-600">Sends these two place coordinates to Google. <Link className="underline" to="/privacy">Privacy</Link> · <Link className="underline" to="/terms">Terms</Link></p>
      <div aria-live="polite" aria-atomic="true">
        {estimate && (
          <div className="mt-2 border-l-2 border-stone-300 pl-3 text-sm text-stone-900">
            <p className="font-medium">Drive · {formatRange(estimate.duration_s, estimate.duration_s)} · {formatDistance(estimate.distance_m)}</p>
            <p className="text-xs text-stone-600">Leaving now · traffic-aware · checked {new Date(estimate.checked_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
            <p translate="no" className="mt-1 whitespace-nowrap font-sans text-xs font-normal not-italic text-[#5E5E5E]">Google Maps</p>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        {!online && <p className="mt-1 text-xs text-stone-600">Connect to check current traffic.</p>}
        {!pinned && <p className="mt-1 text-xs text-stone-600">Add map pins to check traffic.</p>}
      </div>
    </div>
  )
}
