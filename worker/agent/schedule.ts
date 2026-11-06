// The agent's memory and referee (docs/AGENT_PLANNER.md, "Orchestration").
// Every provider result is stored here in full; the model only ever sees short summaries and ids.
// When it submits an itinerary, each node is resolved against this ledger, so a flight time, a hotel
// price or a tour start the model "remembers" wrongly can't reach the traveler: we use our copy.
import { DateTime } from 'luxon'
import type { SubmittedNode } from './tools'

export interface Segment { from: string; to: string; departLocal: string; departZone: string; arriveLocal: string; arriveZone: string; flight: string }
export interface FlightOffer { kind: 'flight'; id: string; totalMinor: number; currency: string; expiresAt: string; segments: Segment[] }
export interface HotelRate { kind: 'hotel'; id: string; hotelId: string; name: string; lat: number | null; lng: number | null; checkin: string; checkout: string; totalMinor: number; currency: string; refundable: boolean; photo?: string | null; address?: string | null }
export interface ActivityProduct { kind: 'product'; id: string; title: string; durationMin: number; fromMinor: number; currency: string; photo?: string | null; url?: string | null }
export interface ActivitySlot { kind: 'slot'; id: string; productCode: string; title: string; date: string; start: string; durationMin: number; totalMinor: number; currency: string; lat: number | null; lng: number | null; photo?: string | null; url?: string | null }
export type Entry = FlightOffer | HotelRate | ActivityProduct | ActivitySlot

export interface TripPlace { id: string; name: string; lat: number; lng: number }
export interface Constraints {
  start: string; end: string; zone: string; currency: string; budgetMinor: number | null; adults: number
  places: TripPlace[]
}

/** Buffers, in minutes. Conservative on purpose: a missed tour costs more than an idle hour. */
export const BUFFER = { beforeDeparture: 180, afterArrival: 90, betweenStops: 30 }

export class Ledger {
  private entries = new Map<string, Entry>()
  private aliases = new Map<string, string>()
  private references = new Map<string, string>()
  put(entry: Entry) { this.entries.set(entry.id, entry) }
  get(id: string) { return this.entries.get(id) ?? this.entries.get(this.aliases.get(id) ?? '') }
  /** Keep opaque provider tokens off the model's copy-and-paste path. Booking retains entry.id. */
  reference(id: string): string {
    const existing = this.references.get(id)
    if (existing) return existing
    if (!this.entries.has(id)) throw new Error('Cannot reference an unknown offer.')
    let alias = `stowaway_offer_${this.aliases.size + 1}`
    while (this.entries.has(alias) || this.aliases.has(alias)) alias += '_'
    this.aliases.set(alias, id)
    this.references.set(id, alias)
    return alias
  }
  all() { return [...this.entries.values()] }
}

export interface Block {
  node: number; kind: 'flight' | 'activity' | 'free'; title: string
  /** The ledger id (flight offer, activity slot) or trip place id behind this block. */
  ref: string | null
  start: DateTime; end: DateTime
  /** Busy time around the block (airport, immigration, getting there) that nothing else may use. */
  busyFrom: DateTime; busyTo: DateTime
  lat: number | null; lng: number | null
  /** Fixed blocks can't move; free blocks may be reordered by the route optimiser. */
  fixed: boolean
}
export interface Stay { node: number; rate: HotelRate }
export interface Resolved { blocks: Block[]; stays: Stay[]; totalMinor: number; errors: string[] }

const at = (date: string, time: string, zone: string) => DateTime.fromISO(`${date}T${time}`, { zone })
const label = (i: number, n: SubmittedNode) => `nodes[${i}] (${n.kind}${n.ref ? ` ${n.ref}` : ''})`

