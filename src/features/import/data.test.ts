import 'fake-indexeddb/auto'
import { beforeEach, afterAll, expect, it } from 'vitest'
import { db } from '@/data/db'
import { setWriteGuard } from '@/data/repo'
import { applyImport } from './data'
import type { ImportEntry } from './model'

const entry = (over: Partial<ImportEntry> = {}): ImportEntry => ({ title: 'Flight UA123', kind: 'flight', start_local: '2027-03-15T09:00', end_local: '2027-03-15T13:00', start_tz: 'America/Guatemala', end_tz: 'America/New_York', address: null, confirmation_code: 'ABC123', flight: 'UA123', notes: 'One checked bag', source_url: 'https://example.com/reservation', ...over })
beforeEach(async () => { setWriteGuard(null); await db.delete(); await db.open() })
afterAll(async () => { setWriteGuard(null); await db.delete() })

it('imports reviewed plans atomically offline and queues every row without duplicating a retry', async () => {
  expect(await applyImport('00000000-0000-4000-8000-000000000201', 'me', 'UTC', [entry()])).toEqual({ added: 1, skipped: 0 })
  const item = (await db.itinerary_items.toArray())[0]!
  expect(item.start_at).toBe('2027-03-15T15:00:00.000Z')
  expect(item.end_at).toBe('2027-03-15T17:00:00.000Z')
  expect(item.status).toBe('tentative')
  expect(item.confirmation_code).toBe('ABC123')
  expect(await db._outbox.count()).toBe(3)
  expect(await applyImport('00000000-0000-4000-8000-000000000201', 'me', 'UTC', [entry()])).toEqual({ added: 0, skipped: 1 })
  expect(await db._outbox.count()).toBe(3)
})
it('saves undated places without inventing a schedule or accepting unsafe links', async () => {
  await applyImport('00000000-0000-4000-8000-000000000201', 'me', 'UTC', [entry({ start_local: null, end_local: null, source_url: 'javascript:alert(1)' })])
  expect(await db.itinerary_items.count()).toBe(0)
  expect(await db.links.count()).toBe(0)
  expect((await db.places.toArray())[0]).toMatchObject({ lat: null, lng: null, status: 'shortlist', website: null })
})
it('does not partly save a batch with an invalid date, zone, DST gap or reversed end', async () => {
  for (const over of [{ start_local: '2027-02-30T10:00' }, { start_tz: 'invented' }, { start_local: '2027-03-14T02:30', start_tz: 'America/New_York' }, { end_local: '2027-03-14T09:00' }]) {
    await expect(applyImport('00000000-0000-4000-8000-000000000201', 'me', 'UTC', [entry({ title: 'Good' }), entry(over)])).rejects.toThrow()
    expect(await db.places.count()).toBe(0)
    expect(await db._outbox.count()).toBe(0)
  }
})
it('rolls back all rows when permissions refuse an itinerary write', async () => {
  setWriteGuard((table) => table === 'itinerary_items' ? 'Read only' : null)
  await expect(applyImport('00000000-0000-4000-8000-000000000201', 'me', 'UTC', [entry()])).rejects.toThrow('Read only')
  expect(await db.places.count()).toBe(0)
  expect(await db._outbox.count()).toBe(0)
})
it('never resurrects a removed import', async () => {
  await applyImport('00000000-0000-4000-8000-000000000201', 'me', 'UTC', [entry()])
  const p = (await db.places.toArray())[0]!
  await db.places.update(p.id, { deleted_at: new Date().toISOString() })
  expect(await applyImport('00000000-0000-4000-8000-000000000201', 'me', 'UTC', [entry()])).toEqual({ added: 0, skipped: 1 })
})
