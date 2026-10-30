// The Stripe Checkout Session for one payment on a booking: a direct charge on the organizer's own
// Stripe account with Stowaway's 1% as the application fee. The booking fee (pass mode) is its own
// line, the same for every payment method, so it is never a card surcharge.

import { quote, stowawayFee, type FeeMode } from './fees.ts'

export type PaymentKind = 'deposit' | 'balance' | 'full'

export interface CheckoutInput {
  bookingId: string
  kind: PaymentKind
  /** The part of the trip price this payment covers, in cents. */
  base: number
  title: string
  feeMode: FeeMode
  allowBank: boolean
  email: string
  site: string
  slug: string
  /** The booking's private link token; it rides in the URL fragment, which never reaches a server. */
  token: string
  nowSeconds: number
}

const LABEL: Record<PaymentKind, string> = { deposit: 'Deposit', balance: 'Balance', full: 'Trip' }
/** Stripe's shortest allowed session lifetime; the place is held a little longer (35 min). */
export const SESSION_SECONDS = 30 * 60

export function checkoutSession(input: CheckoutInput) {
  // The booking fee is worked out for cards, the dearer method, and charged the same either way.
  const c = quote({ price: input.base, travelers: 1, deposit: 0, method: 'card', internationalShare: 0, feeMode: input.feeMode }).charges[0]!
  const applicationFee = stowawayFee(c.charged)
  const expiresAt = input.nowSeconds + SESSION_SECONDS
  const lineItems: Record<string, unknown>[] = [
    { quantity: 1, price_data: { currency: 'usd', unit_amount: input.base, product_data: { name: `${input.title}: ${LABEL[input.kind].toLowerCase()}` } } },
  ]
  if (c.bookingFee > 0) {
    lineItems.push({ quantity: 1, price_data: { currency: 'usd', unit_amount: c.bookingFee, product_data: { name: 'Booking fee' } } })
  }
  const params = {
    mode: 'payment',
    customer_email: input.email,
    client_reference_id: input.bookingId,
    line_items: lineItems,
    payment_method_types: input.allowBank ? ['card', 'us_bank_account'] : ['card'],
    payment_intent_data: {
      application_fee_amount: applicationFee,
      description: `${input.title}: ${LABEL[input.kind].toLowerCase()}`,
      metadata: { booking_id: input.bookingId, kind: input.kind },
    },
    metadata: { booking_id: input.bookingId, kind: input.kind },
    success_url: `${input.site}/go/${input.slug}/booked#t=${input.token}`,
    cancel_url: `${input.site}/go/${input.slug}`,
    expires_at: expiresAt,
  }
  return {
    params,
    charged: c.charged,
    applicationFee,
    expiresAt,
    // The same payment asked for twice within one session's lifetime gets the same session.
    idempotencyKey: `checkout:${input.bookingId}:${input.kind}:${input.base}:${Math.floor(input.nowSeconds / SESSION_SECONDS)}`,
  }
}

/** What the first payment on a booking is: the deposit, or the whole price when there is none. */
export function firstPayment(price: number, deposit: number): { kind: PaymentKind; base: number } {
  return deposit > 0 && deposit < price ? { kind: 'deposit', base: deposit } : { kind: 'full', base: price }
}
