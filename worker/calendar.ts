import { z } from 'zod'
import { buildIcs } from '../src/lib/ics'

const payload = z.object({ name: z.string(), events: z.array(z.object({
  uid: z.string(), title: z.string(), start: z.string(), end: z.string().nullable(), allDay: z.boolean(),
  tentative: z.boolean(), updatedAt: z.string(), location: z.string(),
})) })
interface CalendarEnv {
  SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string
  TRAVEL_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> }
}
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }
export async function handleCalendar(request: Request, env: CalendarEnv): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Use GET.', { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } })
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response('Calendar unavailable.', { status: 404, headers })
  const key = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!env.TRAVEL_RATE_LIMITER || !(await env.TRAVEL_RATE_LIMITER.limit({ key: `calendar:${key}` })).success) return new Response('Try again later.', { status: 429, headers })
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/read_calendar_feed`, {
      method: 'POST', headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token }), signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return new Response('Calendar temporarily unavailable.', { status: 503, headers })
    const value: unknown = await response.json()
    if (value === null) return new Response('Calendar unavailable.', { status: 404, headers })
    const parsed = payload.parse(value)
    return new Response(request.method === 'HEAD' ? null : buildIcs(parsed.events, parsed.name, new Date().toISOString()), { headers: { ...headers, 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="stowaway.ics"' } })
  } catch { return new Response('Calendar temporarily unavailable.', { status: 503, headers }) }
}
