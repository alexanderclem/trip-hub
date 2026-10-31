import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleTravel, lookup, type TravelEnv } from './travel'
import { travelRequestSchema } from '../src/features/travel/model'
const tripId = '10000000-0000-4000-8000-000000000001'
const env: TravelEnv = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public', TRAVEL_RATE_LIMITER: { limit: async () => ({ success: true }) } }
const request = (params: object, headers: HeadersInit = { Authorization: 'Bearer test' }) => new Request(`https://test.local/api/travel-info?${new URLSearchParams(Object.entries({ tripId, ...params }).map(([k, v]) => [k, String(v)]))}`, { headers })
afterEach(() => vi.unstubAllGlobals())
describe('travel provider boundary', () => {
  it('rejects invalid calendar dates and reversed event ranges', () => {
    expect(travelRequestSchema.safeParse({ tripId, action: 'flight', number: 'UA123', date: '2026-02-30' }).success).toBe(false)
    expect(travelRequestSchema.safeParse({ tripId, action: 'events', city: 'Paris', country: 'FR', start: '2026-12-02', end: '2026-12-01' }).success).toBe(false)
  })
  it('requires a session and blocks other origins without provider calls', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect((await handleTravel(request({ action: 'country', country: 'GT' }, {}), env)).status).toBe(401)
    expect((await handleTravel(request({ action: 'country', country: 'GT' }, { Authorization: 'Bearer test', Origin: 'https://elsewhere.test' } as { Authorization: string }), env)).status).toBe(403)
    expect(f).not.toHaveBeenCalled()
  })
  it('checks trip membership before contacting providers', async () => {
    const f = vi.fn().mockResolvedValueOnce(Response.json({ id: tripId })).mockResolvedValueOnce(Response.json([])); vi.stubGlobal('fetch', f)
    expect((await handleTravel(request({ action: 'holidays', country: 'GT', year: 2026 }), env)).status).toBe(403)
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('limits authenticated lookups and returns useful missing-key errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => Response.json(url.includes('/auth/') ? { id: tripId } : [{ id: tripId }])))
    expect((await handleTravel(request({ action: 'country', country: 'GT' }), { ...env, TRAVEL_RATE_LIMITER: { limit: async () => ({ success: false }) } })).status).toBe(429)
    const response = await handleTravel(request({ action: 'country', country: 'GT' }), env)
    expect(response.status).toBe(503)
    expect((await response.json()).error).toContain('REST Countries')
  })
  it('preserves regional holiday scope and filters non-public observances', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([
      { date: '2026-11-01', name: 'All Saints', nationalHoliday: true, holidayTypes: ['Public'] },
      { date: '2026-11-02', name: 'Regional day', nationalHoliday: false, subdivisionCodes: ['GT-01'], holidayTypes: ['Public'] },
      { date: '2026-11-03', name: 'Observance', nationalHoliday: true, holidayTypes: ['Observance'] },
    ])))
    expect(await lookup({ tripId, action: 'holidays', country: 'GT', year: 2026 }, env)).toEqual([
      { date: '2026-11-01', name: 'All Saints', regional: false, regions: [] },
      { date: '2026-11-02', name: 'Regional day', regional: true, regions: ['GT-01'] },
    ])
  })
  it('normalizes country essentials from the v5 response envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: { objects: [{ names: { common: 'France' }, currencies: { EUR: { name: 'Euro' } }, languages: [{ name: 'French' }], calling_codes: ['33'] }] } })))
    expect(await lookup({ tripId, action: 'country', country: 'FR' }, { ...env, RESTCOUNTRIES_API_KEY: 'secret' })).toEqual({ name: 'France', currencies: ['EUR'], languages: ['French'], callingCodes: ['33'] })
  })
  it('handles empty events and excludes unsafe external links', async () => {
    const f = vi.fn().mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(Response.json({ _embedded: { events: [
      { id: '1', name: 'Show', url: 'javascript:alert(1)', dates: { start: { localDate: '2026-11-01' } } },
      { id: '2', name: 'Concert', url: 'https://ticketmaster.com/event/2', dates: { start: { localDate: '2026-11-02', localTime: '19:30:00' }, timezone: 'Europe/Paris' } },
    ] } })); vi.stubGlobal('fetch', f)
    const input = { tripId, action: 'events' as const, country: 'FR', city: 'Paris', start: '2026-11-01', end: '2026-11-03' }
    expect(await lookup(input, { ...env, TICKETMASTER_API_KEY: 'secret' })).toEqual([])
    expect(await lookup(input, { ...env, TICKETMASTER_API_KEY: 'secret' })).toMatchObject([{ id: '2', time: '19:30', zone: 'Europe/Paris' }])
    const url = f.mock.calls[1]![0] as URL
    expect(url.searchParams.get('localStartDateTime')).toBe('2026-11-01T00:00:00,2026-11-03T23:59:59')
  })
  it('keeps only the matching flight on the requested departure date', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: [
      { flight_date: '2026-11-01', flight_status: 'active', flight: { iata: 'UA123' }, departure: { iata: 'SFO', gate: 'G4', delay: 20 }, arrival: { iata: 'GUA' } },
      { flight_date: '2026-11-02', flight_status: 'scheduled', flight: { iata: 'UA123' }, departure: {}, arrival: {} },
    ] })))
    expect(await lookup({ tripId, action: 'flight', number: 'UA123', date: '2026-11-01' }, { ...env, AVIATIONSTACK_API_KEY: 'secret' })).toMatchObject([{ number: 'UA123', departure: 'SFO', arrival: 'GUA', gate: 'G4', delay: 20 }])
  })
  it('does not expose provider errors or credentials to clients', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ id: tripId })).mockResolvedValueOnce(Response.json([{ id: tripId }])).mockRejectedValueOnce(new Error('https://provider?key=SECRET')))
    const response = await handleTravel(request({ action: 'country', country: 'GT' }), { ...env, RESTCOUNTRIES_API_KEY: 'SECRET' })
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('SECRET')
  })
})
