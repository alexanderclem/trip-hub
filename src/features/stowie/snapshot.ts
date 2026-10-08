import { DateTime } from 'luxon'
import { db, type TripDb } from '@/data/db'
import type { Trip } from '@/data/types'
import { classify, profileSchema, type Topic } from '@/features/discovery/model'
import { SCORE_LABEL } from '@/features/polls/rank'
import { balances, formatMoney, simplifyDebts } from '@/lib/money'
import { isValidZone } from '@/lib/time'

/**
 * What Stowie reads to answer a question: short text built on the phone from local data, one
 * section per topic, and only the topics the question needs. Never included: tickets and their
 * text, confirmation codes, notes, invitation links, emergency numbers and medical cards.
 */
const alive = <T extends { deleted_at?: string | null }>(row: T) => !row.deleted_at
const LINES = 90
const CHARS = 8000
const section = (lines: string[], empty: string) => (lines.length ? lines.slice(0, LINES).map((l) => l.slice(0, 220)).join('\n').slice(0, CHARS) : empty)
const PICKED = ['shortlist', 'planned', 'booked', 'visited']

export function todayIn(trip: Trip): string {
  const zone = isValidZone(trip.timezone) ? trip.timezone : 'utc'
  return `${DateTime.now().setZone(zone).toFormat('cccc d LLLL yyyy, HH:mm')} (${zone})`
}

async function names(tripId: string, database: TripDb) {
  const members = (await database.members.where('trip_id').equals(tripId).toArray()).filter(alive)
  return { members, name: (id: string | null | undefined) => members.find((m) => m.id === id)?.display_name ?? 'someone' }
}

/** Balances and the fewest payments to settle, worked out on the phone so the figures are exact. */
export async function moneySummary(trip: Trip, memberId: string, database: TripDb = db): Promise<{ mine: string; everyone: string }> {
  const { name } = await names(trip.id, database)
  const num = <T extends { fx_rate: number }>(row: T): T => ({ ...row, fx_rate: Number(row.fx_rate) })
  const expenses = (await database.expenses.where('trip_id').equals(trip.id).toArray()).filter(alive).map(num)
  const settlements = (await database.settlements.where('trip_id').equals(trip.id).toArray()).filter(alive).map(num)
  if (!expenses.length) return { mine: 'Nobody has logged an expense yet, so you’re all square.', everyone: 'No expenses logged yet.' }
  const net = balances(expenses, settlements)
  const money = (minor: number) => formatMoney(Math.abs(minor), trip.base_currency)
  const transfers = simplifyDebts(net)
  const total = expenses.reduce((sum, e) => sum + e.base_amount_minor, 0)
  const own = net.get(memberId) ?? 0
  // The model is told who is asking, so the shared lines use names.
  const who = (id: string) => `${name(id)}${id === memberId ? ' (me)' : ''}`
  const myTransfers = transfers.filter((t) => t.from === memberId || t.to === memberId)
    .map((t) => (t.from === memberId ? `Pay ${name(t.to)} ${money(t.amount_minor)}.` : `${name(t.from)} pays you ${money(t.amount_minor)}.`))
  return {
    mine: [own > 0 ? `You’re owed ${money(own)}.` : own < 0 ? `You owe ${money(own)}.` : 'You’re all square.', ...myTransfers].join(' '),
    everyone: [
      `Total spent: ${money(total)} (${trip.base_currency}).`,
      ...[...net].filter(([, v]) => v !== 0).map(([id, v]) => `${who(id)} ${v > 0 ? 'is owed' : 'owes'} ${money(v)}`),
      ...(transfers.length ? ['Fewest payments to settle:', ...transfers.map((t) => `${who(t.from)} pays ${who(t.to)} ${money(t.amount_minor)}`)] : ['Everyone is settled.']),
    ].join('\n'),
  }
}

