import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TripDb } from '@/data/db'
import { save } from '@/data/repo'
import type { Trip } from '@/data/types'
import { applyIdea, refinementPlan, undoIdea } from './data'
import { NEUTRAL, type Draft } from './model'

const trip: Trip = { id: '00000000-0000-4000-8000-000000000001', name: 'Test', timezone: 'America/Los_Angeles', start_date: '2027-03-14', end_date: '2027-03-20', base_currency: 'USD', local_currency: null, route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'test', settings: {} }
const member = '00000000-0000-4000-8000-000000000002'
const draft: Draft = { id: '00000000-0000-4000-8000-000000000003', scope: trip.id, createdAt: '2026-10-02T12:00:00Z', brief: { prompt: 'Food and nature', destination: 'California', days: 1, startDate: trip.start_date, budgetMinor: null, currency: 'USD' }, result: { ideas: [{ title: 'A slow day', destination: 'California', timezone: trip.timezone, currency: 'USD', summary: 'A market and a walk', why: 'Local food and downtime', tradeoffs: '', scores: { ...NEUTRAL }, estimatedCostMinor: 5000, days: [{ title: 'Market morning', activities: [{ title: 'Visit the market', kind: 'meal', time: '10:00', durationMinutes: 60, placeName: 'Local market', existingPlaceId: null, notes: 'Check opening hours', costMinor: 1500 }] }], tasks: ['Check market hours'] }] } }
let database: TripDb
beforeEach(async () => { database = new TripDb(`discovery-test-${crypto.randomUUID()}`); await database.ai_drafts.add(structuredClone(draft)) })
afterEach(async () => { await database.delete() })

describe('applying AI trip drafts offline', () => {
  it('writes tentative items, suggested places and tasks with their outbox atomically', async () => {
    expect(await applyIdea(draft.id, 0, trip, member, '2027-03-14', database)).toBe(1)
    const item = (await database.itinerary_items.toArray())[0]!
    expect(item.status).toBe('tentative')
    expect(item.confirmation_code).toBeNull()
    expect(item.start_at).toBe('2027-03-14T17:00:00.000Z')
    expect((await database.places.toArray())[0]?.source).toBe('suggestion')
    expect((await database.places.toArray())[0]?.lat).toBeNull()
    expect(await database._outbox.count()).toBe(3)
    await expect(applyIdea(draft.id, 0, trip, member, '2027-03-14', database)).rejects.toThrow('already been used')
    expect(await database.itinerary_items.count()).toBe(1)
  })
  it('rolls back everything when dates are outside the trip', async () => {
    await expect(applyIdea(draft.id, 0, trip, member, '2027-03-21', database)).rejects.toThrow('outside')
    expect(await database._outbox.count()).toBe(0)
    expect((await database.ai_drafts.get(draft.id))?.application).toBeUndefined()
  })
  it('preserves existing plans and rolls back overlapping additions', async () => {
    await applyIdea(draft.id, 0, trip, member, '2027-03-14', database)
    const other = { ...structuredClone(draft), id: crypto.randomUUID() }
    await database.ai_drafts.add(other)
    await expect(applyIdea(other.id, 0, trip, member, '2027-03-14', database)).rejects.toThrow('overlaps')
    expect(await database.itinerary_items.count()).toBe(1)
    expect(await database._outbox.count()).toBe(3)
  })
  it('undo removes unedited generated rows even after timestamps are normalized by sync', async () => {
    await applyIdea(draft.id, 0, trip, member, '2027-03-14', database)
    const item = (await database.itinerary_items.toArray())[0]!
    await database.itinerary_items.update(item.id, { start_local: item.start_local + ':00', deleted_at: null, updated_at: '2027-01-01T00:00:00Z', _dirty: 0 })
    expect(await undoIdea(draft.id, member, database)).toEqual({ removed: 3, kept: 0 })
    expect((await database.itinerary_items.get(item.id))?.deleted_at).toBeTruthy()
    expect(await undoIdea(draft.id, member, database)).toEqual({ removed: 0, kept: 0 })
  })
  it('undo preserves edits and the places those edited items reference', async () => {
    await applyIdea(draft.id, 0, trip, member, '2027-03-14', database)
    const item = (await database.itinerary_items.toArray())[0]!
    await save('itinerary_items', { ...item, title: 'Our booked lunch', status: 'confirmed' }, member, database)
    expect(await undoIdea(draft.id, member, database)).toEqual({ removed: 1, kept: 2 })
    expect((await database.itinerary_items.get(item.id))?.deleted_at).toBeFalsy()
    expect((await database.places.get(item.place_id!))?.deleted_at).toBeFalsy()
  })
  it('does not link an AI-provided place ID from another trip', async () => {
    const foreign = crypto.randomUUID()
    await database.places.add({ id: foreign, trip_id: crypto.randomUUID(), name: 'Foreign', category: 'food', tags: [], lat: 1, lng: 2, address: null, area: null, status: 'planned', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' })
    const changed = structuredClone(draft)
    changed.result.ideas[0]!.days[0]!.activities[0]!.existingPlaceId = foreign
    await database.ai_drafts.put(changed)
    await applyIdea(draft.id, 0, trip, member, '2027-03-14', database)
    expect((await database.itinerary_items.toArray())[0]?.place_id).not.toBe(foreign)
  })
  it('replaces an applied draft atomically and protects booked items during refinement', async () => {
    await applyIdea(draft.id, 0, trip, member, '2027-03-14', database)
    const old = (await database.itinerary_items.toArray())[0]!
    expect(await refinementPlan([old], draft.id, database)).toEqual([])
    const revision = { ...structuredClone(draft), id: crypto.randomUUID(), replacesDraftId: draft.id }
    revision.result.ideas[0]!.days[0]!.activities[0]!.title = 'A revised market morning'
    await database.ai_drafts.add(revision)
    await applyIdea(revision.id, 0, trip, member, '2027-03-14', database)
    expect((await database.itinerary_items.get(old.id))?.deleted_at).toBeTruthy()
    expect((await database.ai_drafts.get(draft.id))?.application?.undone).toBe(true)
    const active = await database.itinerary_items.filter((r) => !r.deleted_at).toArray()
    expect(active).toHaveLength(1)
    expect(active[0]?.title).toBe('A revised market morning')
    const booked = { ...active[0]!, status: 'confirmed' as const }
    await save('itinerary_items', booked, member, database)
    expect(await refinementPlan([booked], revision.id, database)).toEqual([booked])
    const conflicting = { ...structuredClone(draft), id: crypto.randomUUID(), replacesDraftId: revision.id }
    await database.ai_drafts.add(conflicting)
    await expect(applyIdea(conflicting.id, 0, trip, member, '2027-03-14', database)).rejects.toThrow('overlaps')
    expect((await database.ai_drafts.get(revision.id))?.application?.undone).toBe(false)
    expect((await database.itinerary_items.get(booked.id))?.deleted_at).toBeFalsy()
  })
})
