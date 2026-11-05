import { DateTime } from 'luxon'
import { db, type TripDb } from '@/data/db'
import { save } from '@/data/repo'
import type { ItineraryItem, Poll, PollOption, TripTask } from '@/data/types'
import { stableId } from '@/lib/ids'
import { saveTask, type TaskFields } from '@/features/tasks/data'

export const bookingTaskId = (tripId: string, optionId: string) => stableId(tripId, 'decision-booking', optionId)
export function decisionItem(items: ItineraryItem[], poll: Poll, option: PollOption) {
  return items.find((i) => i.trip_id === poll.trip_id && !i.deleted_at && i.status !== 'cancelled' && i.details?.decision_poll_id === poll.id && i.details?.decision_option_id === option.id)
}
async function checkDecision(tripId: string, pollId: string, optionId: string, database: TripDb) {
  const poll = await database.polls.get(pollId)
  const option = await database.poll_options.get(optionId)
  if (!poll || poll.deleted_at || poll.trip_id !== tripId || poll.status !== 'closed' || poll.winner_option_id !== optionId || !option || option.deleted_at || option.poll_id !== pollId || option.trip_id !== tripId || poll.kind === 'dates') throw new Error('This decision changed. Reopen the vote to review the current choice.')
  return option
}
/** The deterministic task is shared by every phone, not recreated by repeated taps. */
export async function assignBooking(tripId: string, pollId: string, optionId: string, fields: Omit<TaskFields, 'title' | 'notes'>, me: string, database: TripDb = db) {
  return database.transaction('rw', [database.polls, database.poll_options, database.trip_tasks, database.members, database._outbox], async () => {
    const option = await checkDecision(tripId, pollId, optionId, database)
    if (!fields.assignee_id) throw new Error('Choose who will take care of the booking.')
    const id = bookingTaskId(tripId, optionId)
    const existing = await database.trip_tasks.get(id)
    if (existing?.deleted_at) throw new Error('The booking task was removed. Add a replacement from Tasks.')
    if (existing) {
      await saveTask(tripId, id, { ...fields, title: existing.title, notes: existing.notes }, me, database)
    } else {
      // saveTask intentionally creates random IDs for ordinary tasks; this shared handoff needs a stable ID.
      const member = await database.members.get(fields.assignee_id)
      if (!member || member.deleted_at || member.trip_id !== tripId) throw new Error('Choose someone who is still in this trip.')
      if (fields.due_date && (!/^\d{4}-\d{2}-\d{2}$/.test(fields.due_date) || !DateTime.fromISO(fields.due_date).isValid)) throw new Error('Choose a valid due date.')
      const row: TripTask = { id, trip_id: tripId, title: `Book ${option.label}`.slice(0, 200), ...fields, completed: false, notes: `Chosen in “${(await database.polls.get(pollId))!.title}”.\n/t/${tripId}/more/vote/${pollId}${option.url ? `\n${option.url}` : ''}` }
      await save('trip_tasks', row, me, database)
    }
    return id
  })
}

/** Confirmation is an explicit act; a winning vote or completed task is never booking evidence. */
export async function finishBooking(tripId: string, pollId: string, optionId: string, itemId: string, code: string, notRequired: boolean, me: string, database: TripDb = db) {
  await database.transaction('rw', [database.polls, database.poll_options, database.itinerary_items, database.attachments, database.trip_tasks, database._outbox], async () => {
    const option = await checkDecision(tripId, pollId, optionId, database)
    const item = await database.itinerary_items.get(itemId)
    if (!item || !decisionItem([item], { id: pollId, trip_id: tripId } as Poll, option)) throw new Error('The planned item changed or was removed. Review the plan first.')
    const tickets = await database.attachments.where('trip_id').equals(tripId).filter((a) => !a.deleted_at && a.item_id === itemId).toArray()
    const confirmation = code.trim() || item.confirmation_code
    if (!notRequired && !confirmation && !tickets.length) throw new Error('Add a confirmation code or attach a ticket first, or choose “No booking needed”.')
    await save('itinerary_items', { ...item, status: 'confirmed', confirmation_code: confirmation || null, details: { ...item.details, decision_booking: notRequired ? 'not_required' : 'confirmed' } }, me, database)
    const task = await database.trip_tasks.get(bookingTaskId(tripId, optionId))
    if (task && !task.deleted_at) await save('trip_tasks', { ...task, completed: true }, me, database)
  })
}

/** Connect an existing itinerary item explicitly, without scheduling a duplicate. */
export async function linkDecisionItem(tripId: string, pollId: string, optionId: string, itemId: string, me: string, database: TripDb = db) {
  await database.transaction('rw', [database.polls, database.poll_options, database.itinerary_items, database._outbox], async () => {
    await checkDecision(tripId, pollId, optionId, database)
    const items = await database.itinerary_items.where('trip_id').equals(tripId).toArray()
    if (items.some((i) => !i.deleted_at && i.status !== 'cancelled' && i.details?.decision_poll_id === pollId && i.details?.decision_option_id === optionId)) throw new Error('This choice is already in the plan. Refresh to see it.')
    const item = items.find((i) => i.id === itemId && !i.deleted_at && i.status !== 'cancelled')
    if (!item || item.details?.decision_poll_id) throw new Error('Choose an available item from this trip’s plan.')
    await save('itinerary_items', { ...item, details: { ...item.details, decision_poll_id: pollId, decision_option_id: optionId } }, me, database)
  })
}
