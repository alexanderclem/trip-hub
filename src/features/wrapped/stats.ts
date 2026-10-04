// Trip Wrapped: the numbers behind the recap slides, computed from what's on the phone (so it
// works offline). Pure, so every stat is unit-tested.

import type {
  Attachment, ExpenseRow, ItineraryItem, Member, MemberPreference, PackingItem, Place, PlaceRating, Poll, PollOption, PollVote, RouteLeg, Trip, TripTask,
} from '@/data/types'
import { combine } from '@/features/discovery/model'
import { scheduledItems } from '@/features/itinerary/travel'
import { rankOptions } from '@/features/polls/rank'
import { haversineM } from '@/lib/geo'
import { computeShares } from '@/lib/money'

export interface WrappedData {
  trip: Trip
  members: Member[]
  items: ItineraryItem[]
  places: Place[]
  legs: RouteLeg[]
  ratings: PlaceRating[]
  polls: Poll[]
  options: PollOption[]
  votes: PollVote[]
  expenses: ExpenseRow[]
  tasks: TripTask[]
  packing: PackingItem[]
  attachments: Attachment[]
  preferences: MemberPreference[]
}

export interface Award {
  title: string
  why: string
  memberId: string
  count: number
}

export interface Wrapped {
  days: number
  people: number
  km: number
  stops: number
  flights: number
  rides: number
  placesVisited: number
  topCategory: { category: string; count: number } | null
  favourite: { place: Place; average: number; count: number } | null
  divisive: { place: Place; spread: number } | null
  pollsHeld: number
  votesCast: number
  closest: { poll: Poll; winner: string; runnerUp: string; gap: number } | null
  totalMinor: number
  biggest: ExpenseRow | null
  topSpend: { category: string; minor: number } | null
  dailyMinor: number
  banker: { memberId: string; paidMinor: number } | null
  you: {
    shareMinor: number
    favourite: Place | null
    tasksDone: number
    receipts: number
    ratings: number
  } | null
  awards: Award[]
  groupTaste: ReturnType<typeof combine>
}

const alive = <T extends { deleted_at?: string | null }>(r: T) => !r.deleted_at
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1

function topBy<K>(counts: Map<K, number>): [K, number] | null {
  let best: [K, number] | null = null
  for (const entry of counts) if (!best || entry[1] > best[1]) best = entry
  return best
}

const tally = <K>(keys: K[]) => {
  const m = new Map<K, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}

