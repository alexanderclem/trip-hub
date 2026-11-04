import { DateTime } from 'luxon'
import type { Place, TravelMode, ItineraryItem } from '@/data/types'
import { travelOptions, type LegContext, type TravelOption } from './legs'
import { stableId } from '@/lib/ids'
import { checkLocalTime, isValidZone, toInstant } from '@/lib/time'

export interface RouteStop { placeId: string; mode: TravelMode; stayMinutes: number }
export interface RouteSegment { from: Place; to: Place; option: TravelOption; departure: string; arrival: string }
export function routePreview(stops: RouteStop[], places: Place[], ctx: LegContext, local: string, zone: string): RouteSegment[] {
  if (!isValidZone(zone) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || checkLocalTime(local, zone).kind === 'gap') throw new Error('Choose a valid departure date, time, and time zone.')
  let departure: DateTime = DateTime.fromISO(toInstant(local, zone), { zone: 'UTC' })
  if (!departure.isValid) throw new Error('Choose a valid departure time.')
  if (stops.length < 2 || stops.length > 20) throw new Error('Choose between 2 and 20 stops.')
  const out: RouteSegment[] = []
  for (let n = 1; n < stops.length; n++) {
    const prev = stops[n - 1]!, stop = stops[n]!
    const from = places.find((p) => p.id === prev.placeId && !p.deleted_at), to = places.find((p) => p.id === stop.placeId && !p.deleted_at)
    if (!from || !to || from.id === to.id || from.trip_id !== to.trip_id) throw new Error('Choose different, available places for consecutive stops.')
    const option = travelOptions(from, to, ctx).find((o) => o.mode === stop.mode)
    if (!option) throw new Error(`No ${stop.mode} estimate for ${from.name} → ${to.name}. Choose another mode or add a reported travel time in the place details.`)
    if (!Number.isInteger(stop.stayMinutes) || stop.stayMinutes < 0 || stop.stayMinutes > 1440) throw new Error('Time at a stop must be between 0 and 1,440 whole minutes.')
    const arrival: DateTime = departure.plus({ minutes: Math.ceil(option.maxS / 60) })
    out.push({ from, to, option, departure: departure.toISO()!, arrival: arrival.toISO()! })
    departure = arrival.plus({ minutes: stop.stayMinutes })
  }
  return out
}

export function routeItems(tripId: string, routeId: string, segments: RouteSegment[], zone: string): ItineraryItem[] {
  return segments.map((s, i) => ({
    id: stableId(tripId, 'route', routeId, String(i)), trip_id: tripId, title: `${s.from.name} → ${s.to.name}`,
    kind: 'transport', place_id: s.from.id, to_place_id: s.to.id, all_day: false,
    start_local: DateTime.fromISO(s.departure).setZone(zone).toFormat("yyyy-MM-dd'T'HH:mm"), start_tz: zone, start_at: s.departure,
    end_local: DateTime.fromISO(s.arrival).setZone(zone).toFormat("yyyy-MM-dd'T'HH:mm"), end_tz: zone, end_at: s.arrival,
    status: 'tentative', confirmation_code: null, attendee_ids: null,
    details: { route_id: routeId, travel_mode: s.option.mode }, notes: `Planning estimate using ${s.option.source} travel time; allows the upper estimate. Check schedules and conditions separately.`,
    est_cost_minor: null, est_cost_currency: null,
  }))
}
