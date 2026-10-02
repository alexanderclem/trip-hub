import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  allocate,
  balances,
  computeShares,
  formatMoney,
  roundHalfEven,
  simplifyDebts,
  toBaseMinor,
  validateExpense,
  type Expense,
} from './money'

const expense = (over: Partial<Expense>): Expense => ({
  id: 'e1',
  amount_minor: 0,
  currency: 'USD',
  fx_rate: 1,
  base_currency: 'USD',
  base_amount_minor: 0,
  payers: [],
  split_method: 'equal',
  split: [],
  ...over,
})

describe('allocate', () => {
  it('splits 100 three ways into 34/33/33', () => {
    const parts = allocate(100, [1, 1, 1], ['a', 'b', 'c'])
    expect(parts.reduce((a, b) => a + b)).toBe(100)
    expect([...parts].sort()).toEqual([33, 33, 34])
  })

  it('gives the extra cent to different people depending on the tie key', () => {
    const winners = new Set<number>()
    for (let i = 0; i < 20; i++) {
      const parts = allocate(100, [1, 1, 1], [`e${i}a`, `e${i}b`, `e${i}c`])
      winners.add(parts.indexOf(34))
    }
    expect(winners.size).toBeGreaterThan(1)
  })

  it('honours percent basis points', () => {
    expect(allocate(10000, [3333, 3333, 3334], ['a', 'b', 'c'])).toEqual([3333, 3333, 3334])
  })

  it('gives zero to zero weights', () => {
    expect(allocate(99, [0, 1, 2], ['a', 'b', 'c'])).toEqual([0, 33, 66])
  })

  it('handles negative totals (refunds)', () => {
    const parts = allocate(-100, [1, 1, 1], ['a', 'b', 'c'])
    expect(parts.reduce((a, b) => a + b)).toBe(-100)
  })

  it('rejects allocating money to nobody', () => {
    expect(() => allocate(5, [0, 0], ['a', 'b'])).toThrow()
  })

  it('property: always sums exactly and each part is within 1 of its ideal share', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10_000_000, max: 10_000_000 }),
        fc.array(fc.integer({ min: 0, max: 10_000 }), { minLength: 1, maxLength: 12 }),
        (total, weights) => {
          fc.pre(weights.some((w) => w > 0))
          const keys = weights.map((_, i) => `k${i}`)
          const parts = allocate(total, weights, keys)
          const sumW = weights.reduce((a, b) => a + b)
          expect(parts.reduce((a, b) => a + b)).toBe(total)
          parts.forEach((p, i) => {
            expect(Math.abs(p - (total * weights[i]!) / sumW)).toBeLessThan(1)
          })
          expect(allocate(total, weights, keys)).toEqual(parts) // deterministic
        },
      ),
    )
  })
})

describe('formatMoney', () => {
  it('uses local symbols', () => {
    expect(formatMoney(5898, 'USD')).toBe('$58.98')
    expect(formatMoney(45000, 'GTQ')).toMatch(/^Q\s?450\.00$/) // some engines put a space after "Q"
    expect(formatMoney(1500, 'JPY')).toBe('¥1,500')
  })
})

describe('FX conversion', () => {
  it('converts GTQ to USD at the stored rate', () => {
    // Q450.00 at 7.63 GTQ per USD = $58.977… → $58.98
    expect(toBaseMinor(45000, 'GTQ', 7.63, 'USD')).toBe(5898)
  })

  it('handles currencies with different minor units (JPY has none)', () => {
    // ¥1500 at 150 JPY per USD = $10.00
    expect(toBaseMinor(1500, 'JPY', 150, 'USD')).toBe(1000)
    // $10.00 into a JPY base at 1/150 USD per JPY
    expect(toBaseMinor(1000, 'USD', 1 / 150, 'JPY')).toBe(1500)
  })

  it('rounds exact halves to even', () => {
    expect(roundHalfEven(2.5)).toBe(2)
    expect(roundHalfEven(3.5)).toBe(4)
    expect(roundHalfEven(-2.5)).toBe(-2)
    expect(roundHalfEven(2.4)).toBe(2)
  })

  it('refuses a missing rate for a foreign currency', () => {
    expect(() => toBaseMinor(100, 'GTQ', 0, 'USD')).toThrow()
  })
})

