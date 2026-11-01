// Refunds the organizer makes from the app (docs/PAYMENTS.md). The tiers only suggest an amount: the
// organizer decides, and Stripe refunds it on their own account. Our 1% comes back through the
// webhook, as for refunds made in the Stripe Dashboard.

export interface RefundTier { days_before: number; percent: number }

/** Whole days from `today` to the trip's start (both YYYY-MM-DD in the trip's zone). */
export function daysBefore(tripStart: string, today: string): number {
  return Math.round((Date.parse(`${tripStart}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

/**
 * What the policy gives back for a cancellation `days` before the trip: the most generous tier
 * whose `days_before` has not yet passed. No tiers, or none that apply, means nothing is suggested.
 */
export function suggestRefund(paid: number, tiers: RefundTier[], days: number): { percent: number; amount: number } {
  const applicable = tiers.filter((t) => days >= t.days_before).sort((a, b) => b.percent - a.percent)
  const percent = applicable[0]?.percent ?? 0
  return { percent, amount: Math.floor((paid * percent) / 100) }
}

/** Spreads a refund across the booking's charges, newest first, never more than each can return. */
export function splitRefund(amount: number, charges: { charge: string; refundable: number }[]): { charge: string; amount: number }[] {
  const out: { charge: string; amount: number }[] = []
  let left = Math.max(0, Math.floor(amount))
  for (const c of charges) {
    if (left <= 0) break
    const take = Math.min(left, c.refundable)
    if (take > 0) out.push({ charge: c.charge, amount: take })
    left -= take
  }
  if (left > 0) throw new Error('That’s more than this booking can refund.')
  return out
}
