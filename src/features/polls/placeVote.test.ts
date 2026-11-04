import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { db } from '@/data/db'
import { setWriteGuard } from '@/data/repo'
import type { Place } from '@/data/types'
import { createPlacePoll } from './data'

const place: Place = { id: 'place', trip_id: '00000000-0000-4000-8000-000000000991', name: 'Lunch in Alfama', category: 'food', tags: [], lat: null, lng: null, address: null, area: 'Lisbon', status: 'shortlist', notes: 'Maya says to book the terrace.', phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' }

beforeEach(async () => { await db.open() })
afterEach(async () => { setWriteGuard(null); await db.delete() })

it('saves a place vote with its original place and notes, queuing the poll before its option', async () => {
  const id = await createPlacePoll(place, ' Where should we eat? ', 'alex')
  expect(await db.polls.get(id)).toMatchObject({ title: 'Where should we eat?', status: 'open', created_by: 'alex' })
  const options = await db.poll_options.toArray()
  expect(options).toHaveLength(1)
  expect(options[0]).toMatchObject({ poll_id: id, place_id: place.id, label: place.name, description: place.notes })
  expect((await db._outbox.orderBy('seq').toArray()).map((entry) => entry.table)).toEqual(['polls', 'poll_options'])
})

it('rolls back the poll and both queued changes if its first option cannot save', async () => {
  setWriteGuard((table) => table === 'poll_options' ? 'Could not save the option.' : null)
  await expect(createPlacePoll(place, 'Lunch?', 'alex')).rejects.toThrow('Could not save the option.')
  expect(await db.polls.count()).toBe(0)
  expect(await db.poll_options.count()).toBe(0)
  expect(await db._outbox.count()).toBe(0)
})

it('rejects a blank vote without leaving an empty poll', async () => {
  await expect(createPlacePoll(place, '  ', 'alex')).rejects.toThrow('Give your vote a title.')
  expect(await db.polls.count()).toBe(0)
})
