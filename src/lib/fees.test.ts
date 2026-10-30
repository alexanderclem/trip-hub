import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { quote, stripeFee, stowawayFee, type QuoteInput } from './fees'

const trip: QuoteInput = { price: 150_000, travelers: 20, deposit: 30_000, method: 'card', internationalShare: 0, feeMode: 'absorb' }

describe('fees', () => {
  it('matches the worked example in the plan (card)', () => {
    const q = quote(trip)
    expect(q.charges.map((c) => [c.label, c.charged, c.stripeFee, c.stowawayFee])).toEqual([['Deposit', 30_000, 900, 300], ['Balance', 120_000, 3510, 1200]])
    expect(q.total).toEqual({ charged: 3_000_000, stripeFee: 88_200, stowawayFee: 30_000, kept: 2_881_800 })
  })

  it('matches the worked example in the plan (bank payments, capped at $5)', () => {
    const q = quote({ ...trip, method: 'ach' })
    expect(q.charges.map((c) => c.stripeFee)).toEqual([240, 500])
    expect(q.total.stripeFee).toBe(14_800)
    expect(q.total.kept).toBe(2_955_200)
  })

  it('adds the extra fee for cards from abroad, blended by share', () => {
    expect(stripeFee(10_000, 'card', 0)).toBe(320)
    expect(stripeFee(10_000, 'card', 1)).toBe(470)
    expect(stripeFee(10_000, 'card', 0.5)).toBe(395)
    expect(stowawayFee(10_000)).toBe(100)
  })

  it('takes one payment when there is no deposit, or the deposit is the whole price', () => {
    expect(quote({ ...trip, deposit: 0 }).charges.map((c) => c.label)).toEqual(['Full payment'])
    expect(quote({ ...trip, deposit: trip.price }).charges.map((c) => c.label)).toEqual(['Full payment'])
  })

  const inputs = fc.record({
    price: fc.integer({ min: 100, max: 2_000_000 }),
    travelers: fc.integer({ min: 1, max: 200 }),
    deposit: fc.integer({ min: 0, max: 2_000_000 }),
    method: fc.constantFrom<'card' | 'ach'>('card', 'ach'),
    internationalShare: fc.double({ min: 0, max: 1, noNaN: true }),
    feeMode: fc.constantFrom<'absorb' | 'pass'>('absorb', 'pass'),
  })

  it('always accounts for every cent: charged = Stripe + Stowaway + kept', () => {
    fc.assert(fc.property(inputs, (input) => {
      const q = quote(input)
      for (const c of q.charges) expect(c.stripeFee + c.stowawayFee + c.kept).toBe(c.charged)
      expect(q.total.stripeFee + q.total.stowawayFee + q.total.kept).toBe(q.total.charged)
      expect(q.charges.reduce((a, c) => a + c.base, 0)).toBe(input.price)
    }))
  })

  it('passing fees on leaves the organizer the whole trip price, with the smallest booking fee that does', () => {
    fc.assert(fc.property(inputs, (input) => {
      for (const c of quote({ ...input, feeMode: 'pass' }).charges) {
        expect(c.kept).toBeGreaterThanOrEqual(c.base)
        const one = quote({ ...input, feeMode: 'absorb', price: c.charged - 1, deposit: 0 }).charges[0]!
        expect(one.kept).toBeLessThan(c.base)
      }
    }))
  })

  it('absorbing fees never charges travelers more than the price', () => {
    fc.assert(fc.property(inputs, (input) => {
      const q = quote({ ...input, feeMode: 'absorb' })
      expect(q.perTraveler.charged).toBe(input.price)
      expect(q.charges.every((c) => c.bookingFee === 0)).toBe(true)
    }))
  })
})
