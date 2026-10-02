// Turns plan items into calendar events and hands the .ics file to the phone. Everything here
// works offline: the file is built from rows already on the device.

import type { ItineraryItem, Member, Place } from '@/data/types'
import { buildIcs, type IcsEvent } from '@/lib/ics'
import { KIND_STYLE } from './kinds'

/** Items a person is part of: everyone-items plus ones that name them. Cancelled ones are left out. */
export function itemsFor(items: ItineraryItem[], memberId: string | null): ItineraryItem[] {
  return items.filter((i) => !i.deleted_at && i.status !== 'cancelled' && (!memberId || !i.attendee_ids || i.attendee_ids.includes(memberId)))
}

export function itemEvent(item: ItineraryItem, places: Place[], members: Member[], origin: string): IcsEvent {
  const placeOf = (id: string | null) => (id ? places.find((p) => p.id === id && !p.deleted_at) : undefined)
  const from = placeOf(item.place_id)
  const to = placeOf(item.to_place_id)
  const label = (p: Place) => [p.name, p.address ?? p.area].filter(Boolean).join(', ')
  // The calendar's map pin should be where you need to be at the start.
  const pin = from ?? to
  const going = item.attendee_ids ? members.filter((m) => item.attendee_ids!.includes(m.id)).map((m) => m.display_name).join(', ') : null
  const description = [
    KIND_STYLE[item.kind].label,
    item.confirmation_code && `Confirmation: ${item.confirmation_code}`,
    going && `Going: ${going}`,
    item.notes,
  ].filter(Boolean).join('\n')
  // Stays and all-day items are dates on the calendar, not a block covering every hour.
  const asDates = item.all_day || item.kind === 'lodging'
  return {
    uid: `${item.id}@stowaway`,
    title: item.title,
    allDay: asDates,
    start: asDates ? item.start_local.slice(0, 10) : item.start_at,
    end: asDates ? (item.end_local?.slice(0, 10) ?? null) : item.end_at,
    location: from && to ? `${label(from)} → ${label(to)}` : pin ? label(pin) : null,
    geo: pin?.lat != null && pin.lng != null ? { lat: pin.lat, lng: pin.lng } : null,
    description,
    url: `${origin}/t/${item.trip_id}/plan/${item.id}`,
    tentative: item.status !== 'confirmed',
    updatedAt: item.updated_at ?? null,
  }
}

export function planIcs(items: ItineraryItem[], places: Place[], members: Member[], calendarName: string, origin: string, now = new Date().toISOString()): string {
  return buildIcs(items.map((i) => itemEvent(i, places, members, origin)), calendarName, now)
}

const fileName = (name: string) => `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trip'}.ics`

/**
 * Opens the phone's share sheet with the calendar file (on an iPhone that offers "Add to
 * Calendar"); where files can't be shared, downloads it instead.
 */
export async function shareCalendar(name: string, ics: string): Promise<void> {
  const file = new File([ics], fileName(name), { type: 'text/calendar' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // the person closed the sheet
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
