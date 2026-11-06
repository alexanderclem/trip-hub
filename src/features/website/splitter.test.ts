import { describe, expect, it } from 'vitest'
import { splitCosts, type SplitPerson } from './splitter'

const people: SplitPerson[] = [{ id: 'a', name: 'Maya' }, { id: 'b', name: 'Jordan' }, { id: 'c', name: 'Priya' }]
const everyone = ['a', 'b', 'c']

describe('trip cost splitter', () => {
  it('splits costs equally and settles in the fewest payments', () => {
    const result = splitCosts(people, [
      { id: '1', label: 'House', amount: '900', paidBy: 'a', among: everyone },
      { id: '2', label: 'Shuttle', amount: '60', paidBy: 'b', among: everyone },
    ], 'USD')
    expect(result.total).toBe(96000)
    expect(result.people.map((p) => [p.name, p.paid, p.share, p.balance])).toEqual([
      ['Maya', 90000, 32000, 58000],
      ['Jordan', 6000, 32000, -26000],
      ['Priya', 0, 32000, -32000],
    ])
    expect(result.transfers).toHaveLength(2)
    expect(result.transfers).toEqual(expect.arrayContaining([
      { from: 'b', to: 'a', amount_minor: 26000 },
      { from: 'c', to: 'a', amount_minor: 32000 },
    ]))
  })

  it('spreads leftover cents so shares always add up to the total', () => {
    const result = splitCosts(people, [{ id: '1', label: 'Dinner', amount: '100', paidBy: 'a', among: everyone }], 'USD')
    expect(result.people.reduce((sum, p) => sum + p.share, 0)).toBe(10000)
    expect(result.people.reduce((sum, p) => sum + p.balance, 0)).toBe(0)
  })

  it('only charges the people a cost is split between', () => {
    const result = splitCosts(people, [{ id: '1', label: 'Scuba', amount: '150', paidBy: 'c', among: ['b', 'c'] }], 'USD')
    expect(result.people.find((p) => p.id === 'a')!.share).toBe(0)
    expect(result.transfers).toEqual([{ from: 'b', to: 'c', amount_minor: 7500 }])
  })

  it('skips incomplete costs and says why, and ignores empty rows', () => {
    const result = splitCosts(people, [
      { id: '1', label: '', amount: '', paidBy: 'a', among: everyone },
      { id: '2', label: 'Bad', amount: '12.345', paidBy: 'a', among: everyone },
      { id: '3', label: 'Nobody', amount: '10', paidBy: 'a', among: [] },
      { id: '4', label: 'Removed payer', amount: '10', paidBy: 'zz', among: everyone },
    ], 'USD')
    expect(result.total).toBe(0)
    expect(result.skipped).toEqual([
      { id: '2', reason: 'Check the amount.' },
      { id: '3', reason: 'Choose who it’s split between.' },
      { id: '4', reason: 'Choose who paid.' },
    ])
  })

  it('uses the currency’s own decimal places', () => {
    const result = splitCosts(people, [{ id: '1', label: 'Ramen', amount: '3000', paidBy: 'a', among: everyone }], 'JPY')
    expect(result.total).toBe(3000)
    expect(splitCosts(people, [{ id: '1', label: 'x', amount: '10.5', paidBy: 'a', among: everyone }], 'JPY').skipped).toHaveLength(1)
  })
})
