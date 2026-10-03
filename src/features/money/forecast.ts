// "What will this trip cost me?": my share of what's already been logged, plus my share of the
// estimated costs on plan items nobody has logged an expense for yet. All in base-currency minor
// units; estimates in other currencies convert at the latest snapshot (or the fallback rate).

import type { ExpenseRow, ItineraryItem } from '@/data/types'
import { rateFor, type RateTable } from '@/lib/fx'
import { allocate, computeShares, toBaseMinor } from '@/lib/money'

export interface PlannedShare {
  item: ItineraryItem
  /** The whole estimate in base minor units. */
  totalMinor: number
  /** My part of it. */
  shareMinor: number
  people: number
}

export interface Forecast {
  spentMinor: number
  plannedMinor: number
  planned: PlannedShare[]
  /** Plans I'm going to that have no estimate and no logged expense. */
  missingEstimates: number
  /** Everyone's planned (not yet logged) costs together. */
  groupPlannedMinor: number
}

const live = (i: ItineraryItem) => !i.deleted_at && i.status !== 'cancelled'
const COSTLY = new Set(['activity', 'meal', 'flight', 'transport', 'lodging', 'reservation'])

export function forecast(opts: {
  items: ItineraryItem[]
  expenses: ExpenseRow[]
  memberIds: string[]
  me: string
  base: string
  snapshot: RateTable | null
}): Forecast {
  const { items, expenses, memberIds, me, base, snapshot } = opts
  const liveExpenses = expenses.filter((e) => !e.deleted_at)
  const logged = new Set(liveExpenses.flatMap((e) => (e.item_id ? [e.item_id] : [])))
  const spentMinor = liveExpenses.reduce((sum, e) => sum + (computeShares(e).get(me)?.owed ?? 0), 0)

  const planned: PlannedShare[] = []
  let groupPlannedMinor = 0
  let missingEstimates = 0
  for (const item of items.filter(live)) {
    if (logged.has(item.id)) continue
    const people = item.attendee_ids ?? memberIds
    const hasEstimate = item.est_cost_minor != null && item.est_cost_minor > 0 && !!item.est_cost_currency
    if (!hasEstimate) {
      if (COSTLY.has(item.kind) && people.includes(me)) missingEstimates++
      continue
    }
    const rate = rateFor(item.est_cost_currency!, base, snapshot)
    if (!rate || !people.length) continue
    const totalMinor = toBaseMinor(item.est_cost_minor!, item.est_cost_currency!, rate.rate, base)
    groupPlannedMinor += totalMinor
    const at = people.indexOf(me)
    if (at < 0) continue
    const parts = allocate(totalMinor, people.map(() => 1), people.map((m) => `${item.id}:est:${m}`))
    planned.push({ item, totalMinor, shareMinor: parts[at]!, people: people.length })
  }
  planned.sort((a, b) => a.item.start_at.localeCompare(b.item.start_at))
  return { spentMinor, plannedMinor: planned.reduce((s, p) => s + p.shareMinor, 0), planned, missingEstimates, groupPlannedMinor }
}
