// What an organizer pays to collect money through Stowaway, and what they keep (docs/PLAN_THE_SWITCH.md,
// sections 4 and 6). Used by the pricing page's calculator now, and by the trip offer form in 1C, so
// the number shown before anyone pays is the same everywhere. Amounts are integer cents (USD).
//
// Stowaway takes a flat 1% of every charge. Stripe's fee is the organizer's own Stripe account's
// fee: the standard US rates below are a published starting point, not a promise.

/** Stripe's standard US pricing, as published on stripe.com/pricing. Check before relying on it. */
export const STRIPE_US = {
  asOf: '2026-10-30',
  source: 'https://stripe.com/pricing',
  cardPercent: 0.029,
  cardFixed: 30,
  internationalCardExtraPercent: 0.015,
  achPercent: 0.008,
  achCap: 500,
} as const

export const STOWAWAY_PERCENT = 0.01

export type PayMethod = 'card' | 'ach'
/** absorb: the organizer pays the fees out of the trip price. pass: travelers pay a booking fee on top. */
export type FeeMode = 'absorb' | 'pass'

export interface QuoteInput {
  /** The trip price per traveler, in cents. */
  price: number
  travelers: number
  /** Paid first; the rest is the balance. 0, or the whole price, means one payment. */
  deposit: number
  method: PayMethod
  /** Share of card payments from cards issued outside the US (0 to 1). Ignored for bank payments. */
  internationalShare: number
  feeMode: FeeMode
}

export interface ChargeQuote {
  label: 'Deposit' | 'Balance' | 'Full payment'
  /** What the organizer set (part of the trip price). */
  base: number
  /** The booking fee travelers pay on top (pass mode only). */
  bookingFee: number
  /** What one traveler is charged. */
  charged: number
  stripeFee: number
  stowawayFee: number
  /** What reaches the organizer's Stripe balance. */
  kept: number
}

export interface Quote {
  charges: ChargeQuote[]
  perTraveler: { charged: number; stripeFee: number; stowawayFee: number; kept: number }
  total: { charged: number; stripeFee: number; stowawayFee: number; kept: number }
}

export function stripeFee(amount: number, method: PayMethod, internationalShare = 0): number {
  if (amount <= 0) return 0
  if (method === 'ach') return Math.min(STRIPE_US.achCap, Math.round(amount * STRIPE_US.achPercent))
  const share = Math.min(1, Math.max(0, internationalShare))
  return Math.round(amount * (STRIPE_US.cardPercent + share * STRIPE_US.internationalCardExtraPercent)) + STRIPE_US.cardFixed
}

export const stowawayFee = (amount: number) => (amount <= 0 ? 0 : Math.round(amount * STOWAWAY_PERCENT))

function charge(label: ChargeQuote['label'], base: number, input: QuoteInput): ChargeQuote {
  const keepOf = (charged: number) => charged - stripeFee(charged, input.method, input.internationalShare) - stowawayFee(charged)
  let charged = base
  if (input.feeMode === 'pass' && base > 0) {
    // The smallest charge that still leaves the organizer the whole base.
    while (keepOf(charged) < base) charged += Math.max(1, base - keepOf(charged))
    while (charged > base && keepOf(charged - 1) >= base) charged -= 1
  }
  const fee = stripeFee(charged, input.method, input.internationalShare)
  const ours = stowawayFee(charged)
  return { label, base, bookingFee: charged - base, charged, stripeFee: fee, stowawayFee: ours, kept: charged - fee - ours }
}

export function quote(input: QuoteInput): Quote {
  const price = Math.max(0, Math.round(input.price))
  const travelers = Math.max(0, Math.floor(input.travelers))
  const deposit = Math.min(price, Math.max(0, Math.round(input.deposit)))
  const charges = deposit > 0 && deposit < price
    ? [charge('Deposit', deposit, input), charge('Balance', price - deposit, input)]
    : [charge('Full payment', price, input)]
  const sum = (key: 'charged' | 'stripeFee' | 'stowawayFee' | 'kept') => charges.reduce((a, c) => a + c[key], 0)
  const perTraveler = { charged: sum('charged'), stripeFee: sum('stripeFee'), stowawayFee: sum('stowawayFee'), kept: sum('kept') }
  return {
    charges,
    perTraveler,
    total: {
      charged: perTraveler.charged * travelers,
      stripeFee: perTraveler.stripeFee * travelers,
      stowawayFee: perTraveler.stowawayFee * travelers,
      kept: perTraveler.kept * travelers,
    },
  }
}
