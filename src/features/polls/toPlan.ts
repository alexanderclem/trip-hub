import { DateTime } from 'luxon'
import { db, type TripDb } from '@/data/db'
import { save } from '@/data/repo'
import type { ItineraryItem, Member, PollOption, PollVote, TripTask } from '@/data/types'
import { stableId } from '@/lib/ids'
import { saveItem } from '@/features/itinerary/data'

export interface VoteSource { pollId: string; optionId: string }
export interface BookingTaskDraft { assigneeId: string; dueDate: string }
export const votePlanId = (tripId: string, source: VoteSource) => stableId(tripId, 'poll-plan', source.pollId, source.optionId)

export function suggestedAttendees(option: PollOption, votes: PollVote[], members: Member[]): string[] {
  const willing = new Set(votes.filter((v) => !v.deleted_at && v.trip_id === option.trip_id && v.poll_id === option.poll_id && v.option_id === option.id && v.score !== null && v.score > 0).map((v) => v.member_id))
  return members.filter((m) => !m.deleted_at && m.trip_id === option.trip_id && willing.has(m.id)).map((m) => m.id)
}

/** A winner, its place, and its optional booking task commit to the offline outbox together. */
export async function saveVotePlan(item: ItineraryItem, source: VoteSource, booking: BookingTaskDraft | null, me: string | null, database: TripDb = db): Promise<string> {
  return database.transaction('rw', [database.trips, database.members, database.polls, database.poll_options, database.itinerary_items, database.attachments, database.places, database.trip_tasks, database._outbox], async () => {
    const [trip, poll, option] = await Promise.all([database.trips.get(item.trip_id), database.polls.get(source.pollId), database.poll_options.get(source.optionId)])
    if (!trip || trip.deleted_at || !poll || poll.deleted_at || poll.trip_id !== item.trip_id || !option || option.deleted_at || option.trip_id !== item.trip_id || option.poll_id !== poll.id) throw new Error('This vote or option is no longer available on this trip.')
    if (poll.status !== 'closed' || poll.winner_option_id !== option.id || option.starts_on) throw new Error('The group’s choice changed. Return to the vote and review its result.')
    const id = votePlanId(item.trip_id, source)
    const existing = await database.itinerary_items.get(id)
    if (existing) {
      if (existing.deleted_at || existing.status === 'cancelled') throw new Error('This choice was already scheduled and removed or cancelled. Review it in the plan before adding another activity.')
      return existing.id
    }
    const rows = await database.itinerary_items.where('trip_id').equals(item.trip_id).toArray()
    const linked = rows.find((i) => !i.deleted_at && i.status !== 'cancelled' && i.details.vote_poll_id === poll.id && i.details.vote_option_id === option.id)
    if (linked) return linked.id
    if (option.place_id && item.place_id !== option.place_id) throw new Error('The winning place changed. Return to the vote to schedule it.')
    const members = await database.members.where('trip_id').equals(item.trip_id).filter((m) => !m.deleted_at).toArray()
    if (item.attendee_ids && (!item.attendee_ids.length || item.attendee_ids.some((id) => !members.some((member) => member.id === id)))) throw new Error('Choose at least one current traveler for this activity.')
    let task: TripTask | null = null
    if (booking) {
      if (!members.some((m) => m.id === booking.assigneeId)) throw new Error('Choose a current traveler to make the booking.')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.dueDate) || !DateTime.fromISO(booking.dueDate, { zone: trip.timezone }).isValid) throw new Error('Choose a valid booking deadline.')
      if (booking.dueDate > DateTime.fromISO(item.start_local, { zone: item.start_tz }).setZone(trip.timezone).toISODate()!) throw new Error('The booking deadline must be on or before the activity.')
      task = { id: stableId(item.trip_id, 'vote-booking', poll.id, option.id), trip_id: item.trip_id, title: `Book ${item.title}`.slice(0, 200), assignee_id: booking.assigneeId, due_date: booking.dueDate, completed: false, notes: `From vote: ${poll.title}\nItinerary: /t/${item.trip_id}/plan/${id}${option.url ? `\n${option.url}` : ''}` }
      const oldTask = await database.trip_tasks.get(task.id)
      if (oldTask) throw new Error('A booking task already exists for this choice. Review Tasks before scheduling it again.')
    }
    await saveItem({ ...item, id, details: { ...item.details, vote_poll_id: poll.id, vote_option_id: option.id, ...(task ? { booking_task_id: task.id } : {}) } }, me, undefined, database)
    if (task) await save('trip_tasks', task, me, database)
    return id
  })
}
