import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TripDb } from '@/data/db'
import { budgetKey, budgetPosition, readBudget, saveBudget } from './budget'

const databases: TripDb[] = []
function database() { const db = new TripDb(crypto.randomUUID()); databases.push(db); return db }
afterEach(async () => { await Promise.all(databases.splice(0).map((db) => db.delete())) })

describe('private budgets', () => {
  it('persists offline, scoped to a trip and traveler, without a synced write', async () => {
    const db = database()
    await saveBudget('trip', 'alex', '1,250.50', 'USD', db)
    expect(readBudget((await db._meta.get(budgetKey('trip', 'alex')))!.value, 'USD')).toEqual({ amountMinor: 125050, currency: 'USD' })
    expect(await db._meta.get(budgetKey('trip', 'sam'))).toBeUndefined()
    expect(await db._meta.get(budgetKey('other', 'alex'))).toBeUndefined()
    expect(await db._outbox.count()).toBe(0)
    expect(await db.member_preferences.count()).toBe(0)
  })
  it('supports zero budgets and the currency’s minor units', async () => {
    const db = database()
    await saveBudget('t', 'a', '0', 'USD', db)
    expect(readBudget((await db._meta.get(budgetKey('t', 'a')))!.value, 'USD')!.amountMinor).toBe(0)
    await saveBudget('t', 'a', '1250', 'JPY', db)
    expect(readBudget((await db._meta.get(budgetKey('t', 'a')))!.value, 'JPY')!.amountMinor).toBe(1250)
    await expect(saveBudget('t', 'a', '1.50', 'JPY', db)).rejects.toThrow('valid budget')
  })
  it('rejects malformed, negative and unsafe amounts without replacing a saved budget', async () => {
    const db = database(); await saveBudget('t', 'a', '100', 'USD', db)
    for (const text of ['-1', '', 'abc', '1.001', 'Infinity', '999999999999999999999999999']) await expect(saveBudget('t', 'a', text, 'USD', db)).rejects.toThrow('valid budget')
    expect(readBudget((await db._meta.get(budgetKey('t', 'a')))!.value, 'USD')!.amountMinor).toBe(10000)
  })
  it('ignores corrupted metadata and a budget saved in a different base currency', () => {
    for (const value of [undefined, '{', 'null', 'false', '12', '{"amountMinor":-1,"currency":"USD"}', '{"amountMinor":1.5,"currency":"USD"}', '{"amountMinor":100,"currency":"EUR"}']) expect(readBudget(value, 'USD')).toBeNull()
  })
  it('computes remaining and over-budget amounts without NaN at a zero target', () => {
    expect(budgetPosition(8000, 10000)).toEqual({ remainingMinor: 2000, over: false, used: 0.8 })
    expect(budgetPosition(11000, 10000)).toEqual({ remainingMinor: -1000, over: true, used: 1 })
    expect(budgetPosition(0, 0)).toEqual({ remainingMinor: 0, over: false, used: 0 })
    expect(budgetPosition(100, 0)).toEqual({ remainingMinor: -100, over: true, used: 1 })
  })
})