export async function buildSnapshot(trip: Trip, memberId: string, topics: Topic[], database: TripDb = db): Promise<Partial<Record<Topic, string>>> {
  const { members, name } = await names(trip.id, database)
  const places = (await database.places.where('trip_id').equals(trip.id).toArray()).filter(alive)
  const placeName = (id: string | null) => places.find((p) => p.id === id)?.name
  const build: Record<Topic, () => Promise<string>> = {
    async plan() {
      const items = (await database.itinerary_items.where('trip_id').equals(trip.id).toArray()).filter((i) => alive(i) && i.status !== 'cancelled')
        .sort((a, b) => a.start_local.localeCompare(b.start_local))
      const dates = `Trip: ${trip.name}. Dates: ${trip.start_date ?? 'not set'} to ${trip.end_date ?? 'not set'}. Times are local (${trip.timezone}).`
      return `${dates}\n${section(items.map((i) => {
        const day = DateTime.fromISO(i.start_local.slice(0, 10)).toFormat('ccc yyyy-MM-dd')
        const when = i.all_day ? 'all day' : `${i.start_local.slice(11, 16)}${i.end_local ? `–${i.end_local.slice(11, 16)}` : ''}`
        const at = placeName(i.place_id)
        const going = i.attendee_ids ? ` | with ${i.attendee_ids.map(name).join(', ')}` : ''
        return `${day} ${when} | ${i.title} | ${i.kind}, ${i.status}${at ? ` | at ${at}` : ''}${going}`
      }), 'Nothing is on the plan yet.')}`
    },
    async places() {
      return section(places.filter((p) => PICKED.includes(p.status)).sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => `${p.name} | ${p.category}${p.area ? ` | ${p.area}` : ''} | ${p.status}`), 'No places have been picked yet.')
    },
    async tasks() {
      const tasks = (await database.trip_tasks.where('trip_id').equals(trip.id).toArray()).filter(alive).sort((a, b) => Number(a.completed) - Number(b.completed))
      return section(tasks.map((t) => `${t.completed ? '[done]' : '[open]'} ${t.title} | ${t.assignee_id ? `owner: ${name(t.assignee_id)}` : 'nobody yet'}${t.due_date ? ` | due ${t.due_date}` : ''}`), 'There are no shared tasks.')
    },
    async packing() {
      const checks = (await database.packing_checks.where('trip_id').equals(trip.id).toArray()).filter((c) => c.member_id === memberId)
      // Other people's personal lists are theirs.
      const items = (await database.packing_items.where('trip_id').equals(trip.id).toArray()).filter((i) => alive(i) && (i.kind !== 'personal' || i.owner_id === memberId))
      return section(items.map((i) => {
        const state = i.kind === 'everyone' ? (checks.find((c) => c.item_id === i.id)?.state ?? 'not yet') : i.packed ? 'packed' : 'not yet'
        const whose = i.kind === 'everyone' ? 'everyone brings one' : i.kind === 'personal' ? 'my own list' : `group item, ${i.owner_id ? `${name(i.owner_id)} is bringing it` : 'nobody has claimed it'}`
        return `${i.title} | ${whose} | ${i.kind === 'group' ? state : `me: ${state}`}`
      }), 'The packing list is empty.')
    },
    async votes() {
      const polls = (await database.polls.where('trip_id').equals(trip.id).toArray()).filter(alive)
      const options = (await database.poll_options.where('trip_id').equals(trip.id).toArray()).filter(alive)
      const votes = (await database.poll_votes.where('trip_id').equals(trip.id).toArray()).filter((v) => alive(v) && v.score !== null)
      return section(polls.flatMap((poll) => [
        `Vote: ${poll.title} | ${poll.status}${poll.closes_at ? ` | closes ${poll.closes_at.slice(0, 16)}Z` : ''}`,
        ...options.filter((o) => o.poll_id === poll.id).map((o) => {
          const cast = votes.filter((v) => v.option_id === o.id)
          const mine = cast.find((v) => v.member_id === memberId)
          const mean = cast.length ? (cast.reduce((sum, v) => sum + v.score!, 0) / cast.length).toFixed(1) : '–'
          return `  - ${o.label} | ${cast.length} of ${members.length} voted, average ${mean} of 3 | my vote: ${mine ? SCORE_LABEL[mine.score!] : 'none yet'}${poll.winner_option_id === o.id ? ' | winner' : ''}`
        }),
      ]), 'There are no votes.')
    },
    async people() {
      const profiles = (await database.member_preferences.where('trip_id').equals(trip.id).toArray()).filter(alive)
      return section(members.map((m) => {
        const profile = profileSchema.safeParse(profiles.find((p) => p.member_id === m.id))
        return `${m.display_name}${m.id === memberId ? ' (me)' : ''} | ${profile.success ? classify(profile.data.scores) : 'no travel style saved'}${profile.success && profile.data.constraints ? ` | must-haves and avoids: ${profile.data.constraints.slice(0, 120)}` : ''}`
      }), 'Nobody has joined yet.')
    },
    async money() { return (await moneySummary(trip, memberId, database)).everyone.slice(0, CHARS) },
  }
  const out: Partial<Record<Topic, string>> = {}
  for (const topic of new Set(topics)) out[topic] = await build[topic]()
  return out
}
