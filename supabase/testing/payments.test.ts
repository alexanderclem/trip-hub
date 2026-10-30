// Payments (20261101000001_payments.sql): from publishing a trip page to a payout, as the Edge
// Functions drive it, with the ledger balanced at every step and each person seeing only theirs.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asAnon, asService, asUser, asUserCommit, migratedDb } from './db'
import { T1, U, seed } from './fixtures'

const SITE = 'https://joinstowaway.app'
const account = { anonymous: false }
let pg: PGlite
let token = ''
let bookingId = ''
const one = async <T,>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows[0]!

const offerArgs = (over: Partial<Record<string, unknown>> = {}) => {
  const a = { title: 'Lake Atitlán week', summary: 'Kayaks and coffee farms', price: 150000, deposit: 30000, due: '2027-02-01', capacity: 2, policy: 'Deposit refundable until 60 days before.', fee: 'absorb', bank: true, ...over }
  return [T1, a.title, a.summary, a.price, a.deposit, a.due, a.capacity, a.policy, a.fee, a.bank]
}
const saveOffer = `select (public.save_offer($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10)).*`

beforeAll(async () => {
  pg = await migratedDb()
  await seed(pg)
  await asUserCommit(pg, U.A, async () => {
    await pg.query(`select public.save_organizer('Ana Trips', 'ana@example.com')`)
    await pg.query(`select public.claim_trip('${T1}')`)
  }, account)
}, 60000)
afterAll(async () => { await pg?.close() })

const ledgerSums = async () => {
  const rows = await pg.query<{ account: string; total: string }>(`select account, sum(amount_minor)::text as total from private.ledger_entries group by 1 order by 1`)
  return Object.fromEntries(rows.rows.map((r) => [r.account, Number(r.total)]))
}

describe('setting up a trip page', () => {
  it('lets only the trip’s organizer price it, and checks the numbers', async () => {
    await asUser(pg, U.B, async () => { await expect(pg.query(saveOffer, offerArgs())).rejects.toThrow(/organizer/) })
    await asUser(pg, U.A, async () => { await expect(pg.query(saveOffer, offerArgs({ deposit: 150000 }))).rejects.toThrow(/deposit/) }, account)
    await asUser(pg, U.A, async () => { await expect(pg.query(saveOffer, offerArgs({ due: null }))).rejects.toThrow(/balance is due/) }, account)
    const offer = await asUserCommit(pg, U.A, () => one<{ slug: string; policy_version: number; status: string }>(saveOffer, offerArgs()), account)
    expect(offer).toMatchObject({ slug: 'lake-atitl-n-week', policy_version: 1, status: 'draft' })
  })

  it('publishes only with a Stripe account that can take payments, and shows only checked organizers', async () => {
    await asUser(pg, U.A, async () => { await expect(pg.query(`select public.set_offer_status('${T1}', 'published')`)).rejects.toThrow(/Stripe/) }, account)
    const org = await one<{ id: string }>(`select id from public.organizers where owner_user_id = '${U.A}'`)
    await asService(pg, () => pg.query(`select public.pay_upsert_account($1, 'acct_1', true, true, true, '{}', null, '{"interval":"daily","delay_days":2}', 'US', 'usd')`, [org.id]))
    await asUserCommit(pg, U.A, () => pg.query(`select public.set_offer_status('${T1}', 'published')`), account)
    expect(await asAnon(pg, () => one<{ o: unknown }>(`select public.get_public_offer('lake-atitl-n-week') as o`))).toEqual({ o: null })
    await pg.exec(`update public.organizers set reviewed_at = now()`)
    const page = await asAnon(pg, () => one<{ o: Record<string, unknown> }>(`select public.get_public_offer('lake-atitl-n-week') as o`))
    expect(page.o).toMatchObject({ title: 'Lake Atitlán week', price_minor: 150000, spots_left: 2, organizer: { name: 'Ana Trips' }, trip: { name: 'Trip one' } })
    expect(JSON.stringify(page.o)).not.toMatch(/share_token|trip-one-link-token/)
  })

  it('keeps payment functions away from the app', async () => {
    await asUser(pg, U.A, async () => {
      await expect(pg.query(`select public.pay_reserve_booking('lake-atitl-n-week', '${U.A}', 'x', 'x@example.com', 1)`)).rejects.toThrow(/permission denied/)
    }, account)
    await asAnon(pg, async () => {
      await expect(pg.query(`select public.pay_payment_succeeded('cs', 'pi', 'ch', 1, null, now(), '')`)).rejects.toThrow(/permission denied/)
    })
  })
})

