// The payment path end to end, against the real migrations in PGlite and a fake Stripe that serves
// recorded-shape objects: hold a place, build the Checkout Session, receive signed webhooks (twice,
// and out of order), and check the database, refunds of our fee, payouts and account updates.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asService, asUserCommit, migratedDb } from '../../testing/db'
import { T1, U, seed } from '../../testing/fixtures'
import { checkoutSession, firstPayment } from './checkout.ts'
import { processEvent, reconcileAccount, type ProcessDeps } from './process.ts'
import { signForTest, verifyWebhook, type Stripe } from './stripe.ts'

const SITE = 'https://joinstowaway.app'
let pg: PGlite

/** pay_* calls as the Edge Functions make them, with named arguments. */
const rpc = async (fn: string, args: Record<string, unknown>) => {
  const names = Object.keys(args)
  const sql = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`
  return asService(pg, async () => (await pg.query<{ r: unknown }>(sql, names.map((n) => {
    const v = args[n]
    return v !== null && typeof v === 'object' ? JSON.stringify(v) : v
  }))).rows[0]?.r)
}

/** A Stripe that answers from a table of objects and records what was posted. */
function fakeStripe(objects: Record<string, Record<string, unknown>>) {
  const posted: { path: string; params: Record<string, unknown>; key?: string; account?: string }[] = []
  const stripe = {
    get: async (path: string) => {
      const found = objects[path]
      if (!found) throw new Error(`No fixture for ${path}`)
      return found
    },
    post: async (path: string, params: Record<string, unknown> = {}, options: { idempotencyKey?: string; account?: string } = {}) => {
      posted.push({ path, params, key: options.idempotencyKey, account: options.account })
      return { id: 'fr_1' }
    },
  } as unknown as Stripe
  return { stripe, posted }
}

let bookingId = ''
let token = ''

beforeAll(async () => {
  pg = await migratedDb()
  await seed(pg)
  await asUserCommit(pg, U.A, async () => {
    await pg.query(`select public.save_organizer('Ana Trips', 'ana@example.com')`)
    await pg.query(`select public.claim_trip('${T1}')`)
    await pg.query(`select public.save_offer('${T1}', 'Lake week', '', 150000, 30000, '2027-02-01', 10, 'Refundable until 60 days out.', 'pass', true)`)
  }, { anonymous: false })
  await pg.exec(`update public.organizers set reviewed_at = now()`)
  const org = (await pg.query<{ id: string }>(`select id from public.organizers`)).rows[0]!.id
  await rpc('pay_upsert_account', { p_organizer: org, p_account_id: 'acct_1', p_charges: true, p_payouts: true, p_details: true, p_requirements: {}, p_disabled_reason: null, p_schedule: {}, p_country: 'US', p_currency: 'usd' })
  await asUserCommit(pg, U.A, () => pg.query(`select public.set_offer_status('${T1}', 'published')`), { anonymous: false })
}, 60000)
afterAll(async () => { await pg?.close() })

describe('checkout', () => {
  it('builds a direct charge with our 1% and a separate booking fee line', async () => {
    const r = await rpc('pay_reserve_booking', { p_slug: 'lake-week', p_user: U.O, p_name: 'Ola', p_email: 'ola@example.com', p_policy_version: 1 }) as
      { booking_id: string; manage_token: string; price_minor: number; deposit_minor: number }
    bookingId = r.booking_id
    token = r.manage_token
    const first = firstPayment(r.price_minor, r.deposit_minor)
    expect(first).toEqual({ kind: 'deposit', base: 30000 })
    const s = checkoutSession({ bookingId, kind: first.kind, base: first.base, title: 'Lake week', feeMode: 'pass', allowBank: true, email: 'ola@example.com', site: SITE, slug: 'lake-week', token, nowSeconds: 1_800_000_000 })
    const items = s.params.line_items as { price_data: { unit_amount: number; product_data: { name: string } } }[]
    expect(items.map((i) => [i.price_data.product_data.name, i.price_data.unit_amount])).toEqual([['Lake week: deposit', 30000], ['Booking fee', s.charged - 30000]])
    expect(s.applicationFee).toBe(Math.round(s.charged * 0.01))
    expect(s.params.payment_method_types).toEqual(['card', 'us_bank_account'])
    expect(s.params.success_url).toBe(`${SITE}/go/lake-week/booked#t=${token}`)
    expect(s.idempotencyKey).toBe(checkoutSession({ ...{ bookingId, kind: first.kind, base: first.base, title: 'x', feeMode: 'pass', allowBank: true, email: 'e', site: SITE, slug: 'lake-week', token, nowSeconds: 1_800_000_100 } }).idempotencyKey)
    await rpc('pay_open_payment', { p_booking: bookingId, p_kind: 'deposit', p_base: 30000, p_charged: s.charged, p_app_fee: s.applicationFee, p_session_id: 'cs_1', p_expires_at: new Date(Date.now() + 1800_000).toISOString() })
  })
})

