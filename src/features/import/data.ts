import { db } from '@/data/db'
import { save } from '@/data/repo'
import type { ItineraryItem, Place } from '@/data/types'
import { stableId } from '@/lib/ids'
import { checkLocalTime, isValidZone, toInstant } from '@/lib/time'
import { importEntrySchema, safeSource, type ImportEntry } from './model'

/** Review is mandatory. Missing schedule information produces a saved place, never an invented time. */
export async function applyImport(tripId: string, memberId: string | null, timezone: string, entries: ImportEntry[]) {
  if (!entries.length || entries.length > 20) throw new Error('Choose between 1 and 20 entries.')
  const rows = entries.map((entry) => importEntrySchema.parse(entry))
  const validated = rows.map((e) => {
    const zone = e.start_tz || timezone, endZone = e.end_tz || zone
    if (!isValidZone(zone) || !isValidZone(endZone)) throw new Error(`Check the time zone for ${e.title}.`)
    const instant = (s: string, z: string) => {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) throw new Error(`Check the date and time for ${e.title}.`)
      if (checkLocalTime(s, z).kind === 'gap') throw new Error(`That time does not exist when clocks change. Check ${e.title}.`)
      const value = toInstant(s, z)
      if (!value || !Number.isFinite(Date.parse(value))) throw new Error(`Check the date and time for ${e.title}.`)
      return value
    }
    const start = e.start_local ? instant(e.start_local, zone) : null
    const end = e.end_local ? instant(e.end_local, endZone) : null
    if (end && (!start || end < start)) throw new Error(`Check the end time for ${e.title}.`)
    return { e, zone, endZone, start, end }
  })
  let added = 0, skipped = 0
  await db.transaction('rw', [db.places, db.itinerary_items, db.links, db._outbox], async () => {
    for (const { e, zone, endZone, start, end } of validated) {
      const key = JSON.stringify([e.title.toLowerCase(), e.kind, e.start_local, e.address?.toLowerCase(), e.confirmation_code])
      const placeId = stableId(tripId, 'import-place', key), itemId = stableId(tripId, 'import-item', key)
      if (await db.places.get(placeId) || await db.itinerary_items.get(itemId)) { skipped++; continue }
      const place: Place = {
        id: placeId, trip_id: tripId, name: e.title, category: e.kind === 'meal' ? 'food' : e.kind === 'free' ? 'activity' : e.kind,
        tags: [], lat: null, lng: null, address: e.address, area: null, status: start ? 'planned' : 'shortlist', notes: e.notes,
        phone: null, website: safeSource(e.source_url), opening_hours: null, external_ids: {}, source: 'import',
      }
      await save('places', place, memberId)
      if (start && e.start_local) {
        const item: ItineraryItem = {
          id: itemId, trip_id: tripId, title: e.title, kind: e.kind, place_id: placeId, to_place_id: null, all_day: false,
          start_local: e.start_local, start_tz: zone, start_at: start, end_local: e.end_local, end_tz: end ? endZone : null, end_at: end,
          status: 'tentative', confirmation_code: e.confirmation_code, attendee_ids: null, details: e.flight ? { flight_iata: e.flight } : {},
          notes: e.notes, est_cost_minor: null, est_cost_currency: null,
        }
        await save('itinerary_items', item, memberId)
      }
      const url = safeSource(e.source_url)
      if (url) await save('links', { id: stableId(tripId, 'import-link', key), trip_id: tripId, place_id: placeId, item_id: start ? itemId : null, expense_id: null, url, label: 'Import source', kind: 'info' }, memberId)
      added++
    }
  })
  return { added, skipped }
}
