import { useEffect, useState } from 'react'
import { z } from 'zod'
import { ensureSession, supabase } from '@/lib/supabase'
import type { TravelRequest } from './model'

export function useTravel<T>(input: TravelRequest | null, schema: z.ZodType<T>, ttl = 86400000): { data?: T; fetchedAt?: string; error?: string; loading: boolean; refresh: () => void } {
  const key = input ? `stowaway-travel-v1:${JSON.stringify(input)}` : ''
  const [revision, refresh] = useState(0)
  const [state, setState] = useState<{ key: string; data?: T; fetchedAt?: string; error?: string; loading: boolean }>({ key: '', loading: false })
  useEffect(() => {
    if (!key || !input) return
    let active = true
    const controller = new AbortController()
    let cached: { data: T; fetchedAt: string } | undefined
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (raw && typeof raw.fetchedAt === 'string' && Number.isFinite(Date.parse(raw.fetchedAt))) cached = { data: schema.parse(raw.data), fetchedAt: raw.fetchedAt }
    } catch { /* Invalid or unavailable device storage: fetch normally. */ }
    const fresh = cached && Date.now() - Date.parse(cached.fetchedAt) < ttl
    setState({ key, ...cached, loading: !fresh || revision > 0 })
    if (fresh && revision === 0) return
    void (async () => {
      try {
        if (!navigator.onLine) throw new Error('You’re offline.')
        await ensureSession()
        const { data } = await supabase.auth.getSession()
        const params = new URLSearchParams(Object.entries(input).map(([k, v]) => [k, String(v)]))
        const response = await fetch(`/api/travel-info?${params}`, { headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` }, signal: controller.signal })
        if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Travel lookups are not connected on this server yet.')
        const body = await response.json()
        if (!response.ok) throw new Error(body.error ?? 'Could not refresh travel information.')
        const result = { data: schema.parse(body.data), fetchedAt: z.string().datetime().parse(body.fetchedAt) }
        if (!active) return
        try { localStorage.setItem(key, JSON.stringify(result)) } catch { /* Storage full; data remains usable. */ }
        setState({ key, ...result, loading: false })
      } catch (error) {
        if (active) setState({ key, ...cached, loading: false, error: !navigator.onLine ? 'You’re offline. Showing saved information when available.' : error instanceof Error ? error.message : 'Could not refresh.' })
      }
    })()
    return () => { active = false; controller.abort() }
    // Requests and schemas are stable by their serialized lookup key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision, ttl])
  return { ...(state.key === key ? state : { loading: !!input }), refresh: () => refresh((v) => v + 1) }
}