describe('a traveler books and pays', () => {
  it('holds a place, refusing an out-of-date policy', async () => {
    await expect(asService(pg, () => pg.query(`select public.pay_reserve_booking('lake-atitl-n-week', '${U.O}', 'Ola', 'ola@example.com', 2)`))).rejects.toThrow(/policy changed/)
    const r = await asService(pg, () => one<{ r: { booking_id: string; manage_token: string; stripe_account_id: string } }>(`select public.pay_reserve_booking('lake-atitl-n-week', '${U.O}', ' Ola ', 'Ola@Example.com', 1) as r`))
    expect(r.r.stripe_account_id).toBe('acct_1')
    bookingId = r.r.booking_id
    token = r.r.manage_token
    expect(token.length).toBeGreaterThan(30)
    // Trying again within the hold reuses the place, with a fresh link.
    const again = await asService(pg, () => one<{ r: { booking_id: string; manage_token: string } }>(`select public.pay_reserve_booking('lake-atitl-n-week', '${U.O}', 'Ola', 'ola@example.com', 1) as r`))
    expect(again.r.booking_id).toBe(bookingId)
    token = again.r.manage_token
    await asService(pg, () => pg.query(`select public.pay_open_payment($1, 'deposit', 30000, 30000, 300, 'cs_1', now() + interval '30 minutes')`, [bookingId]))
  })

  it('stops at capacity', async () => {
    await asService(pg, () => pg.query(`select public.pay_reserve_booking('lake-atitl-n-week', '${U.X}', 'Xi', 'xi@example.com', 1)`))
    await expect(asService(pg, () => pg.query(`select public.pay_reserve_booking('lake-atitl-n-week', '${U.C}', 'Cy', 'cy@example.com', 1)`))).rejects.toThrow(/full/)
    const full = await asAnon(pg, () => one<{ o: { spots_left: number } }>(`select public.get_public_offer('lake-atitl-n-week') as o`))
    expect(full.o.spots_left).toBe(0)
  })

  it('records the payment once, puts the traveler on the trip, and posts a balanced ledger', async () => {
    const first = await asService(pg, () => one<{ r: { already: boolean } }>(`select public.pay_payment_succeeded('cs_1', 'pi_1', 'ch_1', 900, 'fee_1', now(), '${SITE}') as r`))
    const second = await asService(pg, () => one<{ r: { already: boolean } }>(`select public.pay_payment_succeeded('cs_1', 'pi_1', 'ch_1', 900, 'fee_1', now(), '${SITE}') as r`))
    expect([first.r.already, second.r.already]).toEqual([false, true])
    const b = await one<{ status: string; paid_minor: string; member_id: string }>(`select status, paid_minor::text, member_id from public.bookings where id = $1`, [bookingId])
    expect(b).toMatchObject({ status: 'active', paid_minor: '30000' })
    expect(await one(`select role, member_id from public.trip_devices where trip_id = '${T1}' and user_id = '${U.O}'`)).toEqual({ role: 'member', member_id: b.member_id })
    expect(await ledgerSums()).toEqual({ operator_stripe_balance: 28800, stripe_fees: 900, stowaway_fees: 300, traveler_receivable: -30000 })
    const emails = await pg.query<{ template: string; to_email: string; data: { manage_url: string } }>(`select template, to_email, data from private.email_outbox order by id`)
    expect(emails.rows.map((e) => [e.template, e.to_email])).toEqual([['payment_received', 'ola@example.com'], ['organizer_payment', 'ana@example.com']])
    expect(emails.rows[0]!.data.manage_url).toBe(`${SITE}/b#t=${token}`)
  })

  it('shows the booking to its traveler and the organizer only', async () => {
    await asUser(pg, U.O, async () => { expect((await pg.query(`select id from public.bookings`)).rows).toEqual([{ id: bookingId }]) })
    await asUser(pg, U.A, async () => { expect((await pg.query(`select id from public.bookings order by created_at`)).rows.length).toBe(2) }, account)
    await asUser(pg, U.B, async () => { expect((await pg.query(`select id from public.booking_payments`)).rows).toEqual([]) })
    const viaLink = await asAnon(pg, () => one<{ b: Record<string, unknown> }>(`select public.get_booking($1) as b`, [token]))
    expect(viaLink.b).toMatchObject({ status: 'active', paid_minor: 30000, price_minor: 150000, organizer: { name: 'Ana Trips' } })
    expect(await asAnon(pg, () => one(`select public.get_booking('wrong') as b`))).toEqual({ b: null })
    const due = await asService(pg, () => one<{ d: { due_minor: number } }>(`select public.pay_booking_due($1) as d`, [token]))
    expect(due.d.due_minor).toBe(120000)
  })

  it('pays the balance and completes the booking', async () => {
    await asService(pg, async () => {
      await pg.query(`select public.pay_open_payment($1, 'balance', 120000, 120000, 1200, 'cs_2', now() + interval '30 minutes')`, [bookingId])
      await pg.query(`select public.pay_payment_closed('cs_2', 'processing')`)
      await pg.query(`select public.pay_payment_succeeded('cs_2', 'pi_2', 'ch_2', 500, 'fee_2', now(), '${SITE}')`)
    })
    expect(await one(`select status, paid_minor::int from public.bookings where id = $1`, [bookingId])).toEqual({ status: 'paid', paid_minor: 150000 })
  })
})

