import { DateTime } from 'luxon'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type TripDb } from '@/data/db'
import { save, saveMany, softDelete } from '@/data/repo'
import type { ItineraryItem, Place, Trip, TripTask } from '@/data/types'
import { stableId } from '@/lib/ids'
import { isValidZone, normalizeLocal, toInstant } from '@/lib/time'
import { briefSchema, ideasSchema, profileSchema, type Draft, type Profile } from './model'

export const useProfiles = (tripId: string | undefined) => useLiveQuery(async () => tripId
  ? (await db.member_preferences.where('trip_id').equals(tripId).filter((r) => !r.deleted_at).toArray()).filter((r) => profileSchema.safeParse(r).success)
  : [], [tripId])

export const useDrafts = (scope: string) => useLiveQuery(async () =>
  (await db.ai_drafts.where('scope').equals(scope).toArray()).filter((d) => ideasSchema.safeParse(d.result).success && briefSchema.safeParse(d.brief).success).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [scope])

export async function saveProfile(tripId: string, memberId: string, profile: Profile) {
  await save('member_preferences', { id: stableId(tripId, 'preferences', memberId), trip_id: tripId, member_id: memberId, ...profileSchema.parse(profile) }, memberId)
}

function fingerprint(row: object): string {
  const entries = Object.entries(row).filter(([k]) => !k.startsWith('_') && !['created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at'].includes(k))
    .map(([k, v]) => [k, k === 'start_local' || k === 'end_local' ? (v ? normalizeLocal(String(v)) : v) : k === 'start_at' || k === 'end_at' ? (v ? DateTime.fromISO(String(v)).toMillis() : v) : v] as const)
    .sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify(Object.fromEntries(entries))
}

/** Only unchanged, unreferenced tentative items can make room for a revision. */
export async function refinementPlan(items: ItineraryItem[], draftId: string, database: TripDb = db) {
  const draft = await database.ai_drafts.get(draftId)
  if (!draft?.application || draft.application.undone) return items
  const originals = new Map(draft.application.rows.filter((r) => r.table === 'itinerary_items').map((r) => [r.id, r.fingerprint]))
  const keep = await Promise.all(items.map(async (item) => {
    if (item.status !== 'tentative' || originals.get(item.id) !== fingerprint(item)) return true
    const refs = await Promise.all([
      database.attachments.where('item_id').equals(item.id).filter((r) => !r.deleted_at).count(),
      database.expenses.where('item_id').equals(item.id).filter((r) => !r.deleted_at).count(),
      database.links.where('trip_id').equals(item.trip_id).filter((r) => !r.deleted_at && r.item_id === item.id).count(),
    ])
    return refs.some(Boolean)
  }))
  return items.filter((_, i) => keep[i])
}

