import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TripDb } from '@/data/db'
import { flushEvents, MAX_QUEUED, rememberSource, track, type SendEvents } from './events'

let n = 0
const fresh = () => new TripDb(`events-test-${n++}`)
let database: TripDb
afterEach(async () => { await database?.delete() })

describe('funnel events', () => {
  it('waits on the phone and keeps only the newest when the queue is full', async () => {
    database = fresh()
    for (let i = 0; i < MAX_QUEUED + 5; i++) await track('invite_shared', null, { i }, database)
    const left = await database._events.orderBy('seq').toArray()
    expect(left).toHaveLength(MAX_QUEUED)
    expect(left[0]!.props.i).toBe(5)
  })

  it('sends in batches and empties the queue', async () => {
    database = fresh()
    for (let i = 0; i < 120; i++) await track('money_moment_shown', 'trip', { reason: 'size' }, database)
    const batches: number[] = []
    const send: SendEvents = async (events) => { batches.push(events.length); return { ok: true } }
    expect(await flushEvents(send, database)).toBe(120)
    expect(batches).toEqual([50, 50, 20])
    expect(await database._events.count()).toBe(0)
  })

  it('keeps events when offline or the server lacks the funnel, and drops ones it refuses', async () => {
    database = fresh()
    await track('invite_shared', 'trip', {}, database)
    expect(await flushEvents(async () => ({ ok: false, retry: true }), database)).toBe(0)
    expect(await database._events.count()).toBe(1)
    expect(await flushEvents(async () => ({ ok: false, retry: false }), database)).toBe(0)
    expect(await database._events.count()).toBe(0)
  })

  it('remembers only a plain source name', () => {
    const store = new Map<string, string>()
    globalThis.sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } as Storage
    rememberSource('?utm_source=reddit')
    expect(store.get('stowaway-source')).toBe('reddit')
    rememberSource('?ref=<script>')
    expect(store.get('stowaway-source')).toBe('reddit')
  })
})
