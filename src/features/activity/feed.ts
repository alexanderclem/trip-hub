// "What's new" on a trip, worked out on the phone from rows it already has: who added what, and
// when. There is no activity table. Pure, so it is unit-tested; the live query is in data.ts.
// Things that happen to a row after it was made (a task completed, a plan item confirmed, a
// rating) are timed by the row's last edit, so a later edit moves the entry up.

import type { Attachment, Comment, ExpenseRow, ItineraryItem, Member, Place, PlaceRating, Poll, PollOption, SettlementRow, TripTask } from '@/data/types'
import { formatMoney } from '@/lib/money'

export type ActivityKind =
  | 'joined' | 'vote' | 'option' | 'decided' | 'place' | 'rated' | 'item' | 'item-status' | 'expense' | 'settled' | 'task' | 'task-done' | 'ticket' | 'comment'

/** What the feed can be narrowed to. Someone joining belongs to none of them. */
export const GROUPS = ['votes', 'plan', 'places', 'money', 'tasks', 'tickets', 'comments'] as const
export type ActivityGroup = (typeof GROUPS)[number]
const GROUP_OF: Record<ActivityKind, ActivityGroup | null> = {
  joined: null, vote: 'votes', option: 'votes', decided: 'votes', place: 'places', rated: 'places', item: 'plan', 'item-status': 'plan',
  expense: 'money', settled: 'money', task: 'tasks', 'task-done': 'tasks', ticket: 'tickets', comment: 'comments',
}
export const groupOf = (kind: ActivityKind): ActivityGroup | null => GROUP_OF[kind]

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  /** When it happened (ISO). */
  at: string
  /** The member who did it, when known. */
  by: string | null
  /** What happened, written to follow the person's name: "started a vote: Where do we stay?". */
  text: string
  /** Where tapping it goes, under `/t/<trip>/`. */
  to: string
}

export interface FeedRows {
  members: Member[]
  polls: Poll[]
  options: PollOption[]
  places: Place[]
  items: ItineraryItem[]
  expenses: ExpenseRow[]
  settlements: SettlementRow[]
  ratings: PlaceRating[]
  tasks: TripTask[]
  attachments: Attachment[]
  comments: Comment[]
}

const live = <T extends { deleted_at?: string | null; created_at?: string }>(rows: T[]) => rows.filter((r) => !r.deleted_at && !!r.created_at)
/** Edited a while after it was made, as opposed to being saved that way in the first place. */
const LATER_MS = 10 * 60_000
const changedLater = (row: { created_at?: string; updated_at?: string }) => !!row.updated_at && Date.parse(row.updated_at) - Date.parse(row.created_at!) >= LATER_MS
const clip = (text: string, max = 80) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

/** Newest first. Individual votes are left out: they are private-ish and would drown the rest. */
export function buildFeed(rows: FeedRows, limit = 50): ActivityEvent[] {
  const events: ActivityEvent[] = []
  const add = (kind: ActivityKind, row: { id: string; created_at?: string; created_by?: string | null }, text: string, to: string, over: Partial<ActivityEvent> = {}) =>
    events.push({ id: `${kind}:${row.id}`, kind, at: row.created_at!, by: row.created_by ?? null, text, to, ...over })

  const polls = new Map(rows.polls.map((p) => [p.id, p]))
  const places = new Map(rows.places.map((p) => [p.id, p]))
  const items = new Map(rows.items.map((i) => [i.id, i]))
  const members = new Map(rows.members.map((m) => [m.id, m]))

  for (const m of live(rows.members)) add('joined', m, 'joined the trip', 'overview', { by: m.id })
  for (const p of live(rows.polls)) {
    add('vote', p, `started a vote: ${p.title}`, `more/vote/${p.id}`)
    if (p.status === 'closed' && p.updated_at) {
      const winner = rows.options.find((o) => o.id === p.winner_option_id && !o.deleted_at)
      // Whoever closed it, or the phone that noticed the deadline, isn't the news; the result is.
      add('decided', p, winner ? `Decided: ${winner.label} (${p.title})` : `Voting ended: ${p.title}`, `more/vote/${p.id}`, { at: p.updated_at, by: null })
    }
  }
  for (const o of live(rows.options)) {
    const poll = polls.get(o.poll_id)
    // Options added along with the vote itself are covered by "started a vote".
    if (!poll || poll.deleted_at || (o.created_by === poll.created_by && Date.parse(o.created_at!) - Date.parse(poll.created_at ?? o.created_at!) < 10 * 60_000)) continue
    add('option', o, `added “${o.label}” to the vote: ${poll.title}`, `more/vote/${poll.id}`)
  }
  // The imported idea pool isn't something a person did.
  for (const p of live(rows.places)) if (p.source === 'manual' || p.source === 'suggestion') add('place', p, `added a place: ${p.name}`, `more/places/${p.id}`)
  // Ratings are switched on and off on one row per person, so a withdrawn one is stars: null.
  for (const r of live(rows.ratings)) {
    const place = places.get(r.place_id)
    if (r.stars === null || !place || place.deleted_at) continue
    add('rated', r, `rated ${place.name}: ${r.stars} ★`, `more/places/${place.id}`, { at: r.updated_at ?? r.created_at!, by: r.member_id })
  }
  for (const i of live(rows.items)) {
    add('item', i, `added to the plan: ${i.title}`, `plan/${i.id}`)
    if ((i.status === 'confirmed' || i.status === 'cancelled') && changedLater(i)) add('item-status', i, `${i.status}: ${i.title}`, `plan/${i.id}`, { at: i.updated_at!, by: i.updated_by ?? null })
  }
  for (const e of live(rows.expenses)) add('expense', e, `logged ${formatMoney(e.amount_minor, e.currency)} for ${e.description}`, `money/${e.id}`)
  for (const s of live(rows.settlements)) {
    add('settled', s, `paid ${members.get(s.to_member_id)?.display_name ?? 'someone'} ${formatMoney(s.amount_minor, s.currency)}`, 'money', { by: s.from_member_id })
  }
  for (const t of live(rows.tasks)) {
    add('task', t, `added a task: ${t.title}`, `more/tasks/${t.id}`)
    if (t.completed && t.updated_at && t.updated_at > t.created_at!) add('task-done', t, `completed a task: ${t.title}`, `more/tasks/${t.id}`, { at: t.updated_at, by: t.updated_by ?? null })
  }
  for (const a of live(rows.attachments)) add('ticket', a, `added a ticket: ${a.title}`, `tickets/${a.id}`)
  for (const c of live(rows.comments)) {
    const [subject, to] =
      c.subject_type === 'poll' ? [polls.get(c.subject_id)?.title, `more/vote/${c.subject_id}`]
      : c.subject_type === 'place' ? [places.get(c.subject_id)?.name, `more/places/${c.subject_id}`]
      : [items.get(c.subject_id)?.title, `plan/${c.subject_id}`]
    if (subject === undefined) continue // its subject isn't on this phone (yet), so there is nowhere to go
    add('comment', c, `on ${subject}: “${clip(c.body)}”`, to!, { by: c.member_id })
  }

  return events.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id)).slice(0, limit)
}

/** News to this person: after they last looked, and not their own doing. */
export const isNew = (e: ActivityEvent, since: string | null, me: string | null) => !!since && e.at > since && (e.by === null || e.by !== me)

export const unseenCount = (events: ActivityEvent[], since: string | null, me: string | null) => events.filter((e) => isNew(e, since, me)).length
