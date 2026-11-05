import { db, type TripDb } from '@/data/db'
import { parseMinor } from './build'

export interface PersonalBudget { amountMinor: number; currency: string }

// Local metadata only: never added to synced rows, exports, or the assistant's snapshot.
export const budgetKey = (tripId: string, memberId: string) => `budget:${tripId}:${memberId}`

export function readBudget(value: string | undefined, currency: string): PersonalBudget | null {
  try {
    const row = JSON.parse(value ?? 'null') as PersonalBudget | null
    return row && row.currency === currency && Number.isSafeInteger(row.amountMinor) && row.amountMinor >= 0 ? row : null
  } catch { return null }
}

export async function saveBudget(tripId: string, memberId: string, text: string, currency: string, database: TripDb = db): Promise<void> {
  const amountMinor = parseMinor(text, currency)
  if (amountMinor === null || !Number.isSafeInteger(amountMinor)) throw new Error('Enter a valid budget using the currency’s decimal places.')
  await database._meta.put({ key: budgetKey(tripId, memberId), value: JSON.stringify({ amountMinor, currency }) })
}

export function budgetPosition(totalMinor: number, budgetMinor: number) {
  const remainingMinor = budgetMinor - totalMinor
  return { remainingMinor, over: remainingMinor < 0, used: budgetMinor > 0 ? Math.min(1, totalMinor / budgetMinor) : totalMinor > 0 ? 1 : 0 }
}