export function computeWrapped(data: WrappedData, me: string | null): Wrapped {
  const members = data.members.filter(alive)
  const items = data.items.filter(alive).filter((i) => i.status !== 'cancelled')
  const places = new Map(data.places.filter(alive).map((p) => [p.id, p]))
  const expenses = data.expenses.filter(alive)
  const ratings = data.ratings.filter((r) => alive(r) && r.stars != null)

  // How long and how many.
  const starts = items.map((i) => i.start_local.slice(0, 10)).sort()
  const first = data.trip.start_date ?? starts[0] ?? null
  const last = data.trip.end_date ?? starts.at(-1) ?? null
  const days = first && last ? Math.max(1, dayDiff(first, last)) : 0

  // Distance: the group's stops in order, by routed distance where we have it.
  const stops = scheduledItems(items).filter((i) => i.place_id && places.get(i.place_id)?.lat != null)
  let metres = 0
  for (let n = 1; n < stops.length; n++) {
    const a = places.get(stops[n - 1]!.to_place_id ?? stops[n - 1]!.place_id!)
    const b = places.get(stops[n]!.place_id!)
    if (!a || !b || a.id === b.id || a.lat == null || a.lng == null || b.lat == null || b.lng == null) continue
    const leg = data.legs.find((l) => alive(l) && l.mode === 'drive' && ((l.from_place_id === a.id && l.to_place_id === b.id) || (l.from_place_id === b.id && l.to_place_id === a.id)))
    metres += leg?.distance_m ?? haversineM({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng })
  }
  // Flights count their own distance between their two ends.
  for (const f of items.filter((i) => i.kind === 'flight' && i.place_id && i.to_place_id)) {
    const a = places.get(f.place_id!)
    const b = places.get(f.to_place_id!)
    if (a?.lat != null && a.lng != null && b?.lat != null && b.lng != null) metres += haversineM({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng })
  }

  // Places.
  const visitedPlaces = [...places.values()].filter((p) => p.status === 'visited' || p.status === 'booked' || p.status === 'planned')
  const plannedPlaceIds = new Set(items.flatMap((i) => (i.place_id ? [i.place_id] : [])))
  const been = [...places.values()].filter((p) => plannedPlaceIds.has(p.id) || p.status === 'visited')
  const cat = topBy(tally(been.filter((p) => p.category !== 'lodging' && p.category !== 'transport' && p.category !== 'flight').map((p) => p.category)))

  // Ratings: favourite (best average, at least two ratings) and most divisive (widest spread).
  const byPlace = new Map<string, number[]>()
  for (const r of ratings) byPlace.set(r.place_id, [...(byPlace.get(r.place_id) ?? []), r.stars!])
  let favourite: Wrapped['favourite'] = null
  let divisive: Wrapped['divisive'] = null
  for (const [placeId, stars] of byPlace) {
    const place = places.get(placeId)
    if (!place || stars.length < 2) continue
    const average = stars.reduce((a, b) => a + b, 0) / stars.length
    if (!favourite || average > favourite.average || (average === favourite.average && stars.length > favourite.count)) favourite = { place, average, count: stars.length }
    const spread = Math.max(...stars) - Math.min(...stars)
    if (spread >= 2 && (!divisive || spread > divisive.spread)) divisive = { place, spread }
  }
  if (divisive && favourite && divisive.place.id === favourite.place.id) divisive = null

  // Votes: how many, and the closest call between the top two options.
  const polls = data.polls.filter(alive)
  const votes = data.votes.filter((v) => alive(v) && v.score != null)
  let closest: Wrapped['closest'] = null
  for (const poll of polls) {
    const ranked = rankOptions(data.options.filter((o) => o.poll_id === poll.id), votes, members.length).filter((r) => r.mean != null)
    if (ranked.length < 2) continue
    const gap = ranked[0]!.mean! - ranked[1]!.mean!
    if (!closest || gap < closest.gap) closest = { poll, winner: ranked[0]!.option.label, runnerUp: ranked[1]!.option.label, gap }
  }

  // Money, in the base currency.
  const totalMinor = expenses.reduce((a, e) => a + e.base_amount_minor, 0)
  const biggest = [...expenses].sort((a, b) => b.base_amount_minor - a.base_amount_minor)[0] ?? null
  const spendByCat = new Map<string, number>()
  for (const e of expenses) spendByCat.set(e.category, (spendByCat.get(e.category) ?? 0) + e.base_amount_minor)
  const topSpend = topBy(spendByCat)
  const paid = new Map<string, number>()
  const owed = new Map<string, number>()
  for (const e of expenses) {
    for (const [m, s] of computeShares(e)) {
      paid.set(m, (paid.get(m) ?? 0) + s.paid)
      owed.set(m, (owed.get(m) ?? 0) + s.owed)
    }
  }
  const banker = topBy(paid)

  // Awards: whoever did the most of each thing (only if they did it at all).
  const awardDefs: [string, string, (string | null | undefined)[]][] = [
    ['The Planner', 'plans added', data.items.filter(alive).map((i) => i.created_by)],
    ['The Scout', 'places found', data.places.filter((p) => alive(p) && p.source === 'manual').map((p) => p.created_by)],
    ['The Critic', 'places rated', ratings.map((r) => r.member_id)],
    ['The Treasurer', 'expenses logged', expenses.map((e) => e.created_by)],
    ['The Scanner', 'receipts scanned', data.attachments.filter((a) => alive(a) && a.kind === 'receipt').map((a) => a.created_by)],
    ['The Fixer', 'tasks done', data.tasks.filter((t) => alive(t) && t.completed && t.assignee_id).map((t) => t.assignee_id)],
    ['The Sherpa', 'group items carried', data.packing.filter((p) => alive(p) && p.kind === 'group' && p.owner_id).map((p) => p.owner_id)],
  ]
  const memberIds = new Set(members.map((m) => m.id))
  const awards: Award[] = []
  for (const [title, why, who] of awardDefs) {
    const top = topBy(tally(who.filter((id): id is string => !!id && memberIds.has(id))))
    if (top && top[1] > 0) awards.push({ title, why, memberId: top[0], count: top[1] })
  }

  // You.
  let you: Wrapped['you'] = null
  if (me && memberIds.has(me)) {
    const mine = ratings.filter((r) => r.member_id === me).sort((a, b) => b.stars! - a.stars! || (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
    you = {
      shareMinor: owed.get(me) ?? 0,
      favourite: mine[0] ? places.get(mine[0].place_id) ?? null : null,
      tasksDone: data.tasks.filter((t) => alive(t) && t.completed && t.assignee_id === me).length,
      receipts: data.attachments.filter((a) => alive(a) && a.kind === 'receipt' && a.created_by === me).length,
      ratings: mine.length,
    }
  }

  return {
    days,
    people: members.length,
    km: Math.round(metres / 1000),
    stops: stops.length,
    flights: items.filter((i) => i.kind === 'flight').length,
    rides: items.filter((i) => i.kind === 'transport').length,
    placesVisited: Math.max(been.length, visitedPlaces.filter((p) => p.status === 'visited').length),
    topCategory: cat ? { category: cat[0], count: cat[1] } : null,
    favourite,
    divisive,
    pollsHeld: polls.length,
    votesCast: votes.length,
    closest,
    totalMinor,
    biggest,
    topSpend: topSpend ? { category: topSpend[0], minor: topSpend[1] } : null,
    dailyMinor: days ? Math.round(totalMinor / days) : 0,
    banker: banker && banker[1] > 0 ? { memberId: banker[0], paidMinor: banker[1] } : null,
    you,
    awards,
    groupTaste: combine(data.preferences.filter(alive)),
  }
}

/** Unlocked on the trip's last day; before that it's a preview. */
export const isRecapTime = (trip: Pick<Trip, 'end_date' | 'timezone'>, now: number) =>
  !!trip.end_date && new Date(now).toLocaleDateString('en-CA', { timeZone: trip.timezone }) >= trip.end_date
