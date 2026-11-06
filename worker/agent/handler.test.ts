import { describe, expect, it } from 'vitest'
import { handleAgentWarm, type AgentHandlerEnv } from './handler'

const TRIP = '11111111-1111-4111-8111-111111111111'
const env = (over: Partial<AgentHandlerEnv> = {}): AgentHandlerEnv => ({
  SUPABASE_URL: 'https://db.test', SUPABASE_PUBLISHABLE_KEY: 'pk', LITEAPI_KEY: 'l',
  AGENT_RATE_LIMITER: { limit: async () => ({ success: true }) }, ...over,
})
const request = (body: unknown, headers: Record<string, string> = { Authorization: 'Bearer t' }) =>
  new Request('https://stowaway.test/api/agent-warm', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
const body = { tripId: TRIP, origin: 'JFK', destination: 'Lisbon', countryCode: 'PT', adults: 2 }

describe('POST /api/agent-warm', () => {
  it('answers at once and runs the plan’s first searches in the background, with no model call', async () => {
    const calls: string[] = []
    const fake = (async (url: string | URL | Request) => {
      const u = String(url)
      calls.push(new URL(u).pathname)
      if (u.endsWith('/auth/v1/user')) return Response.json({ id: '22222222-2222-4222-8222-222222222222' })
      if (u.includes('/rest/v1/trips')) return Response.json([{ start_date: '2027-03-20', end_date: '2027-03-24', timezone: 'Europe/Lisbon', base_currency: 'USD' }])
      if (u.includes('/data/flights/airports?')) return Response.json({ data: [{ airports: [{ iata: 'LIS', country: 'PT', tz: 'Europe/Lisbon' }] }] })
      return Response.json({ data: [] })
    }) as typeof fetch
    const background: Promise<unknown>[] = []
    const res = await handleAgentWarm(request(body), env(), (work) => background.push(work), fake)
    expect(res.status).toBe(202)
    await Promise.all(background)
    expect(calls).toContain('/v3.0/flights/rates')
    expect(calls).toContain('/v3.0/hotels/rates')
    expect(calls.some((c) => c.includes('deepseek') || c.includes('chat/completions'))).toBe(false)
  })

  it('refuses other sites and unsigned requests, and does nothing past the rate limit', async () => {
    const never = (async () => { throw new Error('no network expected') }) as typeof fetch
    expect((await handleAgentWarm(request(body, { Origin: 'https://evil.test', Authorization: 'Bearer t' }), env(), () => {}, never)).status).toBe(403)
    expect((await handleAgentWarm(request(body, {}), env(), () => {}, never)).status).toBe(401)
    const auth = (async (url: string | URL | Request) => String(url).endsWith('/auth/v1/user') ? Response.json({ id: '22222222-2222-4222-8222-222222222222' }) : Response.json([])) as typeof fetch
    const background: Promise<unknown>[] = []
    const limited = await handleAgentWarm(request(body), env({ AGENT_RATE_LIMITER: { limit: async () => ({ success: false }) } }), (w) => background.push(w), auth)
    expect(await limited.json()).toEqual({ ok: false })
    expect(background).toHaveLength(0)
  })
})
