import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { TripDb } from '@/data/db'
import { addStarters, checkId, claim, savePackingItem, setMyCheck, setPacked, tally } from './data'
import { suggestedStarters } from './starters'
import type { DailyWeather } from '@/lib/weather'

const T = '00000000-0000-4000-8000-0000000000aa'
let db: TripDb
beforeEach(async () => {
  db = new TripDb(`packing-test-${crypto.randomUUID()}`)
  for (const [id, name] of [['alex', 'Alex'], ['sam', 'Sam'], ['kim', 'Kim']]) {
    await db.members.put({ id: id!, trip_id: T, display_name: name!, color: null, avatar_emoji: null, home_timezone: null })
  }
})
afterEach(async () => { await db.delete() })

const fields = { title: ' Bug spray ', kind: 'everyone' as const, category: ' Health ', owner_id: null, quantity: null, notes: '  ' }

describe('packing items', () => {
  it('saves offline with tidy fields and queues the change', async () => {
    const id = await savePackingItem(T, undefined, fields, 'alex', db)
    expect(await db.packing_items.get(id)).toMatchObject({ title: 'Bug spray', category: 'Health', notes: null, owner_id: null, packed: false, _dirty: 1 })
    expect(await db._outbox.count()).toBe(1)
  })

  it('sets the owner by kind: nobody for everyone, me for personal, the chosen person for group gear', async () => {
    const e = await savePackingItem(T, undefined, { ...fields, owner_id: 'sam' }, 'alex', db)
    const p = await savePackingItem(T, undefined, { ...fields, kind: 'personal', owner_id: 'sam' }, 'alex', db)
    const g = await savePackingItem(T, undefined, { ...fields, kind: 'group', owner_id: 'sam' }, 'alex', db)
    expect((await db.packing_items.get(e))?.owner_id).toBeNull()
    expect((await db.packing_items.get(p))?.owner_id).toBe('alex')
    expect((await db.packing_items.get(g))?.owner_id).toBe('sam')
    // Someone else editing my personal item keeps it mine.
    await savePackingItem(T, p, { ...fields, kind: 'personal', title: 'Contact lenses' }, 'sam', db)
    expect((await db.packing_items.get(p))?.owner_id).toBe('alex')
  })

  it('rejects bad input', async () => {
    await expect(savePackingItem(T, undefined, { ...fields, title: '  ' }, 'alex', db)).rejects.toThrow(/between 1 and 200/)
    await expect(savePackingItem(T, undefined, { ...fields, quantity: 0 }, 'alex', db)).rejects.toThrow(/Quantity/)
    await expect(savePackingItem(T, undefined, { ...fields, kind: 'personal' }, null, db)).rejects.toThrow(/who you are/)
    await expect(savePackingItem(T, undefined, { ...fields, kind: 'group', owner_id: 'stranger' }, 'alex', db)).rejects.toThrow(/still in this trip/)
  })

  it('claims group gear, and claiming someone else’s resets the packed tick', async () => {
    const g = await savePackingItem(T, undefined, { ...fields, kind: 'group', title: 'Speaker' }, 'alex', db)
    await claim(g, 'alex', 'alex', db)
    await setPacked(g, true, 'alex', db)
    expect(await db.packing_items.get(g)).toMatchObject({ owner_id: 'alex', packed: true })
    await claim(g, 'sam', 'sam', db)
    expect(await db.packing_items.get(g)).toMatchObject({ owner_id: 'sam', packed: false })
  })
})

describe('everyone ticks', () => {
  it('converge on one row per person and are cleared to null, never deleted', async () => {
    const e = await savePackingItem(T, undefined, fields, 'alex', db)
    await setMyCheck(T, e, 'alex', 'packed', db)
    await setMyCheck(T, e, 'sam', 'skip', db)
    await setMyCheck(T, e, 'alex', null, db)
    const rows = await db.packing_checks.toArray()
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.member_id === 'alex')).toMatchObject({ id: checkId(T, e, 'alex'), state: null })
    expect(rows.every((r) => !r.deleted_at)).toBe(true)
    expect(tally(e, rows, ['alex', 'sam', 'kim'])).toEqual({ packed: [], skipped: ['sam'], waiting: ['alex', 'kim'], needed: 2 })
  })
})

describe('starters', () => {
  const day = (over: Partial<DailyWeather>): DailyWeather => ({ code: 0, hi: 24, lo: 14, rainPct: 0, rainMm: 0, windKmh: 5, sunrise: null, sunset: null, ...over })

  it('adds weather extras only when the weather calls for them', () => {
    const keys = (d: DailyWeather[]) => suggestedStarters(d).map((s) => s.key)
    expect(keys([day({})])).not.toContain('rain-jacket')
    expect(keys([day({ rainPct: 60 })])).toContain('rain-jacket')
    expect(keys([day({ lo: 6 })])).toContain('warm-layer')
    expect(keys([day({ hi: 31 })])).toEqual(expect.arrayContaining(['sun-hat', 'sunscreen']))
  })

  it('never duplicates, however often or from however many phones it runs', async () => {
    await fc.assert(fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 4 }), async (rainy) => {
      const tripId = crypto.randomUUID()
      for (const r of rainy) await addStarters(tripId, suggestedStarters([day({ rainPct: r ? 80 : 0 })]), 'alex', db)
      const titles = (await db.packing_items.where('trip_id').equals(tripId).toArray()).map((i) => i.title)
      expect(new Set(titles).size).toBe(titles.length)
    }), { numRuns: 15 })
  })

  it('does not bring back a suggestion someone removed', async () => {
    const starters = suggestedStarters([day({})])
    expect(await addStarters(T, starters, 'alex', db)).toBe(starters.length)
    const speaker = (await db.packing_items.toArray()).find((i) => i.title === 'Bluetooth speaker')!
    await db.packing_items.update(speaker.id, { deleted_at: '2026-10-02T00:00:00Z' })
    expect(await addStarters(T, starters, 'alex', db)).toBe(0)
  })
})
