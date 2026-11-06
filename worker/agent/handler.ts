// POST /api/agent-plan: the booking agent endpoint (docs/AGENT_PLANNER.md).
// The same checks as /api/travel-ai: same origin, Supabase session, trip access, rate limits and a
// size cap. Trip dates, zone and saved places are read from Supabase with the caller's own token
// (so RLS applies), never taken from the request body.
import { z } from 'zod'
import { IANAZone } from 'luxon'
import { AgentError, prefetch, runAgent, type AgentEnv } from './loop'
import { Ledger } from './schedule'
import { SetupError } from './providers'

export interface AgentHandlerEnv extends AgentEnv {
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  AGENT_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> }
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const agentRequestSchema = z.object({
  tripId: z.string().uuid(),
  origin: z.string().regex(/^[A-Z]{3}$/).nullable(),
  destination: z.string().min(1).max(80),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  adults: z.number().int().min(1).max(9),
  budgetMinor: z.number().int().positive().nullable(),
  vibe: z.string().max(200),
  notes: z.string().max(1000),
  travelMode: z.enum(['DRIVE', 'WALK']).default('DRIVE'),
}).strict()

const tripRow = z.object({ start_date: z.string().nullable(), end_date: z.string().nullable(), timezone: z.string(), base_currency: z.string() })
const placeRow = z.object({ id: z.string(), name: z.string(), lat: z.number().nullable(), lng: z.number().nullable() })

export const warmRequestSchema = agentRequestSchema.pick({ tripId: true, origin: true, destination: true, countryCode: true, adults: true }).strict()

/**
 * POST /api/agent-warm: the planner form calls this once the airport and destination are filled in,
 * while the person is still typing the rest. It runs the same flight, hotel and tour searches a plan
 * starts with and throws the results away: LiteAPI caches a searched route, so the real plan's
 * searches (15 to 20 s on a cold route) then come back in about a second. No model call is made.
 */
export async function handleAgentWarm(request: Request, env: AgentHandlerEnv, waitUntil: (work: Promise<unknown>) => void, doFetch: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'This request must come from Stowaway.' }, 403)
  const authorization = request.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Sign in first.' }, 401)
  if (!env.AGENT_RATE_LIMITER || !env.LITEAPI_KEY) return json({ ok: false }, 202)
  const text = await request.text()
  if (text.length > 2000) return json({ error: 'This request is too large.' }, 413)
  let body: unknown
  try { body = JSON.parse(text) } catch { return json({ error: 'Send JSON.' }, 400) }
  const parsed = warmRequestSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'Check the airport code and destination.' }, 400)
  const input = parsed.data
  const headers = { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: authorization }
  const tripRead = doFetch(`${env.SUPABASE_URL}/rest/v1/trips?id=eq.${input.tripId}&deleted_at=is.null&select=start_date,end_date,timezone,base_currency`, { headers, signal: AbortSignal.timeout(10000) })
  tripRead.catch(() => {})
  const auth = await doFetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers, signal: AbortSignal.timeout(10000) })
  if (!auth.ok) return json({ error: 'Your session has expired.' }, 401)
  const user = z.object({ id: z.string().uuid() }).parse(await auth.json())
  if (!(await env.AGENT_RATE_LIMITER.limit({ key: `warm:${user.id}` })).success) return json({ ok: false }, 202)
  const tripRes = await tripRead
  const trip = tripRes.ok ? z.array(tripRow).safeParse(await tripRes.json()) : null
  const t = trip?.success ? trip.data[0] : undefined
  if (!t?.start_date || !t.end_date || !IANAZone.isValidZone(t.timezone)) return json({ ok: false }, 202)
  const work = prefetch({ ...input, start: t.start_date, end: t.end_date, zone: t.timezone, currency: t.base_currency, budgetMinor: null, places: [], vibe: '', notes: '', travelMode: 'DRIVE' }, env, new Ledger(), doFetch)
  waitUntil(work.catch(() => {}))
  return json({ ok: true }, 202)
}

export async function handleAgent(request: Request, env: AgentHandlerEnv, doFetch: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'This request must come from Stowaway.' }, 403)
  const authorization = request.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Sign in to plan with the agent.' }, 401)
  if (!env.AGENT_RATE_LIMITER) return json({ error: 'The trip agent is not set up on this server yet.' }, 503)
  const text = await request.text()
  if (text.length > 8000) return json({ error: 'This request is too large.' }, 413)
  let body: unknown
  try { body = JSON.parse(text) } catch { return json({ error: 'Send JSON.' }, 400) }
  const parsed = agentRequestSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'Check the airport code, destination, party size and budget.' }, 400)
  const input = parsed.data
  try {
    const headers = { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: authorization }
    // The trip reads use the caller's own token (RLS decides), so they start alongside the session check.
    const reads = Promise.all([
      doFetch(`${env.SUPABASE_URL}/rest/v1/trips?id=eq.${input.tripId}&deleted_at=is.null&select=start_date,end_date,timezone,base_currency`, { headers, signal: AbortSignal.timeout(10000) }),
      doFetch(`${env.SUPABASE_URL}/rest/v1/places?trip_id=eq.${input.tripId}&deleted_at=is.null&status=in.(shortlist,planned,booked)&lat=not.is.null&select=id,name,lat,lng&limit=60`, { headers, signal: AbortSignal.timeout(10000) }),
    ])
    reads.catch(() => {})
    const auth = await doFetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers, signal: AbortSignal.timeout(10000) })
    if (!auth.ok) return json({ error: 'Your session has expired. Refresh and try again.' }, 401)
    const user = z.object({ id: z.string().uuid() }).parse(await auth.json())
    if (!(await env.AGENT_RATE_LIMITER.limit({ key: `user:${user.id}` })).success) return json({ error: 'One plan at a time: wait a minute and try again.' }, 429)
    const [tripRes, placesRes] = await reads
    if (!tripRes.ok || !placesRes.ok) return json({ error: 'Could not read this trip. Try again.' }, 503)
    const trip = z.array(tripRow).parse(await tripRes.json())[0]
    if (!trip) return json({ error: 'Join this trip first.' }, 403)
    if (!trip.start_date || !trip.end_date) return json({ error: 'Set the trip dates before asking the agent.' }, 400)
    if (!IANAZone.isValidZone(trip.timezone)) return json({ error: 'Set a valid trip time zone before asking the agent.' }, 400)
    const places = z.array(placeRow).parse(await placesRes.json()).flatMap((p) => (p.lat !== null && p.lng !== null ? [{ id: p.id, name: p.name, lat: p.lat, lng: p.lng }] : []))
    const plan = await runAgent({ ...input, start: trip.start_date, end: trip.end_date, zone: trip.timezone, currency: trip.base_currency, places }, env, doFetch)
    return json({ plan, createdAt: new Date().toISOString() })
  } catch (error) {
    if (error instanceof SetupError) return json({ error: `The trip agent isn't fully set up: ${error.message}` }, 503)
    if (error instanceof AgentError) return json({ error: error.message }, 502)
    console.error('[agent-plan] failed', { name: error instanceof Error ? error.name : 'Unknown', message: error instanceof Error ? error.message.slice(0, 500) : '' })
    return json({ error: 'The trip agent is unavailable right now. Your trip is unchanged.' }, 503)
  }
}
