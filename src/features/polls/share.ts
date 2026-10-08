// What goes into the group chat when someone shares a vote. Pure, so it is unit-tested; the
// buttons are in SharePoll.tsx.

import { DateTime } from 'luxon'
import type { Poll, PollOption } from '@/data/types'
import { votingEnded } from './rank'

/** "Fri 6:00 PM", or "today 6:00 PM" / "tomorrow 6:00 PM" when it is that close. */
export function closesLabel(closesAt: string, now: number, zone: string): string {
  const at = DateTime.fromISO(closesAt, { zone: 'utc' }).setZone(zone)
  const today = DateTime.fromMillis(now, { zone }).startOf('day')
  const days = at.startOf('day').diff(today, 'days').days
  const day = days === 0 ? 'today' : days === 1 ? 'tomorrow' : days > 1 && days < 7 ? at.toFormat('ccc') : at.toFormat('ccc, LLL d')
  return `${day} ${at.toFormat('h:mm a')}`
}

/** One line for the chat; the link is sent alongside it. */
export function shareText(poll: Poll, options: PollOption[], now: number, zone: string): string {
  const live = options.filter((o) => !o.deleted_at)
  if (votingEnded(poll, now)) {
    const winner = live.find((o) => o.id === poll.winner_option_id)
    return winner ? `Decided: ${winner.label} (${poll.title})` : `Voting has ended: ${poll.title}`
  }
  const parts = [`Vote: “${poll.title}”`]
  if (live.length) parts.push(`${live.length} ${live.length === 1 ? 'option' : 'options'}`)
  if (poll.closes_at) parts.push(`closes ${closesLabel(poll.closes_at, now, zone)}`)
  return parts.join(' · ')
}
