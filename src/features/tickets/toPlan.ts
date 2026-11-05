import { DateTime } from 'luxon'
import type { Attachment, ItemKind, Trip } from '@/data/types'
import { isValidZone } from '@/lib/time'

const date = (value?: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) && DateTime.fromISO(value).isValid ? value : ''
const time = (value?: string | null) => value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : ''

/** Unknown times stay empty. The normal itinerary form is the review step. */
export function ticketPlanDraft(att: Attachment, trip: Trip) {
  const details = att.details
  const startDate = date(details?.start_date) || date(details?.date) || trip.start_date || ''
  const startTz = details?.start_timezone && isValidZone(details.start_timezone) ? details.start_timezone : trip.timezone
  const endTz = details?.end_timezone && isValidZone(details.end_timezone) ? details.end_timezone : startTz
  const kind: ItemKind = details?.item_kind ?? (details?.flight ? 'flight' : att.kind === 'reservation' ? 'reservation' : 'activity')
  return {
    title: details?.flight ? [details.merchant, details.flight].filter(Boolean).join(' ') : details?.title || att.title,
    kind, startDate, startTime: time(details?.start_time), endDate: date(details?.end_date) || startDate,
    endTime: time(details?.end_time), startTz, endTz, code: att.confirmation_code || details?.confirmation_code || '', notes: details?.notes || '',
  }
}