describe('webhooks', () => {
  const objects: Record<string, Record<string, unknown>> = {}
  const deps = (): ProcessDeps & { posted: ReturnType<typeof fakeStripe>['posted'] } => {
    const f = fakeStripe(objects)
    return { stripe: f.stripe, rpc, site: SITE, posted: f.posted }
  }
  const event = (type: string, object: Record<string, unknown>, account = 'acct_1') => ({ id: `evt_${type}_${Math.random()}`, type, account, created: 1, data: { object } })

  it('verifies, then records a paid deposit once, however often Stripe repeats it', async () => {
    const charged = (await pg.query<{ charged_minor: string }>(`select charged_minor::text from public.booking_payments where stripe_checkout_session_id = 'cs_1'`)).rows[0]!.charged_minor
    objects['/v1/checkout/sessions/cs_1'] = {
      id: 'cs_1', status: 'complete', payment_status: 'paid',
      payment_intent: { id: 'pi_1', latest_charge: { id: 'ch_1', created: 1_800_000_050, application_fee: 'fee_1', balance_transaction: { fee_details: [{ type: 'stripe_fee', amount: 1000 }, { type: 'application_fee', amount: 300 }] } } },
    }
    const payload = JSON.stringify(event('checkout.session.completed', { id: 'cs_1' }))
    const verified = await verifyWebhook(payload, await signForTest(payload, 'whsec_c', 1_800_000_060), ['whsec_p', 'whsec_c'], 1_800_000_060)
    const d = deps()
    expect(await processEvent(verified, d)).toBe('done')
    expect(await processEvent(verified, d)).toBe('done')
    expect(await processEvent(event('checkout.session.async_payment_succeeded', { id: 'cs_1' }), d)).toBe('done')
    const b = (await pg.query(`select status, paid_minor::int from public.bookings where id = $1`, [bookingId])).rows[0]
    expect(b).toEqual({ status: 'active', paid_minor: 30000 })
    const p = (await pg.query(`select status, stripe_fee_minor::int, stripe_application_fee_id from public.booking_payments where stripe_checkout_session_id = 'cs_1'`)).rows[0]
    expect(p).toEqual({ status: 'succeeded', stripe_fee_minor: 1000, stripe_application_fee_id: 'fee_1' })
    const ledger = (await pg.query<{ s: string }>(`select sum(amount_minor)::text as s from private.ledger_entries`)).rows[0]!.s
    expect(ledger).toBe('0')
    const income = (await pg.query<{ s: string }>(`select sum(amount_minor)::text as s from private.ledger_entries where account = 'booking_fee_income'`)).rows[0]!.s
    expect(-Number(income)).toBe(Number(charged) - 30000)
    expect((await pg.query(`select role from public.trip_devices where user_id = '${U.O}'`)).rows).toEqual([{ role: 'member' }])
  })

  it('marks a bank payment as processing, then a failure gives the place back', async () => {
    await rpc('pay_reserve_booking', { p_slug: 'lake-week', p_user: U.X, p_name: 'Xi', p_email: 'xi@example.com', p_policy_version: 1 })
    const xi = (await pg.query<{ id: string }>(`select id from public.bookings where traveler_name = 'Xi'`)).rows[0]!.id
    await rpc('pay_open_payment', { p_booking: xi, p_kind: 'deposit', p_base: 30000, p_charged: 31000, p_app_fee: 310, p_session_id: 'cs_2', p_expires_at: null })
    objects['/v1/checkout/sessions/cs_2'] = { id: 'cs_2', status: 'complete', payment_status: 'unpaid' }
    await processEvent(event('checkout.session.completed', { id: 'cs_2' }), deps())
    expect((await pg.query(`select status from public.booking_payments where stripe_checkout_session_id = 'cs_2'`)).rows).toEqual([{ status: 'processing' }])
    await processEvent(event('checkout.session.async_payment_failed', { id: 'cs_2' }), deps())
    expect((await pg.query(`select status from public.bookings where id = $1`, [xi])).rows).toEqual([{ status: 'expired' }])
  })

  it('gives our 1% back on a refund, once, at the platform level', async () => {
    objects['/v1/charges/ch_1'] = { id: 'ch_1', amount_refunded: 15000 }
    const d = deps()
    await processEvent(event('charge.refunded', { id: 'ch_1' }), d)
    await processEvent(event('charge.refund.updated', { id: 're_1', charge: 'ch_1' }), d)
    expect(d.posted).toHaveLength(1)
    expect(d.posted[0]).toMatchObject({ path: '/v1/application_fees/fee_1/refunds', key: expect.stringMatching(/^appfee:ch_1:/), account: undefined })
    const fee = (await pg.query<{ application_fee_minor: string; application_fee_refunded_minor: string; charged_minor: string }>(`select application_fee_minor::text, application_fee_refunded_minor::text, charged_minor::text from public.booking_payments where stripe_charge_id = 'ch_1'`)).rows[0]!
    expect(Number(fee.application_fee_refunded_minor)).toBe(Math.round(Number(fee.application_fee_minor) * 15000 / Number(fee.charged_minor)))
    expect(d.posted[0]!.params.amount).toBe(Number(fee.application_fee_refunded_minor))
  })

  it('mirrors payouts, disputes and account changes', async () => {
    objects['/v1/payouts/po_1'] = { id: 'po_1', amount: 25000, currency: 'usd', arrival_date: 1_800_172_800, status: 'paid' }
    objects['/v1/disputes/dp_1'] = { id: 'dp_1', charge: 'ch_1', amount: 15000, reason: 'fraudulent', status: 'needs_response', evidence_details: { due_by: 1_801_000_000 } }
    objects['/v1/accounts/acct_1'] = { id: 'acct_1', charges_enabled: true, payouts_enabled: false, details_submitted: true, country: 'US', default_currency: 'usd',
      requirements: { currently_due: ['individual.verification.document'], disabled_reason: 'requirements.past_due', current_deadline: 1_801_000_000 }, settings: { payouts: { schedule: { interval: 'daily', delay_days: 2 } } } }
    const d = deps()
    await processEvent(event('payout.paid', { id: 'po_1' }), d)
    await processEvent(event('charge.dispute.created', { id: 'dp_1' }), d)
    await processEvent(event('account.updated', { id: 'acct_1' }, ''), d)
    expect((await pg.query(`select status, arrival_date::text from public.payouts`)).rows).toEqual([{ status: 'paid', arrival_date: '2027-01-17' }])
    expect((await pg.query(`select status from public.disputes`)).rows).toEqual([{ status: 'needs_response' }])
    const acct = (await pg.query<{ payouts_enabled: boolean; disabled_reason: string; payout_schedule: unknown }>(`select payouts_enabled, disabled_reason, payout_schedule from public.stripe_accounts`)).rows[0]!
    expect(acct).toEqual({ payouts_enabled: false, disabled_reason: 'requirements.past_due', payout_schedule: { interval: 'daily', delay_days: 2 } })
    expect(await processEvent(event('customer.created', { id: 'cus_1' }), d)).toBe('ignored')
    await processEvent(event('account.application.deauthorized', { id: 'ca_1' }), d)
    expect((await pg.query(`select charges_enabled, disconnected_at is not null as gone from public.stripe_accounts`)).rows).toEqual([{ charges_enabled: false, gone: true }])
  })

  it('reconciles sessions a webhook never delivered', async () => {
    const d = deps()
    const listing = { data: [{ id: 'cs_1', metadata: { booking_id: bookingId } }, { id: 'cs_other', metadata: {} }], has_more: false }
    d.stripe.get = (async (path: string) => (path === '/v1/checkout/sessions' ? listing : objects[path])) as Stripe['get']
    expect(await reconcileAccount('acct_1', 0, d)).toBe(1)
  })
})
