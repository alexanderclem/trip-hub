// The public trip cost splitter: the app's own money maths (largest-remainder split, fewest-payments
// settle-up), run on the visitor's phone with nothing saved or sent.
import { balances, simplifyDebts, type Expense, type Transfer } from '@/lib/money'
import { parseMinor } from '@/features/money/build'

export interface SplitPerson { id: string; name: string }
export interface SplitCost { id: string; label: string; amount: string; paidBy: string; among: string[] }

export interface SplitResult {
  /** Per person, in minor units: what they paid, their share, and paid minus share. */
  people: { id: string; name: string; paid: number; share: number; balance: number }[]
  transfers: Transfer[]
  total: number
  /** Costs left out, with the reason, so the form can say what to fix. */
  skipped: { id: string; reason: string }[]
}

export function splitCosts(people: SplitPerson[], costs: SplitCost[], currency: string): SplitResult {
  const known = new Set(people.map((p) => p.id))
  const expenses: Expense[] = []
  const skipped: SplitResult['skipped'] = []
  const paid = new Map<string, number>()
  const share = new Map<string, number>()
  for (const cost of costs) {
    if (!cost.amount.trim()) continue
    const amount = parseMinor(cost.amount, currency)
    if (amount === null) { skipped.push({ id: cost.id, reason: 'Check the amount.' }); continue }
    if (amount === 0) continue
    if (!known.has(cost.paidBy)) { skipped.push({ id: cost.id, reason: 'Choose who paid.' }); continue }
    const among = cost.among.filter((id) => known.has(id))
    if (!among.length) { skipped.push({ id: cost.id, reason: 'Choose who it’s split between.' }); continue }
    const expense: Expense = {
      id: cost.id,
      amount_minor: amount,
      currency,
      fx_rate: 1,
      base_currency: currency,
      base_amount_minor: amount,
      payers: [{ member_id: cost.paidBy, amount_minor: amount }],
      split_method: 'equal',
      split: among.map((member_id) => ({ member_id, value: 1 })),
    }
    expenses.push(expense)
    paid.set(cost.paidBy, (paid.get(cost.paidBy) ?? 0) + amount)
  }
  const net = balances(expenses, [])
  for (const person of people) share.set(person.id, (paid.get(person.id) ?? 0) - (net.get(person.id) ?? 0))
  return {
    people: people.map((p) => ({ id: p.id, name: p.name, paid: paid.get(p.id) ?? 0, share: share.get(p.id) ?? 0, balance: net.get(p.id) ?? 0 })),
    transfers: simplifyDebts(net),
    total: expenses.reduce((sum, e) => sum + e.amount_minor, 0),
    skipped,
  }
}
