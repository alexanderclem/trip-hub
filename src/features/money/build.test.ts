import { describe, expect, it } from 'vitest'
import { computeShares } from '@/lib/money'
import { buildExpense, parseMinor, type ExpenseDraft } from './build'

const draft = (over: Partial<ExpenseDraft> = {}): ExpenseDraft => ({
  id: 'e1', tripId: 't', description: 'Dinner at Café Sky', category: 'food', spentOn: '2027-03-15',
  amount: '450', currency: 'GTQ', baseCurrency: 'USD', rate: { value: 7.63, source: 'snapshot', asOf: '2027-03-01' },
  payers: [{ memberId: 'ana', amount: '' }], splitMethod: 'equal',
  rows: [{ memberId: 'ana', included: true, value: '' }, { memberId: 'ben', included: true, value: '' }, { memberId: 'cy', included: false, value: '' }],
  notes: '', itemId: null, placeId: null, ...over,
})

describe('parseMinor', () => {
  it.each([
    ['450', 'GTQ', 45000],
    ['58.98', 'USD', 5898],
    ['1,234.5', 'USD', 123450],
    ['.5', 'USD', 50],
    ['1500', 'JPY', 1500],
  ])('%s %s → %i', (text, ccy, minor) => expect(parseMinor(text, ccy)).toBe(minor))
  it.each([['', 'USD'], ['abc', 'USD'], ['1.234', 'USD'], ['1.5', 'JPY'], ['-3', 'USD']])('rejects %s %s', (text, ccy) =>
    expect(parseMinor(text, ccy)).toBeNull(),
  )
})

describe('buildExpense', () => {
  it('equal split of a quetzal dinner, converted at the stored rate', () => {
    const r = buildExpense(draft())
    if ('error' in r) throw new Error(r.error)
    expect(r.expense).toMatchObject({ amount_minor: 45000, currency: 'GTQ', fx_rate: 7.63, fx_source: 'snapshot', base_amount_minor: 5898 })
    expect(r.expense.payers).toEqual([{ member_id: 'ana', amount_minor: 45000 }])
    expect(r.expense.split).toEqual([{ member_id: 'ana', value: 0 }, { member_id: 'ben', value: 0 }]) // cy not included
    const shares = computeShares(r.expense)
    expect(shares.get('ana')!.owed + shares.get('ben')!.owed).toBe(5898)
  })

  it('same currency as base: rate 1, source "same"', () => {
    const r = buildExpense(draft({ currency: 'USD', amount: '30' }))
    if ('error' in r) throw new Error(r.error)
    expect(r.expense).toMatchObject({ fx_rate: 1, fx_source: 'same', fx_as_of: null, base_amount_minor: 3000 })
  })

  it('exact split must add up to the total', () => {
    const bad = buildExpense(draft({ splitMethod: 'exact', rows: [{ memberId: 'ana', included: true, value: '200' }, { memberId: 'ben', included: true, value: '200' }] }))
    expect(bad).toEqual({ error: 'Exact amounts must add up to the total' })
    const ok = buildExpense(draft({ splitMethod: 'exact', rows: [{ memberId: 'ana', included: true, value: '250' }, { memberId: 'ben', included: true, value: '200' }] }))
    expect('expense' in ok).toBe(true)
  })

  it('percent split must reach 100%', () => {
    const rows = (a: string, b: string) => [{ memberId: 'ana', included: true, value: a }, { memberId: 'ben', included: true, value: b }]
    expect(buildExpense(draft({ splitMethod: 'percent', rows: rows('60', '30') }))).toEqual({ error: 'Percentages must add up to 100%' })
    const ok = buildExpense(draft({ splitMethod: 'percent', rows: rows('66.67', '33.33') }))
    if ('error' in ok) throw new Error(ok.error)
    expect(ok.expense.split.map((s) => s.value)).toEqual([6667, 3333])
  })

  it('shares default to 1 and must be whole numbers', () => {
    const r = buildExpense(draft({ splitMethod: 'shares', rows: [{ memberId: 'ana', included: true, value: '2' }, { memberId: 'ben', included: true, value: '' }] }))
    if ('error' in r) throw new Error(r.error)
    expect(r.expense.split).toEqual([{ member_id: 'ana', value: 2 }, { member_id: 'ben', value: 1 }])
    expect(buildExpense(draft({ splitMethod: 'shares', rows: [{ memberId: 'ana', included: true, value: '1.5' }] }))).toEqual({ error: 'Shares must be whole numbers.' })
  })

  it('several payers must add up to the total', () => {
    const payers = (a: string, b: string) => [{ memberId: 'ana', amount: a }, { memberId: 'ben', amount: b }]
    expect(buildExpense(draft({ payers: payers('200', '200') }))).toEqual({ error: 'Payer amounts must add up to the total' })
    const ok = buildExpense(draft({ payers: payers('300', '150') }))
    if ('error' in ok) throw new Error(ok.error)
    expect(ok.expense.payers).toEqual([{ member_id: 'ana', amount_minor: 30000 }, { member_id: 'ben', amount_minor: 15000 }])
  })

  it('needs a description, an amount, someone to split with', () => {
    expect(buildExpense(draft({ description: ' ' }))).toEqual({ error: 'What was it for?' })
    expect(buildExpense(draft({ amount: '0' }))).toEqual({ error: 'Enter the amount.' })
    expect(buildExpense(draft({ rows: [{ memberId: 'ana', included: false, value: '' }] }))).toEqual({ error: 'Pick at least one person to split with' })
  })
})