/** Turn the model's nodes into timed blocks from ledger data, collecting every problem at once. */
export function resolve(nodes: SubmittedNode[], ledger: Ledger, c: Constraints, now: DateTime = DateTime.utc()): Resolved {
  const blocks: Block[] = []
  const stays: Stay[] = []
  const errors: string[] = []
  const charged = new Set<string>()
  const used = new Set<string>()
  let totalMinor = 0
  const charge = (id: string, minor: number, currency: string, where: string) => {
    if (currency !== c.currency) { errors.push(`${where}: priced in ${currency}, but the trip currency is ${c.currency}. Search again with currency ${c.currency}.`); return }
    if (!charged.has(id)) { charged.add(id); totalMinor += minor }
  }

  nodes.forEach((n, i) => {
    const where = label(i, n)
    if (n.kind === 'free') {
      // Free time is unbooked, so its problems are repaired here (settleFree) instead of costing a resubmit.
      if (!n.start_time || !n.duration_minutes || n.day < c.start || n.day > c.end) return
      const place = n.ref ? c.places.find((p) => p.id === n.ref) ?? null : null
      const start = at(n.day, n.start_time, c.zone)
      if (!start.isValid) return
      const end = start.plus({ minutes: n.duration_minutes })
      blocks.push({ node: i, kind: 'free', title: place?.name ?? n.note, ref: place?.id ?? null, start, end, busyFrom: start, busyTo: end, lat: place?.lat ?? null, lng: place?.lng ?? null, fixed: false })
      return
    }
    if (n.day < c.start || n.day > c.end) errors.push(`${where}: ${n.day} is outside the trip (${c.start} to ${c.end}).`)
    const entry = n.ref ? ledger.get(n.ref) : undefined
    if (!entry) { errors.push(`${where}: unknown reference. Use only ids returned by a tool in this conversation.`); return }
    // The model often lists a round trip twice (out and back) or repeats a stay. One offer is one
    // booking, so a repeat is dropped here rather than costing a whole resubmit as a "clash".
    if (used.has(entry.id)) return
    used.add(entry.id)
    if (n.kind === 'flight') {
      if (entry.kind !== 'flight') { errors.push(`${where}: ${n.ref} is not a flight offer.`); return }
      if (DateTime.fromISO(entry.expiresAt) <= now) { errors.push(`${where}: this offer expired at ${entry.expiresAt}. Call search_flights again.`); return }
      charge(entry.id, entry.totalMinor, entry.currency, where)
      entry.segments.forEach((s) => {
        const start = DateTime.fromISO(s.departLocal, { zone: s.departZone })
        const end = DateTime.fromISO(s.arriveLocal, { zone: s.arriveZone })
        blocks.push({ node: i, kind: 'flight', title: `${s.flight} ${s.from}→${s.to}`, ref: entry.id, start, end, busyFrom: start.minus({ minutes: BUFFER.beforeDeparture }), busyTo: end.plus({ minutes: BUFFER.afterArrival }), lat: null, lng: null, fixed: true })
      })
      return
    }
    if (n.kind === 'hotel') {
      if (entry.kind !== 'hotel') { errors.push(`${where}: ${n.ref} is not a hotel rate.`); return }
      if (n.day !== entry.checkin) errors.push(`${where}: day must be the check-in date ${entry.checkin}.`)
      charge(entry.id, entry.totalMinor, entry.currency, where)
      stays.push({ node: i, rate: entry })
      return
    }
    if (entry.kind !== 'slot') { errors.push(`${where}: activities must reference a slot_id from check_activity_times, not a product code.`); return }
    if (n.day !== entry.date) errors.push(`${where}: this slot is on ${entry.date}, not ${n.day}.`)
    if (n.start_time && n.start_time !== entry.start) errors.push(`${where}: this slot starts at ${entry.start}; you wrote ${n.start_time}.`)
    charge(entry.id, entry.totalMinor, entry.currency, where)
    const start = at(entry.date, entry.start, c.zone)
    const end = start.plus({ minutes: entry.durationMin })
    blocks.push({ node: i, kind: 'activity', title: entry.title, ref: entry.id, start, end, busyFrom: start.minus({ minutes: BUFFER.betweenStops }), busyTo: end, lat: entry.lat, lng: entry.lng, fixed: true })
  })

  const settled = settleFree(blocks, destinationWindow(blocks, c), c.zone)
  errors.push(...conflicts(settled), ...stayGaps(stays, settled, c))
  if (c.budgetMinor !== null && totalMinor > c.budgetMinor) errors.push(`Total ${totalMinor} ${c.currency} (minor units) is over the budget of ${c.budgetMinor}. Swap something for a cheaper offer.`)
  settled.sort((a, b) => a.start.toMillis() - b.start.toMillis())
  return { blocks: settled, stays, totalMinor, errors }
}

/** Free time shorter than this after trimming isn't worth showing. */
export const MIN_FREE_MINUTES = 30

/**
 * Free blocks give way to everything booked: each is trimmed out of flights, tours and their buffers
 * (and out of earlier free time), and dropped if it falls off the destination days or under 30 minutes.
 * Only booked items can clash after this, and those are the model's to fix.
 */
