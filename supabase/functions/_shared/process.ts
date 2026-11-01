// Turns a Stripe event into database state (docs/PAYMENTS.md). The event only says what to look at:
// the object is always fetched again from Stripe, so duplicate, late or out-of-order deliveries all
// end in the same state. Every database change goes through an idempotent pay_* function.

import type { Stripe, StripeEvent } from './stripe.ts'

export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<unknown>

export interface ProcessDeps {
  stripe: Stripe
  rpc: Rpc
  site: string
}

type Obj = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : null)
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Obj) : null)
const idOf = (v: unknown) => str(v) ?? str(obj(v)?.id)
const dateOf = (seconds: unknown) => (typeof seconds === 'number' ? new Date(seconds * 1000).toISOString().slice(0, 10) : null)
const isoOf = (seconds: unknown) => (typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : new Date().toISOString())

/** Stripe's own fee in a charge's balance transaction (not our application fee). */
export function stripeFeeOf(balanceTransaction: Obj | null): number | null {
  const details = balanceTransaction?.fee_details
  if (!Array.isArray(details)) return null
  return details.filter((d) => (d as Obj).type === 'stripe_fee').reduce((a, d) => a + Number((d as Obj).amount ?? 0), 0)
}

/** Brings one Checkout Session's payment up to date. */
export async function syncSession(sessionId: string, account: string, d: ProcessDeps): Promise<void> {
  const session = await d.stripe.get(`/v1/checkout/sessions/${sessionId}`, { expand: ['payment_intent.latest_charge.balance_transaction'] }, { account })
  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
    const intent = obj(session.payment_intent)
    const charge = obj(intent?.latest_charge)
    await d.rpc('pay_payment_succeeded', {
      p_session_id: sessionId,
      p_payment_intent: idOf(session.payment_intent),
      p_charge: idOf(charge ?? intent?.latest_charge),
      p_stripe_fee: stripeFeeOf(obj(charge?.balance_transaction)),
      p_application_fee_id: idOf(charge?.application_fee),
      p_paid_at: isoOf(charge?.created),
      p_site: d.site,
    })
  } else if (session.status === 'expired') {
    await d.rpc('pay_payment_closed', { p_session_id: sessionId, p_status: 'expired' })
  } else if (session.status === 'complete') {
    // Complete but unpaid: a bank payment on its way (usually about 4 business days).
    await d.rpc('pay_payment_closed', { p_session_id: sessionId, p_status: 'processing' })
  }
}

async function syncRefunds(chargeId: string, account: string, d: ProcessDeps) {
  const charge = await d.stripe.get(`/v1/charges/${chargeId}`, {}, { account })
  const result = await d.rpc('pay_payment_refunded', { p_charge: chargeId, p_refunded_total: Number(charge.amount_refunded ?? 0) }) as
    { application_fee_id: string | null; fee_refund_due: number; fee_refund_total: number }
  if (result.fee_refund_due > 0 && result.application_fee_id) {
    // We give back our 1% on whatever the organizer refunds. Keyed by the running total, so a retry
    // never refunds twice.
    await d.stripe.post(`/v1/application_fees/${result.application_fee_id}/refunds`, { amount: result.fee_refund_due },
      { idempotencyKey: `appfee:${chargeId}:${result.fee_refund_total}` })
  }
  if (result.fee_refund_total > 0) await d.rpc('pay_application_fee_refunded', { p_charge: chargeId, p_fee_refunded_total: result.fee_refund_total })
}

export async function syncAccount(accountId: string, d: ProcessDeps, organizerId: string | null = null) {
  const a = await d.stripe.get(`/v1/accounts/${accountId}`)
  const requirements = obj(a.requirements) ?? {}
  await d.rpc('pay_upsert_account', {
    p_organizer: organizerId,
    p_account_id: accountId,
    p_charges: a.charges_enabled === true,
    p_payouts: a.payouts_enabled === true,
    p_details: a.details_submitted === true,
    p_requirements: {
      currently_due: requirements.currently_due ?? [],
      past_due: requirements.past_due ?? [],
      eventually_due: requirements.eventually_due ?? [],
      current_deadline: requirements.current_deadline ?? null,
      disabled_reason: requirements.disabled_reason ?? null,
    },
    p_disabled_reason: str(requirements.disabled_reason),
    p_schedule: obj(obj(obj(a.settings)?.payouts)?.schedule) ?? {},
    p_country: str(a.country),
    p_currency: str(a.default_currency),
  })
}

/** Handles one webhook event. Unknown types are ignored, not errors. */
export async function processEvent(event: StripeEvent, d: ProcessDeps): Promise<'done' | 'ignored'> {
  const o = event.data.object
  const account = event.account ?? ''
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.expired':
      await syncSession(String(o.id), account, d)
      return 'done'
    case 'checkout.session.async_payment_failed':
      await d.rpc('pay_payment_closed', { p_session_id: String(o.id), p_status: 'failed' })
      return 'done'
    case 'charge.refunded':
    case 'charge.refund.updated':
      await syncRefunds(String(event.type === 'charge.refunded' ? o.id : o.charge), account, d)
      return 'done'
    case 'charge.dispute.created':
    case 'charge.dispute.updated':
    case 'charge.dispute.closed': {
      const dispute = await d.stripe.get(`/v1/disputes/${String(o.id)}`, {}, { account })
      await d.rpc('pay_record_dispute', {
        p_charge: idOf(dispute.charge),
        p_dispute_id: String(dispute.id),
        p_amount: Number(dispute.amount ?? 0),
        p_reason: str(dispute.reason),
        p_status: str(dispute.status),
        p_due_by: typeof obj(dispute.evidence_details)?.due_by === 'number' ? isoOf(obj(dispute.evidence_details)!.due_by) : null,
      })
      return 'done'
    }
    case 'payout.created':
    case 'payout.updated':
    case 'payout.paid':
    case 'payout.failed':
    case 'payout.canceled': {
      const payout = await d.stripe.get(`/v1/payouts/${String(o.id)}`, {}, { account })
      await d.rpc('pay_upsert_payout', {
        p_account_id: account,
        p_payout_id: String(payout.id),
        p_amount: Number(payout.amount ?? 0),
        p_currency: str(payout.currency) ?? 'usd',
        p_arrival: dateOf(payout.arrival_date),
        p_status: str(payout.status),
        p_failure_code: str(payout.failure_code),
        p_failure_message: str(payout.failure_message),
      })
      return 'done'
    }
    case 'account.updated':
      await syncAccount(String(o.id), d)
      return 'done'
    case 'account.application.deauthorized':
      await d.rpc('pay_account_disconnected', { p_account_id: account })
      return 'done'
    default:
      return 'ignored'
  }
}

/** Nightly safety net: re-syncs every Checkout Session an account created since `sinceSeconds`. */
export async function reconcileAccount(account: string, sinceSeconds: number, d: ProcessDeps): Promise<number> {
  let synced = 0
  let startingAfter: string | undefined
  for (;;) {
    const page = await d.stripe.get<{ data: Obj[]; has_more: boolean }>('/v1/checkout/sessions', { limit: 100, created: { gte: sinceSeconds }, starting_after: startingAfter }, { account })
    for (const s of page.data) {
      if (s.metadata && (s.metadata as Obj).booking_id) {
        await syncSession(String(s.id), account, d)
        synced++
      }
    }
    if (!page.has_more || !page.data.length) return synced
    startingAfter = String(page.data[page.data.length - 1]!.id)
  }
}
