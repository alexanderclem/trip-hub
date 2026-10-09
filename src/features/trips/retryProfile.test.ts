import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { TripDb } from '@/data/db'
import { save } from '@/data/repo'
import { retrySavedProfile } from './retryProfile'

let db: TripDb
let id: number
beforeEach(async () => {
  db = new TripDb(`retry-profile-${crypto.randomUUID()}`)
  await db.members.put({ id: 'alex', trip_id: 'trip', display_name: 'alex', color: '#123456', avatar_emoji: null, home_timezone: null })
  id = (await db._deadletter.add({ table: 'members', rowId: 'alex', payload: { id: 'alex', trip_id: 'trip', display_name: 'alex', color: '#old', venmo_username: 'alex-clem-9', avatar_url: null }, error: '400: missing column', at: Date.now() }))!
})
afterEach(async () => { await db.delete() })
it('restores profile fields atomically while preserving the current member data', async () => {
  await retrySavedProfile(id, 'trip', 'alex', db)
  expect(await db.members.get('alex')).toMatchObject({ color: '#123456', venmo_username: 'alex-clem-9', avatar_url: null, _dirty: 1 })
  expect(await db._deadletter.count()).toBe(0)
  expect((await db._outbox.toArray())[0]?.payload).toMatchObject({ venmo_username: 'alex-clem-9' })
})
it('retains the rejected payload when a newer edit is pending', async () => {
  const member = (await db.members.get('alex'))!
  await save('members', { ...member, display_name: 'Newer name' }, 'alex', db)
  await expect(retrySavedProfile(id, 'trip', 'alex', db)).rejects.toThrow('newer profile edit')
  expect(await db._deadletter.count()).toBe(1)
  expect((await db.members.get('alex'))?.display_name).toBe('Newer name')
})
it('refuses cross-trip retries without changing either queue', async () => {
  await expect(retrySavedProfile(id, 'other', 'alex', db)).rejects.toThrow('no longer available')
  expect(await db._deadletter.count()).toBe(1)
  expect(await db._outbox.count()).toBe(0)
})