describe('after payment', () => {
  it('records refunds, returns our fee pro rata, and keeps the ledger balanced', async () => {
    const part = await asService(pg, () => one<{ r: { fee_refund_due: number; application_fee_id: string } }>(`select public.pay_payment_refunded('ch_1', 10000) as r`))
    expect(part.r).toMatchObject({ fee_refund_due: 100, application_fee_id: 'fee_1' })
    // Retried before our fee refund went through: same answer, nothing posted twice.
    const retry = await asService(pg, () => one<{ r: { fee_refund_due: number } }>(`select public.pay_payment_refunded('ch_1', 10000) as r`))
    expect(retry.r.fee_refund_due).toBe(100)
    await asService(pg, () => pg.query(`select public.pay_application_fee_refunded('ch_1', 100)`))
    const done = await asService(pg, () => one<{ r: { fee_refund_due: number } }>(`select public.pay_payment_refunded('ch_1', 10000) as r`))
    expect(done.r.fee_refund_due).toBe(0)
    expect(await one(`select status, refunded_minor::int from public.booking_payments where stripe_charge_id = 'ch_1'`)).toEqual({ status: 'partially_refunded', refunded_minor: 10000 })
    const sums = await ledgerSums()
    expect(sums.refunds).toBe(10000)
    expect(sums.stowaway_fees).toBe(300 + 1200 - 100)
    expect(Object.values(sums).reduce((a, n) => a + n, 0)).toBe(0)
  })

  it('posts paid payouts and emails the organizer about failed ones', async () => {
    await asService(pg, async () => {
      await pg.query(`select public.pay_upsert_payout('acct_1', 'po_1', 50000, 'usd', '2027-01-10', 'paid', null, null)`)
      await pg.query(`select public.pay_upsert_payout('acct_1', 'po_1', 50000, 'usd', '2027-01-10', 'paid', null, null)`)
      await pg.query(`select public.pay_upsert_payout('acct_1', 'po_2', 7000, 'usd', '2027-01-11', 'failed', 'account_closed', 'The bank account has been closed')`)
    })
    const sums = await ledgerSums()
    expect(sums.operator_bank).toBe(50000)
    expect(await one(`select count(*)::int as n from private.email_outbox where template = 'payout_failed'`)).toEqual({ n: 1 })
    await asUser(pg, U.A, async () => { expect((await pg.query(`select stripe_payout_id from public.payouts order by 1`)).rows.length).toBe(2) }, account)
    await asUser(pg, U.B, async () => { expect((await pg.query(`select * from public.payouts`)).rows).toEqual([]) })
  })

  it('refuses an unbalanced ledger entry', async () => {
    await expect(pg.exec(`begin; insert into private.ledger_entries (txn_id, organizer_id, account, amount_minor, source)
      values (gen_random_uuid(), gen_random_uuid(), 'stripe_fees', 5, 'bad'); commit;`)).rejects.toThrow(/does not balance/)
    await pg.exec('rollback').catch(() => {})
  })

  it('sends balance reminders 7 days out, once', async () => {
    // Still full: Xi holds the second place.
    await expect(asService(pg, () => pg.query(`select public.pay_reserve_booking('lake-atitl-n-week', '${U.C}', 'Cy', 'cy@example.com', 1)`))).rejects.toThrow(/full/)
    await pg.exec(`update public.bookings set status = 'active', paid_minor = 30000, balance_due_date = (now() at time zone 'America/Guatemala')::date + 7 where traveler_name = 'Xi'`)
    const n1 = await asService(pg, () => one<{ n: number }>(`select public.pay_enqueue_reminders('${SITE}') as n`))
    await asService(pg, () => pg.query(`select public.pay_enqueue_reminders('${SITE}')`))
    expect(n1.n).toBe(1)
    expect(await one(`select count(*)::int as n from private.email_outbox where template = 'balance_reminder'`)).toEqual({ n: 1 })
  })

  it('does not change who sees what in the trip itself (group mode)', async () => {
    await asUser(pg, U.B, async () => { expect((await pg.query(`select id from public.trip_offers`)).rows.length).toBe(1) })
  })
})