describe('computeShares', () => {
  it('equal split of a GTQ dinner paid by one person', () => {
    const e = expense({
      amount_minor: 45000,
      currency: 'GTQ',
      fx_rate: 7.63,
      base_amount_minor: 5898,
      payers: [{ member_id: 'ana', amount_minor: 45000 }],
      split: [
        { member_id: 'ana', value: 0 },
        { member_id: 'ben', value: 0 },
        { member_id: 'cy', value: 0 },
      ],
    })
    const s = computeShares(e)
    expect(s.get('ana')!.paid).toBe(5898)
    const owed = ['ana', 'ben', 'cy'].map((m) => s.get(m)!.owed)
    expect(owed.reduce((a, b) => a + b)).toBe(5898)
    expect([...owed].sort()).toEqual([1966, 1966, 1966])
  })

  it('exact split in a foreign currency still sums exactly in base', () => {
    const e = expense({
      amount_minor: 10000,
      currency: 'GTQ',
      fx_rate: 7.63,
      base_amount_minor: toBaseMinor(10000, 'GTQ', 7.63, 'USD'),
      payers: [{ member_id: 'ana', amount_minor: 10000 }],
      split_method: 'exact',
      split: [
        { member_id: 'ana', value: 2500 },
        { member_id: 'ben', value: 7500 },
      ],
    })
    const s = computeShares(e)
    expect(s.get('ana')!.owed + s.get('ben')!.owed).toBe(e.base_amount_minor)
  })

  it('multiple payers', () => {
    const e = expense({
      amount_minor: 3000,
      base_amount_minor: 3000,
      payers: [
        { member_id: 'ana', amount_minor: 1000 },
        { member_id: 'ben', amount_minor: 2000 },
      ],
      split_method: 'shares',
      split: [
        { member_id: 'ana', value: 1 },
        { member_id: 'ben', value: 2 },
      ],
    })
    const s = computeShares(e)
    expect(s.get('ana')).toEqual({ paid: 1000, owed: 1000 })
    expect(s.get('ben')).toEqual({ paid: 2000, owed: 2000 })
  })
})

describe('validateExpense', () => {
  it('catches exact amounts that do not add up', () => {
    const e = expense({
      amount_minor: 100,
      payers: [{ member_id: 'a', amount_minor: 100 }],
      split_method: 'exact',
      split: [{ member_id: 'a', value: 60 }],
    })
    expect(validateExpense(e)).toMatch(/add up/)
  })

  it('catches percentages that do not reach 100%', () => {
    const e = expense({
      amount_minor: 100,
      payers: [{ member_id: 'a', amount_minor: 100 }],
      split_method: 'percent',
      split: [{ member_id: 'a', value: 9000 }],
    })
    expect(validateExpense(e)).toMatch(/100%/)
  })
})

describe('balances + simplifyDebts', () => {
  it('settles a simple trip', () => {
    const members = ['ana', 'ben', 'cy']
    const equal = members.map((m) => ({ member_id: m, value: 0 }))
    const net = balances(
      [
        expense({ id: 'x', amount_minor: 9000, base_amount_minor: 9000, payers: [{ member_id: 'ana', amount_minor: 9000 }], split: equal }),
        expense({ id: 'y', amount_minor: 3000, base_amount_minor: 3000, payers: [{ member_id: 'ben', amount_minor: 3000 }], split: equal }),
      ],
      [],
    )
    expect(Object.fromEntries(net)).toEqual({ ana: 5000, ben: -1000, cy: -4000 })
    const t = simplifyDebts(net)
    expect(t).toEqual([
      { from: 'cy', to: 'ana', amount_minor: 4000 },
      { from: 'ben', to: 'ana', amount_minor: 1000 },
    ])
  })

  it('ignores deleted expenses and applies settlements', () => {
    const split = [
      { member_id: 'a', value: 0 },
      { member_id: 'b', value: 0 },
    ]
    const net = balances(
      [
        expense({ id: '1', amount_minor: 1000, base_amount_minor: 1000, payers: [{ member_id: 'a', amount_minor: 1000 }], split }),
        expense({ id: '2', amount_minor: 5000, base_amount_minor: 5000, payers: [{ member_id: 'a', amount_minor: 5000 }], split, deleted_at: '2027-01-01' }),
      ],
      [{ id: 's', from_member_id: 'b', to_member_id: 'a', base_amount_minor: 500 }],
    )
    expect(net.get('a')).toBe(0)
    expect(net.get('b')).toBe(0)
    expect(simplifyDebts(net)).toEqual([])
  })

  it('property: net sums to zero; transfers are ≤ n-1 and zero every balance', () => {
    const memberIds = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9']
    const arbExpense = fc
      .record({
        amount: fc.integer({ min: 1, max: 500_000 }),
        payer: fc.constantFrom(...memberIds),
        method: fc.constantFrom('equal' as const, 'shares' as const),
        who: fc.subarray(memberIds, { minLength: 1 }),
        shares: fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 10, maxLength: 10 }),
      })
      .map(
        (r): Expense =>
          expense({
            id: `${r.payer}-${r.amount}-${r.who.join()}`,
            amount_minor: r.amount,
            base_amount_minor: r.amount,
            payers: [{ member_id: r.payer, amount_minor: r.amount }],
            split_method: r.method,
            split: r.who.map((m, i) => ({ member_id: m, value: r.shares[i]! })),
          }),
      )

    fc.assert(
      fc.property(fc.array(arbExpense, { minLength: 1, maxLength: 40 }), (exps) => {
        const net = balances(exps, [])
        expect([...net.values()].reduce((a, b) => a + b, 0)).toBe(0)
        const transfers = simplifyDebts(net)
        const nonZero = [...net.values()].filter((v) => v !== 0).length
        expect(transfers.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1))
        const after = new Map(net)
        for (const t of transfers) {
          expect(t.amount_minor).toBeGreaterThan(0)
          after.set(t.from, after.get(t.from)! + t.amount_minor)
          after.set(t.to, after.get(t.to)! - t.amount_minor)
        }
        for (const v of after.values()) expect(v).toBe(0)
      }),
    )
  })
})
