import { describe, expect, it, vi } from 'vitest'
import { computeTrafficRoute } from './routing'
const from = { lat: 14.55, lng: -90.73 }
const to = { lat: 14.74, lng: -91.15 }

describe('traffic driving routes', () => {
  it.each([
    ['SERVICE_DISABLED', 'not enabled'],
    ['BILLING_DISABLED', 'billing enabled'],
    ['API_KEY_SERVICE_BLOCKED', 'restrictions do not allow'],
    ['API_KEY_HTTP_REFERRER_BLOCKED', 'restricted to websites'],
    ['API_KEY_INVALID', 'Google rejected'],
  ])('explains Google setup failure %s without leaking provider content', async (reason, message) => {
    const fetcher = async () => new Response(JSON.stringify({ error: { message: 'private provider details', details: [{ reason }] } }), { status: 403 })
    await expect(computeTrafficRoute(from, to, 'key', fetcher)).rejects.toThrow(message)
  })

  it('requests directional traffic-aware driving and preserves the actual ETA without a multiplier', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ routes: [{ duration: '1234.5s', distanceMeters: 76543 }] })))
    const result = await computeTrafficRoute(from, to, 'server-key', fetcher as typeof fetch)
    const init = fetcher.mock.calls[0]?.[1] as RequestInit | undefined
    const body = JSON.parse(init?.body as string)
    expect(body).toMatchObject({ origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } }, destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE_OPTIMAL' })
    expect(body).not.toHaveProperty('departureTime')
    expect(result).toMatchObject({ duration_s: 1235, distance_m: 76543 })
    expect(init?.headers).toMatchObject({ 'X-Goog-Api-Key': 'server-key', 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters' })
  })
  it('rejects invalid pins before calling the paid API', async () => {
    const fetcher = vi.fn()
    await expect(computeTrafficRoute({ lat: 91, lng: 0 }, to, 'key', fetcher)).rejects.toThrow('valid map pins')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([{ routes: [] }, { routes: [{ duration: 'oops', distanceMeters: 10 }] }, { routes: [{ duration: '10s', distanceMeters: -1 }] }])('rejects missing or malformed routes', async (body) => {
    await expect(computeTrafficRoute(from, to, 'key', async () => new Response(JSON.stringify(body)))).rejects.toThrow('No driving route')
  })
  it('handles quota errors without exposing credentials or upstream details', async () => {
    await expect(computeTrafficRoute(from, to, 'key', async () => new Response('secret details', { status: 429 }))).rejects.toThrow('Try again shortly')
  })
})
