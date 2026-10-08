export interface Point { lat: number; lng: number }
export interface TrafficRoute {
  duration_s: number
  distance_m: number
  departure_at: string
  checked_at: string
}

export function validPoint(p: Point): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180
}

/** Fresh, directional driving route. Never persisted or multiplied by planning buffers. */
export async function computeTrafficRoute(from: Point, to: Point, key: string, fetchFn: typeof fetch = fetch): Promise<TrafficRoute> {
  if (!validPoint(from) || !validPoint(to)) throw new Error('Both places need valid map pins.')
  const departure = new Date().toISOString()
  const waypoint = (p: Point) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } })
  const response = await fetchFn('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify({ origin: waypoint(from), destination: waypoint(to), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE_OPTIMAL', departureTime: departure }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    let reason = ''
    try {
      const failure = await response.json() as { error?: { details?: { reason?: string }[]; status?: string } }
      reason = failure.error?.details?.find(d => d.reason)?.reason ?? failure.error?.status ?? ''
    } catch { /* Provider may return a non-JSON gateway error. */ }
    // Log codes only, never API keys, request coordinates, or raw provider messages.
    console.warn('traffic-route provider error', { status: response.status, reason })
    const messages: Record<string, string> = {
      SERVICE_DISABLED: 'Google Routes API is not enabled for the API key’s Google Cloud project. Enable Routes API, then try again.',
      BILLING_DISABLED: 'Google Routes requires billing enabled on the API key’s Google Cloud project.',
      API_KEY_INVALID: 'Google rejected the Routes API key. Check the GOOGLE_ROUTES_API_KEY secret in Supabase.',
      API_KEY_SERVICE_BLOCKED: 'The Google API key’s restrictions do not allow Routes API. Update its API restrictions.',
      API_KEY_HTTP_REFERRER_BLOCKED: 'This Google API key is restricted to websites. Traffic checks run on the server, so use a server key.',
      API_KEY_IP_ADDRESS_BLOCKED: 'The Google API key’s IP restriction blocks the Supabase server.',
      API_KEY_EXPIRED: 'The Google Routes API key has expired. Update the Supabase secret.',
    }
    throw new Error(messages[reason] ?? (response.status === 429
      ? 'Traffic service is busy. Try again shortly.'
      : response.status === 403 || response.status === 401
        ? 'Google denied the traffic request. Check Routes API activation, billing, and the API key’s server restrictions.'
        : response.status === 400
          ? 'Google could not accept this route request. Check the place pins and try again.'
          : 'Traffic service is unavailable. Use the planning estimate for now.'))
  }
  const body = await response.json() as { routes?: { duration?: string; distanceMeters?: number }[] }
  const route = body.routes?.[0]
  const duration = route?.duration && /^\d+(\.\d+)?s$/.test(route.duration) ? Number(route.duration.slice(0, -1)) : NaN
  const distance = route?.distanceMeters
  if (!Number.isFinite(duration) || distance == null || !Number.isFinite(distance) || distance < 0) throw new Error('No driving route found between these places.')
  return { duration_s: Math.round(duration), distance_m: distance, departure_at: departure, checked_at: new Date().toISOString() }
}
