import { DateTime } from 'luxon'
import { db } from '@/data/db'
import type { ItineraryItem, Member, Trip } from '@/data/types'
import type { AssistReply } from '@/features/discovery/model'
import { saveItem } from '@/features/itinerary/data'
import { savePackingItem } from '@/features/packing/data'
import { addOption, createPoll } from '@/features/polls/data'
import { saveTask } from '@/features/tasks/data'
import { newId } from '@/lib/ids'

/** Where a chip can take someone after an answer or an addition. */
export type Link = 'plan' | 'tasks' | 'packing' | 'votes' | 'money'

/**
 * One thing Stowie offers to add to the trip. It is only ever a suggestion on a card: nothing is
 * written until the person confirms, and then it goes through the same save functions as the forms.
 */
export type Proposal =
  | { kind: 'task'; title: string; assigneeId: string | null; assignee: string | null; dueDate: string | null }
  | { kind: 'packing'; title: string; personal: boolean }
  | { kind: 'item'; title: string; date: string; time: string | null; durationMinutes: number }
  | { kind: 'vote'; title: string; options: string[] }

const isDate = (text: string | null): text is string => !!text && /^\d{4}-\d{2}-\d{2}$/.test(text) && DateTime.fromISO(text).isValid
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Checks the model's suggestion against the trip. Anything that doesn't hold up is dropped, and Stowie just answers. */
export function toProposal(reply: AssistReply, trip: Trip, members: Member[], memberId: string): Proposal | null {
  const title = reply.title?.trim()
  if (reply.action === 'none' || !title) return null
  const mine = (name: string | null) => !!name && (/^(me|my|mine|myself)$/i.test(name.trim()) || members.some((m) => m.id === memberId && same(m.display_name, name)))
  switch (reply.action) {
    case 'task': {
      const owner = mine(reply.assignee) ? members.find((m) => m.id === memberId) : members.find((m) => reply.assignee && same(m.display_name, reply.assignee))
      return { kind: 'task', title, assigneeId: owner?.id ?? null, assignee: owner?.display_name ?? null, dueDate: isDate(reply.date) ? reply.date : null }
    }
    case 'packing': return { kind: 'packing', title, personal: mine(reply.assignee) }
    case 'item': {
      if (!isDate(reply.date)) return null
      if ((trip.start_date && reply.date < trip.start_date) || (trip.end_date && reply.date > trip.end_date)) return null
      const time = reply.time && /^([01]\d|2[0-3]):[0-5]\d$/.test(reply.time.trim()) ? reply.time.trim() : null
      return { kind: 'item', title, date: reply.date, time, durationMinutes: reply.durationMinutes ?? 60 }
    }
    case 'vote': {
      const options = reply.options.map((o) => o.trim()).filter((o, i, all) => o && all.findIndex((other) => same(other, o)) === i)
      return options.length >= 2 ? { kind: 'vote', title, options } : null
    }
  }
}

const day = (date: string) => DateTime.fromISO(date).toFormat('ccc d LLL yyyy')
const endOf = (date: string, time: string, minutes: number) => DateTime.fromISO(`${date}T${time}`, { zone: 'utc' }).plus({ minutes })

/** How the card reads: what would be added, and the details. */
export function describeProposal(p: Proposal): { heading: string; title: string; details: string[] } {
  switch (p.kind) {
    case 'task': return { heading: 'Add a shared task', title: p.title, details: [p.assignee ? `For ${p.assignee}` : 'Nobody assigned yet', ...(p.dueDate ? [`Due ${day(p.dueDate)}`] : [])] }
    case 'packing': return { heading: 'Add to the packing list', title: p.title, details: [p.personal ? 'On your own list' : 'For everyone to bring'] }
    case 'item': return { heading: 'Add a tentative plan item', title: p.title, details: [day(p.date), p.time ? `${p.time}–${endOf(p.date, p.time, p.durationMinutes).toFormat('HH:mm')}` : 'All day'] }
    case 'vote': return { heading: 'Start a vote', title: p.title, details: p.options }
  }
}

/** Adds what was confirmed, exactly as the matching form would. */
export async function carryOut(p: Proposal, trip: Trip, memberId: string): Promise<{ summary: string; link: Link }> {
  switch (p.kind) {
    case 'task':
      await saveTask(trip.id, undefined, { title: p.title, assignee_id: p.assigneeId, due_date: p.dueDate, notes: null }, memberId)
      return { summary: `Added the task “${p.title}”${p.assignee ? ` for ${p.assignee}` : ''}.`, link: 'tasks' }
    case 'packing':
      await savePackingItem(trip.id, undefined, { title: p.title, kind: p.personal ? 'personal' : 'everyone', category: null, owner_id: null, quantity: null, notes: null }, memberId)
      return { summary: `“${p.title}” is on ${p.personal ? 'your' : 'the group’s'} packing list.`, link: 'packing' }
    case 'item': {
      const end = p.time ? endOf(p.date, p.time, p.durationMinutes).toFormat("yyyy-MM-dd'T'HH:mm") : null
      const item: ItineraryItem = {
        id: newId(), trip_id: trip.id, title: p.title, kind: 'activity', place_id: null, to_place_id: null, all_day: !p.time,
        start_local: `${p.date}T${p.time ?? '00:00'}`, start_tz: trip.timezone, end_local: end, end_tz: end ? trip.timezone : null, start_at: '', end_at: null,
        status: 'tentative', confirmation_code: null, attendee_ids: null, details: {}, notes: 'Added by asking Stowie.', est_cost_minor: null, est_cost_currency: null,
      }
      await saveItem(item, memberId)
      return { summary: `“${p.title}” is on the plan for ${day(p.date)}, marked tentative.`, link: 'plan' }
    }
    case 'vote': {
      const poll = await db.polls.get(await createPoll(trip.id, p.title, '', memberId))
      if (!poll) throw new Error('Could not start the vote. Try again.')
      for (const label of p.options) await addOption(poll, { label }, memberId)
      return { summary: `The vote “${p.title}” is open with ${p.options.length} options.`, link: 'votes' }
    }
  }
}
