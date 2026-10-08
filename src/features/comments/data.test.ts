import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Comment } from '@/data/types'

// The data helpers write through the app's own database; give each test a fresh one.
const holder = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/data/db', async (original) => {
  const actual = await original<typeof import('@/data/db')>()
  return { ...actual, get db() { return holder.db } }
})
import { TripDb } from '@/data/db'
import { addComment, ago, COMMENT_MAX, inOrder, removeComment } from './data'

let db: TripDb
beforeEach(() => { db = new TripDb(`comments-test-${crypto.randomUUID()}`); holder.db = db })
afterEach(async () => { await db.delete() })

describe('comments offline', () => {
  it('saves a trimmed comment and queues it for the server as its author', async () => {
    await addComment('trip', 'poll', 'poll-1', 'alex', '  Too far from the dock?  ')
    const [row] = await db.comments.toArray()
    expect(row).toMatchObject({ trip_id: 'trip', subject_type: 'poll', subject_id: 'poll-1', member_id: 'alex', body: 'Too far from the dock?', created_by: 'alex', _dirty: 1 })
    const [queued] = await db._outbox.toArray()
    expect(queued).toMatchObject({ table: 'comments', rowId: row!.id })
    expect(queued!.payload).toMatchObject({ member_id: 'alex', body: 'Too far from the dock?' })
    expect(queued!.payload).not.toHaveProperty('created_at')
  })

  it('ignores an empty comment and cuts one that is too long', async () => {
    await addComment('trip', 'place', 'place-1', 'alex', '   \n ')
    expect(await db.comments.count()).toBe(0)
    await addComment('trip', 'place', 'place-1', 'alex', 'x'.repeat(COMMENT_MAX + 50))
    expect((await db.comments.toArray())[0]!.body).toHaveLength(COMMENT_MAX)
  })

  it('finds a thread by its subject, and removal is a tombstone that syncs', async () => {
    await addComment('trip', 'item', 'item-1', 'alex', 'First')
    await addComment('trip', 'item', 'item-2', 'sam', 'Elsewhere')
    const thread = await db.comments.where('[subject_type+subject_id]').equals(['item', 'item-1']).toArray()
    expect(thread.map((c) => c.body)).toEqual(['First'])
    await removeComment(thread[0]!, 'alex')
    expect((await db.comments.get(thread[0]!.id))?.deleted_at).toBeTruthy()
    expect(inOrder(await db.comments.where('[subject_type+subject_id]').equals(['item', 'item-1']).toArray())).toEqual([])
    expect((await db._outbox.where('[table+rowId]').equals(['comments', thread[0]!.id]).first())?.payload.deleted_at).toBeTruthy()
  })
})

describe('inOrder', () => {
  const c = (id: string, created_at: string | undefined, deleted = false) => ({ id, trip_id: 't', subject_type: 'poll', subject_id: 'p', member_id: 'm', body: id, created_at, deleted_at: deleted ? 'x' : null }) as Comment
  it('reads oldest first and drops removed comments', () => {
    expect(inOrder([c('b', '2027-01-02T00:00:00Z'), c('gone', '2027-01-01T12:00:00Z', true), c('a', '2027-01-01T00:00:00Z')]).map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('ago', () => {
  const now = Date.parse('2027-01-05T12:00:00Z')
  it('says just now for the last minute, a missing time, or a clock that is ahead', () => {
    expect(ago(undefined, now)).toBe('just now')
    expect(ago('2027-01-05T11:59:30Z', now)).toBe('just now')
    expect(ago('2027-01-05T12:03:00Z', now)).toBe('just now')
  })
  it('counts back in plain words', () => {
    expect(ago('2027-01-05T10:00:00Z', now)).toBe('2 hours ago')
    expect(ago('2027-01-02T12:00:00Z', now)).toBe('3 days ago')
  })
})
