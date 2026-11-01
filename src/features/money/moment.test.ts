import { describe, expect, it } from 'vitest'
import { moneyMoment, type MomentInput } from './moment'

const base: MomentInput = { me: 'ana', createdBy: 'ana', people: 4, baseCurrency: 'USD', expenses: [], transfers: [] }
const split = (n: number) => Array.from({ length: n }, (_, i) => ({ member_id: `m${i}`, value: 1 }))

describe('the money moment', () => {
  it('is only ever for the trip’s creator', () => {
    expect(moneyMoment({ ...base, people: 12 })).toBe('size')
    expect(moneyMoment({ ...base, people: 12, me: 'ben' })).toBeNull()
    expect(moneyMoment({ ...base, people: 12, me: null })).toBeNull()
  })
  it('comes with a big group', () => {
    expect(moneyMoment({ ...base, people: 9 })).toBeNull()
    expect(moneyMoment({ ...base, people: 10 })).toBe('size')
  })
  it('comes with a big shared cost per person, in the trip’s currency', () => {
    expect(moneyMoment({ ...base, expenses: [{ base_amount_minor: 39_999, split: split(4) }] })).toBeNull()
    expect(moneyMoment({ ...base, expenses: [{ base_amount_minor: 40_000, split: split(4) }] })).toBe('big_expense')
    expect(moneyMoment({ ...base, expenses: [{ base_amount_minor: 40_000, split: split(4), deleted_at: '2027-01-01' }] })).toBeNull()
    expect(moneyMoment({ ...base, baseCurrency: 'JPY', expenses: [{ base_amount_minor: 400, split: split(4) }] })).toBe('big_expense')
  })
  it('comes when three or more people owe the creator', () => {
    const owe = (from: string) => ({ from, to: 'ana', amount_minor: 500 })
    expect(moneyMoment({ ...base, transfers: [owe('b'), owe('c')] })).toBeNull()
    expect(moneyMoment({ ...base, transfers: [owe('b'), owe('c'), owe('d')] })).toBe('owed')
  })
})
