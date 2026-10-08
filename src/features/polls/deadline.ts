// Deadlines and date options for votes. Pure; every function takes the zone it works in.

import { DateTime } from 'luxon'

export const DEADLINE_CHOICES = ['none', 'tonight', 'day', 'three', 'custom'] as const
export type DeadlineChoice = (typeof DEADLINE_CHOICES)[number]

/** "Tonight" means 9 pm, and stops being offered once that is under an hour away. */
const TONIGHT_HOUR = 21

export function tonightAvailable(now: number, zone: string): boolean {
  const at = DateTime.fromMillis(now, { zone })
  return at.set({ hour: TONIGHT_HOUR, minute: 0, second: 0, millisecond: 0 }).diff(at, 'minutes').minutes >= 60
}

/**
 * The instant voting closes (UTC ISO), or null for no deadline. `custom` is a wall-clock
 * "2027-01-05T18:00" in `zone`; a time that is missing, invalid or not in the future gives undefined.
 */
export function deadlineFor(choice: DeadlineChoice, now: number, zone: string, custom = ''): string | null | undefined {
  const at = DateTime.fromMillis(now, { zone })
  switch (choice) {
    case 'none': return null
    case 'tonight': return at.set({ hour: TONIGHT_HOUR, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO()
    case 'day': return at.plus({ hours: 24 }).toUTC().toISO()
    case 'three': return at.plus({ days: 3 }).toUTC().toISO()
    case 'custom': {
      const picked = DateTime.fromISO(custom, { zone })
      return picked.isValid && picked.toMillis() > now ? picked.toUTC().toISO() : undefined
    }
  }
}

/** "Mar 13", "Mar 13 – 20", "Mar 28 – Apr 3", with the year only when the two ends differ in it. */
export function dateRangeLabel(startsOn: string, endsOn: string | null | undefined): string {
  const a = DateTime.fromISO(startsOn)
  const b = endsOn && endsOn !== startsOn ? DateTime.fromISO(endsOn) : null
  if (!b) return a.toFormat('ccc, LLL d')
  if (a.year !== b.year) return `${a.toFormat('LLL d, yyyy')} – ${b.toFormat('LLL d, yyyy')}`
  return `${a.toFormat('LLL d')} – ${b.toFormat(a.month === b.month ? 'd' : 'LLL d')}`
}
