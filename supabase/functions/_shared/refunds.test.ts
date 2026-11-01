import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { daysBefore, splitRefund, suggestRefund } from './refunds.ts'

const tiers = [{ days_before: 60, percent: 100 }, { days_before: 30, percent: 50 }]

describe('refund tiers', () => {
  it('counts whole days to the trip', () => {
    expect(daysBefore('2027-03-13', '2027-01-12')).toBe(60)
    expect(daysBefore('2027-03-13', '2027-03-13')).toBe(0)
  })
  it('suggests the most generous tier that still applies', () => {
    expect(suggestRefund(150000, tiers, 61)).toEqual({ percent: 100, amount: 150000 })
    expect(suggestRefund(150000, tiers, 60)).toEqual({ percent: 100, amount: 150000 })
    expect(suggestRefund(150000, tiers, 45)).toEqual({ percent: 50, amount: 75000 })
    expect(suggestRefund(150000, tiers, 10)).toEqual({ percent: 0, amount: 0 })
    expect(suggestRefund(150000, [], 100)).toEqual({ percent: 0, amount: 0 })
  })
})

describe('splitting a refund across charges', () => {
  it('takes from the newest charge first', () => {
    expect(splitRefund(70000, [{ charge: 'ch_new', refundable: 60000 }, { charge: 'ch_old', refundable: 30000 }]))
      .toEqual([{ charge: 'ch_new', amount: 60000 }, { charge: 'ch_old', amount: 10000 }])
  })
  it('never refunds more than was paid', () => {
    expect(() => splitRefund(100, [{ charge: 'a', refundable: 50 }])).toThrow(/more than/)
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 100000 }), { maxLength: 5 }), fc.integer({ min: 0, max: 500000 }), (refundables, amount) => {
      const charges = refundables.map((r, i) => ({ charge: `ch_${i}`, refundable: r }))
      const total = refundables.reduce((a, b) => a + b, 0)
      if (amount > total) return
      const parts = splitRefund(amount, charges)
      expect(parts.reduce((a, p) => a + p.amount, 0)).toBe(amount)
      for (const p of parts) expect(p.amount).toBeLessThanOrEqual(charges.find((c) => c.charge === p.charge)!.refundable)
    }))
  })
})
