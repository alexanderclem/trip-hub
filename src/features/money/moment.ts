// The "money moment" (docs/PLAN_THE_SWITCH.md, section 5): the point where a trip's creator could use
// real payment collection. Only these moments may offer it, and only to the creator; never a banner.

import { minorUnits, type Expense, type Transfer } from '@/lib/money'

export type MomentReason = 'size' | 'big_expense' | 'owed'

/** People on a trip at which collecting money by hand gets hard. */
export const BIG_GROUP = 10
/** A shared expense at least this much per person, in whole units of the trip's base currency. */
export const BIG_SHARE = 100
/** The creator is owed by at least this many people. */
export const OWED_BY = 3

export interface MomentInput {
  me: string | null
  createdBy: string | null | undefined
  people: number
  baseCurrency: string
  expenses: Pick<Expense, 'base_amount_minor' | 'split' | 'deleted_at'>[]
  transfers: Transfer[]
}

/** Why the creator is at a money moment, or null (always null for anyone else). */
export function moneyMoment(m: MomentInput): MomentReason | null {
  if (!m.me || m.createdBy !== m.me) return null
  if (m.people >= BIG_GROUP) return 'size'
  const bigShare = BIG_SHARE * 10 ** minorUnits(m.baseCurrency)
  if (m.expenses.some((e) => !e.deleted_at && e.split.length >= 2 && e.base_amount_minor / e.split.length >= bigShare)) return 'big_expense'
  if (new Set(m.transfers.filter((t) => t.to === m.me).map((t) => t.from)).size >= OWED_BY) return 'owed'
  return null
}