/** Apply atomically through the normal outbox, preserving every existing plan row. */
export async function applyIdea(draftId: string, ideaIndex: number, trip: Trip, memberId: string, startDate: string, database: TripDb = db) {
  return database.transaction('rw', [database.ai_drafts, database.places, database.itinerary_items, database.trip_tasks, database._outbox, database.links, database.attachments, database.expenses, database.poll_options, database.place_ratings], async () => {
    const draft = await database.ai_drafts.get(draftId)
    if (!draft) throw new Error('This draft is no longer on this device. Generate another.')
    if (draft.application) throw new Error('This draft has already been used. Generate a new version to add more ideas.')
    const idea = ideasSchema.parse(draft.result).ideas[ideaIndex]
    if (!idea) throw new Error('Choose a trip idea first.')
    if (!isValidZone(trip.timezone)) throw new Error('Set a valid destination time zone in trip settings.')
    const start = DateTime.fromISO(startDate, { zone: trip.timezone })
    if (!start.isValid) throw new Error('Choose a start date before adding this draft.')
    const endDate = start.plus({ days: idea.days.length - 1 }).toISODate()!
    if ((trip.start_date && startDate < trip.start_date) || (trip.end_date && endDate > trip.end_date)) throw new Error('The draft falls outside this trip’s dates. Adjust the start date or generate a shorter draft.')
    if (draft.replacesDraftId) {
      const previous = await database.ai_drafts.get(draft.replacesDraftId)
      if (!previous?.application || previous.application.tripId !== trip.id || previous.application.undone) throw new Error('The previous draft has changed or was undone. Generate a fresh revision.')
      await undoIdea(previous.id, memberId, database)
    }
    const existing = await database.itinerary_items.where('trip_id').equals(trip.id).filter((r) => !r.deleted_at && r.status !== 'cancelled').toArray()
    const places: Place[] = [], items: ItineraryItem[] = []
    const createdPlaces = new Map<string, string>()
    for (const [dayIndex, day] of idea.days.entries()) {
      const date = start.plus({ days: dayIndex }).toISODate()!
      for (const [activityIndex, activity] of day.activities.entries()) {
        const local = `${date}T${activity.time}`
        const endLocal = DateTime.fromISO(local, { zone: 'utc' }).plus({ minutes: activity.durationMinutes }).toFormat("yyyy-MM-dd'T'HH:mm")
        const startAt = toInstant(local, trip.timezone), endAt = toInstant(endLocal, trip.timezone)
        if (Date.parse(endAt) <= Date.parse(startAt)) throw new Error('A draft time crosses a daylight-saving change. Adjust the draft before adding it.')
        if (existing.some((r) => Date.parse(r.start_at) < Date.parse(endAt) && Date.parse(r.end_at ?? r.start_at) >= Date.parse(startAt)) || items.some((r) => Date.parse(r.start_at) < Date.parse(endAt) && Date.parse(r.end_at!) > Date.parse(startAt))) {
          throw new Error(`“${activity.title}” overlaps another plan item. Refine the draft to use free time; existing plans are preserved.`)
        }
        let placeId: string | null = null
        if (activity.existingPlaceId) {
          const known = await database.places.get(activity.existingPlaceId)
          if (known && known.trip_id === trip.id && !known.deleted_at) placeId = known.id
        }
        if (!placeId && activity.placeName) {
          const key = activity.placeName.trim().toLocaleLowerCase()
          placeId = createdPlaces.get(key) ?? stableId(trip.id, 'ai-place', draft.id, String(ideaIndex), key)
          if (!createdPlaces.has(key)) {
            const known = await database.places.where('trip_id').equals(trip.id).filter((p) => !p.deleted_at && p.name.trim().toLocaleLowerCase() === key).first()
            if (known) placeId = known.id
            else places.push({ id: placeId, trip_id: trip.id, name: activity.placeName, category: activity.kind === 'meal' ? 'food' : activity.kind === 'free' ? 'other' : activity.kind, tags: ['ai-suggested'], lat: null, lng: null, address: null, area: idea.destination, status: 'planned', notes: 'AI suggestion. Verify the place and add its location before relying on the map.', phone: null, website: null, opening_hours: null, external_ids: {}, source: 'suggestion' })
            createdPlaces.set(key, placeId)
          }
        }
        items.push({ id: stableId(trip.id, 'ai-item', draft.id, String(ideaIndex), String(dayIndex), String(activityIndex)), trip_id: trip.id,
          title: activity.title, kind: activity.kind, place_id: placeId, to_place_id: null, all_day: false,
          start_local: local, start_tz: trip.timezone, end_local: endLocal, end_tz: trip.timezone, start_at: startAt, end_at: endAt,
          status: 'tentative', confirmation_code: null, attendee_ids: null, details: { ai_draft_id: draft.id },
          notes: `${day.title}\n${activity.notes}\nAI draft; costs and availability need checking.`, est_cost_minor: activity.costMinor, est_cost_currency: activity.costMinor === null ? null : idea.currency,
        })
      }
    }
    const tasks: TripTask[] = idea.tasks.map((title, i) => ({ id: stableId(trip.id, 'ai-task', draft.id, String(ideaIndex), String(i)), trip_id: trip.id, title, assignee_id: null, due_date: null, completed: false, notes: 'Added from an AI trip draft. Verify before booking.' }))
    const promoted: Place[] = []
    for (const placeId of new Set(items.map((i) => i.place_id).filter((id): id is string => !!id))) {
      const known = await database.places.get(placeId)
      if (known && !known.deleted_at && (known.status === 'catalog' || known.status === 'shortlist')) promoted.push({ ...known, status: 'planned' })
    }
    await saveMany('places', [...places, ...promoted], memberId, database)
    await saveMany('itinerary_items', items, memberId, database)
    await saveMany('trip_tasks', tasks, memberId, database)
    const rows: NonNullable<Draft['application']>['rows'] = []
    for (const [table, records] of [['places', places], ['itinerary_items', items], ['trip_tasks', tasks]] as const) {
      for (const row of records) rows.push({ table, id: row.id, fingerprint: fingerprint(row) })
    }
    await database.ai_drafts.update(draft.id, { scope: trip.id, application: { tripId: trip.id, ideaIndex, undone: false, rows } })
    return items.length
  })
}

/** Undo only generated rows that nobody has changed, and never remove referenced places. */
export async function undoIdea(draftId: string, memberId: string, database: TripDb = db) {
  return database.transaction('rw', [database.ai_drafts, database.places, database.itinerary_items, database.trip_tasks, database._outbox, database.links, database.attachments, database.expenses, database.poll_options, database.place_ratings], async () => {
    const draft = await database.ai_drafts.get(draftId)
    if (!draft?.application || draft.application.undone) return { removed: 0, kept: 0 }
    let removed = 0, kept = 0
    const ordered = [...draft.application.rows].sort((a, b) => Number(a.table === 'places') - Number(b.table === 'places'))
    for (const saved of ordered) {
      const row = await database.table(saved.table).get(saved.id) as { deleted_at?: string; trip_id: string } | undefined
      if (!row || row.deleted_at) continue
      if (fingerprint(row) !== saved.fingerprint) { kept++; continue }
      const refs = await Promise.all([
        database.attachments.where('item_id').equals(saved.id).filter((r) => !r.deleted_at).count(),
        database.expenses.where('item_id').equals(saved.id).filter((r) => !r.deleted_at).count(),
        database.links.where('trip_id').equals(row.trip_id).filter((r) => !r.deleted_at && (r.item_id === saved.id || r.place_id === saved.id)).count(),
      ])
      if (saved.table === 'places') {
        refs.push(await database.itinerary_items.where('trip_id').equals(row.trip_id).filter((r) => !r.deleted_at && (r.place_id === saved.id || r.to_place_id === saved.id)).count())
        refs.push(await database.attachments.where('trip_id').equals(row.trip_id).filter((r) => !r.deleted_at && r.place_id === saved.id).count())
        refs.push(await database.expenses.where('place_id').equals(saved.id).filter((r) => !r.deleted_at).count())
        refs.push(await database.poll_options.where('place_id').equals(saved.id).filter((r) => !r.deleted_at).count())
        refs.push(await database.place_ratings.where('place_id').equals(saved.id).filter((r) => !r.deleted_at).count())
      }
      if (refs.some(Boolean)) { kept++; continue }
      await softDelete(saved.table, saved.id, memberId, database)
      removed++
    }
    await database.ai_drafts.update(draftId, { application: { ...draft.application, undone: true } })
    return { removed, kept }
  })
}
