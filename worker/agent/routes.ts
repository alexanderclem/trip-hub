// Daily path optimisation with the Google Routes API (computeRoutes + optimizeWaypointOrder).
// Booked things have fixed times, and the optimiser knows nothing about time windows, so each day is
// cut into segments at its fixed points (hotel in the morning → tour at 10:00 → … → hotel at night).
// Only the flexible stops between two fixed points are reordered, one request per segment, and the
// result must still fit the gap or the plan goes back to the model.
import { DateTime } from 'luxon'
import { BUFFER, stayFor, type Block, type Constraints, type Resolved } from './schedule'

export const DAY_START = '08:00'
export const DAY_END = '22:00'
/** Hard cap on Routes requests per plan (the Routes approval in CLAUDE.md is for bounded, on-demand calls). */
export const MAX_ROUTE_REQUESTS = 12

interface Point { title: string; lat: number; lng: number; at: DateTime }
export interface RouteSegment { day: string; from: Point; to: Point; stops: Block[]; body: ComputeRoutesBody }
export interface ComputeRoutesBody {
  origin: Waypoint; destination: Waypoint; intermediates: Waypoint[]
  travelMode: 'DRIVE' | 'WALK'; optimizeWaypointOrder: true
  routingPreference?: 'TRAFFIC_AWARE'; departureTime?: string
}
interface Waypoint { location: { latLng: { latitude: number; longitude: number } } }
const wp = (lat: number, lng: number): Waypoint => ({ location: { latLng: { latitude: lat, longitude: lng } } })
export const FIELD_MASK = 'routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.legs.distanceMeters'

/** The request bodies to send, plus stops that can't be routed (no coordinates) for the UI to flag. */
export function planRoutes(r: Resolved, c: Constraints, mode: 'DRIVE' | 'WALK' = 'DRIVE', now: DateTime = DateTime.utc()): { segments: RouteSegment[]; unrouted: Block[] } {
  const segments: RouteSegment[] = []
  const unrouted: Block[] = []
  const days = [...new Set(r.blocks.filter((b) => b.kind !== 'flight').map((b) => b.start.setZone(c.zone).toISODate()!))].sort()
  for (const day of days) {
    const stay = stayFor(day, r.stays)
    const onDay = r.blocks.filter((b) => b.kind !== 'flight' && b.start.setZone(c.zone).toISODate() === day)
    if (!stay || stay.lat === null || stay.lng === null) { unrouted.push(...onDay); continue }
    const home = (time: string): Point => ({ title: stay.name, lat: stay.lat!, lng: stay.lng!, at: DateTime.fromISO(`${day}T${time}`, { zone: c.zone }) })
    // Fixed points with no coordinates still bound the time windows; segments touching them are skipped.
    const fixed = onDay.filter((b) => b.fixed).sort((a, b) => a.start.toMillis() - b.start.toMillis())
    const anchors: (Point & { end: DateTime; routable: boolean })[] = [
      { ...home(DAY_START), end: home(DAY_START).at, routable: true },
      ...fixed.map((b) => ({ title: b.title, lat: b.lat ?? 0, lng: b.lng ?? 0, at: b.start, end: b.end, routable: b.lat !== null && b.lng !== null })),
      { ...home(DAY_END), end: home(DAY_END).at, routable: true },
    ]
    for (const b of fixed) if (b.lat === null || b.lng === null) unrouted.push(b)
    for (let k = 0; k + 1 < anchors.length; k++) {
      const a = anchors[k]!, z = anchors[k + 1]!
      const stops = onDay.filter((b) => !b.fixed && b.start >= a.end && b.start < z.at)
      const located = stops.filter((b) => b.lat !== null && b.lng !== null)
      unrouted.push(...stops.filter((b) => b.lat === null || b.lng === null))
      if (!located.length || !a.routable || !z.routable) { if (!a.routable || !z.routable) unrouted.push(...located); continue }
      const departure = a.end
      segments.push({
        day, from: { ...a, at: a.end }, to: z, stops: located,
        body: {
          origin: wp(a.lat, a.lng), destination: wp(z.lat, z.lng), intermediates: located.map((b) => wp(b.lat!, b.lng!)),
          travelMode: mode, optimizeWaypointOrder: true,
          // Traffic needs a future departure; WALK ignores it.
          ...(mode === 'DRIVE' && departure > now ? { routingPreference: 'TRAFFIC_AWARE' as const, departureTime: departure.toUTC().toISO()! } : {}),
        },
      })
    }
  }
  return { segments, unrouted }
}

export interface Optimised { day: string; order: Block[]; times: { node: number; start: string; end: string }[]; legSeconds: number[] }

/** Apply Google's order, re-time the stops in sequence, and say whether the segment still fits. */
export function applyRoute(seg: RouteSegment, response: unknown, zone: string): { result: Optimised | null; error: string | null } {
  const route = (response as { routes?: { optimizedIntermediateWaypointIndex?: number[]; legs?: { duration?: string }[] }[] }).routes?.[0]
  if (!route?.legs?.length) return { result: null, error: `No route found on ${seg.day} between "${seg.from.title}" and "${seg.to.title}".` }
  const index = route.optimizedIntermediateWaypointIndex?.length === seg.stops.length ? route.optimizedIntermediateWaypointIndex : seg.stops.map((_, i) => i)
  const order = index.map((i) => seg.stops[i]!)
  const legSeconds = route.legs.map((l) => Number.parseInt(l.duration ?? '0', 10) || 0)
  let clock = seg.from.at
  const times: Optimised['times'] = []
  order.forEach((stop, i) => {
    // A free stop's start_time means "not before": arrive early and the group waits.
    clock = DateTime.max(clock.plus({ seconds: legSeconds[i] ?? 0 }), stop.start)!
    const dwell = stop.end.diff(stop.start, 'minutes').minutes
    times.push({ node: stop.node, start: clock.setZone(zone).toFormat('HH:mm'), end: clock.plus({ minutes: dwell }).setZone(zone).toFormat('HH:mm') })
    clock = clock.plus({ minutes: dwell })
  })
  clock = clock.plus({ seconds: legSeconds[order.length] ?? 0 })
  const deadline = seg.to.at.minus({ minutes: seg.to.title === seg.from.title ? 0 : BUFFER.betweenStops })
  if (clock > deadline) {
    const over = Math.ceil(clock.diff(deadline, 'minutes').minutes)
    return { result: null, error: `${seg.day}: the free stops between "${seg.from.title}" and "${seg.to.title}" need ${over} more minutes than there are, including travel. Drop or shorten one (nodes[${order.map((s) => s.node).join('], nodes[')}]).` }
  }
  return { result: { day: seg.day, order, times, legSeconds }, error: null }
}

export async function computeRoute(body: ComputeRoutesBody, apiKey: string, doFetch: typeof fetch = fetch): Promise<unknown> {
  const res = await doFetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`routes ${res.status}`)
  return res.json()
}