export function settleFree(blocks: Block[], window: { first: string; last: string }, zone: string): Block[] {
  const fixed = blocks.filter((b) => b.kind !== 'free')
  const kept: Block[] = []
  const minutes = (from: DateTime, to: DateTime) => to.diff(from, 'minutes').minutes
  for (const f of blocks.filter((b) => b.kind === 'free').sort((a, b) => a.start.toMillis() - b.start.toMillis())) {
    const day = f.start.setZone(zone).toISODate()!
    if (day < window.first || day > window.last) continue
    let s = f.start, e = f.end
    const taken = [...fixed.map((b) => [b.busyFrom, b.busyTo] as const), ...kept.map((b) => [b.start, b.end] as const)]
      .sort(([a], [b]) => a.toMillis() - b.toMillis())
    for (const [from, to] of taken) {
      if (to <= s || from >= e) continue
      if (from <= s) s = to
      // Something booked sits inside the free time: keep the longer usable side.
      else if (minutes(s, from) < MIN_FREE_MINUTES && minutes(to, e) >= MIN_FREE_MINUTES) s = to
      else e = from
      if (e <= s) break
    }
    if (minutes(s, e) < MIN_FREE_MINUTES) continue
    kept.push({ ...f, start: s, end: e, busyFrom: s, busyTo: e })
  }
  return [...fixed, ...kept]
}

/** The first and last local dates the group is at the destination (landing to final departure). */
export function destinationWindow(blocks: Block[], c: Constraints): { first: string; last: string } {
  const flights = blocks.filter((b) => b.kind === 'flight')
  const first = flights.length ? DateTime.min(...flights.map((f) => f.end))!.setZone(c.zone).toISODate()! : c.start
  const last = flights.length > 1 ? DateTime.max(...flights.map((f) => f.start))!.setZone(c.zone).toISODate()! : c.end
  return { first, last }
}

/** Any two blocks whose busy windows overlap. Free blocks may overlap each other's buffers only. */
export function conflicts(blocks: Block[]): string[] {
  const out: string[] = []
  const sorted = [...blocks].sort((a, b) => a.busyFrom.toMillis() - b.busyFrom.toMillis())
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!, b = sorted[j]!
      if (b.busyFrom >= a.busyTo) break
      if (a.node === b.node) continue // connecting segments of one flight offer
      const fmt = (d: DateTime) => d.toFormat('ccc d LLL HH:mm ZZZZ')
      out.push(`nodes[${a.node}] "${a.title}" (${fmt(a.start)}–${fmt(a.end)}) clashes with nodes[${b.node}] "${b.title}" (${fmt(b.start)}–${fmt(b.end)}), counting ${a.kind === 'flight' || b.kind === 'flight' ? 'airport and immigration time' : `${BUFFER.betweenStops} min to get between stops`}.`)
    }
  }
  return out
}

/** Every night between landing and the last departure needs exactly one stay. */
export function stayGaps(stays: Stay[], blocks: Block[], c: Constraints): string[] {
  const out: string[] = []
  const { first, last } = destinationWindow(blocks, c)
  for (let night = DateTime.fromISO(first, { zone: c.zone }); night.toISODate()! < last; night = night.plus({ days: 1 })) {
    const d = night.toISODate()!
    const covering = stays.filter((s) => s.rate.checkin <= d && d < s.rate.checkout)
    if (covering.length === 0) out.push(`No hotel for the night of ${d}.`)
    if (covering.length > 1) out.push(`Two hotels overlap on the night of ${d}: nodes[${covering.map((s) => s.node).join('], nodes[')}].`)
  }
  for (const b of blocks) {
    if (b.kind === 'flight') continue
    const day = b.start.toISODate()!
    if (day < first || day > last) out.push(`nodes[${b.node}] "${b.title}" is on ${day}, when the group is not at the destination (${first} to ${last}).`)
  }
  return out
}

/**
 * One stay whose nights don't match landing → last departure (usually an overnight flight landing a
 * day later than the model assumed): swap in the same hotel's rate for the right nights, if searched.
 */
export function repairStay(nodes: SubmittedNode[], r: Resolved, ledger: Ledger, c: Constraints): SubmittedNode[] | null {
  const stay = r.stays.length === 1 ? r.stays[0]! : null
  if (!stay) return null
  const { first, last } = destinationWindow(r.blocks, c)
  if (stay.rate.checkin === first && stay.rate.checkout === last) return null
  const swap = ledger.all().find((e): e is HotelRate => e.kind === 'hotel' && e.hotelId === stay.rate.hotelId && e.checkin === first && e.checkout === last && e.currency === c.currency)
  return swap ? nodes.map((n, i) => (i === stay.node ? { ...n, ref: swap.id, day: swap.checkin } : n)) : null
}

/** Where the group sleeps on a given night: the start and end point of that day's route. */
export function stayFor(day: string, stays: Stay[]): HotelRate | null {
  return stays.find((s) => s.rate.checkin <= day && day < s.rate.checkout)?.rate
    ?? stays.find((s) => s.rate.checkout === day)?.rate ?? null
}
