// Turns the expense form's text inputs into a validated expense row. Pure, so it's unit-tested.
import type { ExpenseCategory, ExpenseRow } from '@/data/types'
import { minorUnits, toBaseMinor, validateExpense, type SplitMethod } from '@/lib/money'

export interface ExpenseDraft {
  id: string
  tripId: string
  description: string
  category: ExpenseCategory
  spentOn: string
  amount: string // "450", "58.98"
  currency: string
  baseCurrency: string
  rate: { value: number; source: ExpenseRow['fx_source']; asOf: string | null }
  payers: { memberId: string; amount: string }[] // a single payer may leave amount empty
  splitMethod: SplitMethod
  rows: { memberId: string; included: boolean; value: string }[]
  notes: string
  itemId: string | null
  placeId: string | null
}

/** "1,234.50" → 123450 minor units; null if not a valid non-negative number. */
export function parseMinor(text: string, currency: string): number | null {
  const t = text.replace(/[,\s]/g, '').trim()
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return null
  const e = minorUnits(currency)
  const [whole = '0', frac = ''] = t.split('.')
  if (frac.length > e) return null
  return Number(whole) * 10 ** e + Number((frac + '0'.repeat(e)).slice(0, e) || '0')
}

export function buildExpense(d: ExpenseDraft): { expense: ExpenseRow } | { error: string } {
  if (!d.description.trim()) return { error: 'What was it for?' }
  const amount = parseMinor(d.amount, d.currency)
  if (!amount) return { error: 'Enter the amount.' }
  if (!(d.rate.value > 0)) return { error: 'Enter the exchange rate.' }

  const payers =
    d.payers.length === 1
      ? [{ member_id: d.payers[0]!.memberId, amount_minor: amount }]
      : d.payers.map((p) => ({ member_id: p.memberId, amount_minor: parseMinor(p.amount || '0', d.currency) ?? NaN }))
  if (payers.some((p) => !Number.isFinite(p.amount_minor))) return { error: 'Check the amounts each person paid.' }

  const included = d.rows.filter((r) => r.included)
  let split: ExpenseRow['split']
  switch (d.splitMethod) {
    case 'equal':
      split = included.map((r) => ({ member_id: r.memberId, value: 0 }))
      break
    case 'shares':
      split = included.map((r) => ({ member_id: r.memberId, value: r.value.trim() === '' ? 1 : Number(r.value) }))
      if (split.some((s) => !Number.isInteger(s.value) || s.value < 0)) return { error: 'Shares must be whole numbers.' }
      break
    case 'exact':
      split = included.map((r) => ({ member_id: r.memberId, value: parseMinor(r.value || '0', d.currency) ?? NaN }))
      if (split.some((s) => !Number.isFinite(s.value))) return { error: 'Check the exact amounts.' }
      break
    case 'percent':
      split = included.map((r) => ({ member_id: r.memberId, value: Math.round(Number(r.value || '0') * 100) }))
      if (split.some((s) => !Number.isFinite(s.value) || s.value < 0)) return { error: 'Check the percentages.' }
      break
  }

  const base_amount_minor = toBaseMinor(amount, d.currency, d.rate.value, d.baseCurrency)
  if (base_amount_minor <= 0) return { error: 'That amount is too small to split.' }

  const expense: ExpenseRow = {
    id: d.id,
    trip_id: d.tripId,
    description: d.description.trim(),
    category: d.category,
    spent_on: d.spentOn,
    amount_minor: amount,
    currency: d.currency,
    fx_rate: d.currency === d.baseCurrency ? 1 : d.rate.value,
    fx_source: d.currency === d.baseCurrency ? 'same' : d.rate.source,
    fx_as_of: d.currency === d.baseCurrency ? null : d.rate.asOf,
    base_currency: d.baseCurrency,
    base_amount_minor,
    payers,
    split_method: d.splitMethod,
    split,
    place_id: d.placeId,
    item_id: d.itemId,
    notes: d.notes.trim() || null,
  }
  const problem = validateExpense(expense)
  return problem ? { error: problem } : { expense }
}
