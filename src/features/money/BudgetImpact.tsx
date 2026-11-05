import { useMemo } from 'react'
import { useMembers } from '@/data/hooks'
import type { ItineraryItem } from '@/data/types'
import { useItems } from '@/features/itinerary/data'
import { formatMoney } from '@/lib/money'
import { useMoney } from './data'
import { forecast } from './forecast'
import { usePersonalBudget } from './BudgetSummary'
import { budgetPosition } from './budget'

/** Replaces the edited estimate in the forecast; it never counts it twice or changes a balance. */
export function BudgetImpact({ tripId, me, base, itemId, costMinor, costCurrency, attendees, status }: {
  tripId: string; me: string | null; base: string; itemId: string; costMinor: number | null; costCurrency: string; attendees: string[] | null; status: ItineraryItem['status']
}) {
  const budget = usePersonalBudget(tripId, me, base)
  const items = useItems(tripId)
  const money = useMoney(tripId)
  const members = useMembers(tripId)
  const result = useMemo(() => {
    if (!me || !items || !money || !members) return null
    const candidate: ItineraryItem = {
      id: itemId, trip_id: tripId, title: 'This activity', kind: 'activity', place_id: null, to_place_id: null,
      start_local: '', start_tz: 'UTC', start_at: '', end_at: null, end_local: null, end_tz: null, all_day: false,
      confirmation_code: null, notes: null, details: {}, ...items.find((item) => item.id === itemId),
      attendee_ids: attendees, est_cost_minor: costMinor, est_cost_currency: costCurrency, status,
    }
    const options = { expenses: money.expenses, memberIds: members.map((m) => m.id), me, base, snapshot: money.snapshot }
    const before = forecast({ ...options, items })
    const after = forecast({ ...options, items: [...items.filter((item) => item.id !== itemId), candidate] })
    return { total: after.spentMinor + after.plannedMinor, delta: after.spentMinor + after.plannedMinor - before.spentMinor - before.plannedMinor, share: after.planned.find((p) => p.item.id === itemId)?.shareMinor, missing: after.missingEstimates, logged: money.expenses.some((expense) => expense.item_id === itemId) }
  }, [me, items, money, members, itemId, tripId, attendees, costMinor, costCurrency, status, base])
  if (!result || (!budget && costMinor === null)) return null
  const position = budget ? budgetPosition(result.total, budget.amountMinor) : null
  return <section aria-label="Your budget impact" className="border-t border-line pt-3 text-sm" aria-live="polite">
    <h3 className="font-semibold">Your cost{budget ? ' & budget' : ''}</h3>
    {result.share !== undefined && <p className="mt-1 tabular-nums">Your estimated share: ≈ {formatMoney(result.share, base)}</p>}
    {result.logged ? <p className="mt-1 text-muted">A logged expense already replaces this activity’s estimate.</p> : attendees && me && !attendees.includes(me) ? <p className="mt-1 text-muted">You’re not included in this cost.</p> : costMinor === null && <p className="mt-1 text-muted">Add an estimated cost to include this activity.</p>}
    {!result.logged && result.share === undefined && costMinor !== null && status !== 'cancelled' && (!attendees || me && attendees.includes(me)) && <p className="mt-1 text-warning-ink">This estimate cannot be converted with saved exchange rates.</p>}
    {budget && position && <>
      <p className="mt-1 tabular-nums">Trip total after saving: ≈ {formatMoney(result.total, base)}{result.delta !== 0 ? ` (${result.delta > 0 ? '+' : '−'}${formatMoney(Math.abs(result.delta), base)})` : ''}</p>
      <p className={`mt-1 tabular-nums ${position.over ? 'text-danger-ink' : 'text-ink'}`}>≈ {formatMoney(Math.abs(position.remainingMinor), base)} {position.over ? 'over your budget' : 'left in your budget'}{result.missing ? ' before unpriced plans' : ''}</p>
      <p className="mt-1 text-xs text-muted">Your budget is private to this phone. Estimates use saved exchange rates.</p>
    </>}
  </section>
}
