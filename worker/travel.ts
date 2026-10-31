import { z } from 'zod'
import { travelRequestSchema, type TravelRequest } from '../src/features/travel/model'

export interface TravelEnv {
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  TICKETMASTER_API_KEY?: string
  RESTCOUNTRIES_API_KEY?: string
  AVIATIONSTACK_API_KEY?: string
  TRAVEL_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> }
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const text = z.string().nullish().transform((v) => v ?? null)
const safeUrl = (value: string) => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null } catch { return null } }
async function provider(url: URL, headers?: HeadersInit) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) })
  if (!res.ok) throw new Error('Provider unavailable')
  return res.json() as Promise<unknown>
}
export async function lookup(input: TravelRequest, env: TravelEnv): Promise<unknown> {
  if (input.action === 'holidays') {
    const data = z.array(z.object({ date: z.string(), name: z.string(), nationalHoliday: z.boolean(), subdivisionCodes: z.array(z.string()).nullish(), holidayTypes: z.array(z.string()) })).parse(await provider(new URL(`https://nagerholidays.com/api/v4/Holidays/${input.country}/${input.year}`)))
    return data.filter((h) => h.holidayTypes.includes('Public')).map((h) => ({ date: h.date, name: h.name, regional: !h.nationalHoliday, regions: h.subdivisionCodes ?? [] }))
  }
  if (input.action === 'country') {
    if (!env.RESTCOUNTRIES_API_KEY) throw new Error('setup:Destination essentials need a REST Countries API key on the server.')
    const url = new URL(`https://api.restcountries.com/countries/v5/codes.alpha_2/${input.country}`)
    const data = z.object({ data: z.object({ objects: z.array(z.object({ names: z.object({ common: z.string() }), currencies: z.record(z.string(), z.unknown()), languages: z.array(z.object({ name: z.string() })), calling_codes: z.array(z.string()) })) }) }).parse(await provider(url, { Authorization: `Bearer ${env.RESTCOUNTRIES_API_KEY}` }))
    const c = data.data.objects[0]
    if (!c) throw new Error('No country found')
    return { name: c.names.common, currencies: Object.keys(c.currencies), languages: c.languages.map((l) => l.name), callingCodes: c.calling_codes }
  }
  if (input.action === 'events') {
    if (!env.TICKETMASTER_API_KEY) throw new Error('setup:Events need a Ticketmaster API key on the server.')
    const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json')
    url.search = new URLSearchParams({ apikey: env.TICKETMASTER_API_KEY, city: input.city, countryCode: input.country, localStartDateTime: `${input.start}T00:00:00,${input.end}T23:59:59`, sort: 'date,asc', size: '30', includeTBA: 'no', includeTBD: 'no' }).toString()
    const event = z.object({ id: z.string(), name: z.string(), url: z.string(), dates: z.object({ start: z.object({ localDate: z.string(), localTime: text }), timezone: text }), _embedded: z.object({ venues: z.array(z.object({ name: z.string() })) }).optional() })
    const data = z.object({ _embedded: z.object({ events: z.array(event) }).optional() }).parse(await provider(url))
    return (data._embedded?.events ?? []).filter((e) => safeUrl(e.url)).map((e) => ({ id: e.id, name: e.name, date: e.dates.start.localDate, time: e.dates.start.localTime?.slice(0, 5) ?? null, zone: e.dates.timezone, venue: e._embedded?.venues[0]?.name ?? '', url: safeUrl(e.url)! }))
  }
  if (!env.AVIATIONSTACK_API_KEY) throw new Error('setup:Flight status needs an Aviationstack API key on the server.')
  const url = new URL('https://api.aviationstack.com/v1/flights')
  url.search = new URLSearchParams({ access_key: env.AVIATIONSTACK_API_KEY, flight_iata: input.number, flight_date: input.date, limit: '20' }).toString()
  const endpoint = z.object({ iata: text, airport: text, gate: text, terminal: text, scheduled: text, estimated: text, delay: z.number().nullish() })
  const data = z.object({ error: z.unknown().optional(), data: z.array(z.object({ flight_date: z.string(), flight_status: z.string(), flight: z.object({ iata: text }), departure: endpoint, arrival: endpoint })).optional() }).parse(await provider(url))
  if (data.error || !data.data) throw new Error('Provider unavailable')
  return data.data.filter((f) => f.flight_date === input.date && f.flight.iata === input.number).map((f) => ({ number: input.number, date: f.flight_date, status: f.flight_status, departure: f.departure.iata ?? f.departure.airport ?? 'Unknown', arrival: f.arrival.iata ?? f.arrival.airport ?? 'Unknown', gate: f.departure.gate, terminal: f.departure.terminal, scheduled: f.departure.scheduled, estimated: f.departure.estimated, delay: f.departure.delay ?? null }))
}

export async function handleTravel(request: Request, env: TravelEnv): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405)
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Use Stowaway to look up travel information.' }, 403)
  const authorization = request.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Sign in to look up travel information.' }, 401)
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = travelRequestSchema.safeParse({ ...params, ...(params.year ? { year: Number(params.year) } : {}) })
  if (!parsed.success) return json({ error: 'Check the country, dates, city or flight number.' }, 400)
  try {
    const headers = { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: authorization }
    const auth = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers, signal: AbortSignal.timeout(10000) })
    if (!auth.ok) return json({ error: 'Sign in again to refresh travel information.' }, 401)
    const user = z.object({ id: z.string().uuid() }).parse(await auth.json())
    const access = await fetch(`${env.SUPABASE_URL}/rest/v1/trips?id=eq.${parsed.data.tripId}&deleted_at=is.null&select=id`, { headers, signal: AbortSignal.timeout(10000) })
    if (!access.ok) return json({ error: 'Could not check trip access.' }, 503)
    if (!(await access.json() as unknown[]).length) return json({ error: 'Join this trip first.' }, 403)
    if (!env.TRAVEL_RATE_LIMITER) return json({ error: 'Travel lookups are not configured on this server yet.' }, 503)
    if (!(await env.TRAVEL_RATE_LIMITER.limit({ key: user.id })).success) return json({ error: 'Wait a minute before refreshing again.' }, 429)
    return json({ data: await lookup(parsed.data, env), fetchedAt: new Date().toISOString() })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('setup:')) return json({ error: error.message.slice(6) }, 503)
    return json({ error: 'This provider is unavailable or this lookup is not included in its plan. Try again later.' }, 502)
  }
}
