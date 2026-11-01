// Phase 2c (20261104000002_referrals.sql): referral codes, a credit for the referrer once the referred
// booking is paid, applied to the referrer's next booking as a discount, and given back if unused.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asAnon, asService, asUser, asUserCommit, migratedDb } from './db'
import { T1, U, seed } from './fixtures'

const account = { anonymous: false }
let pg: PGlite
const one = async <T,>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows[0]!
const asAna = <T,>(fn: () => Promise<T>) => asUserCommit(pg, U.A, fn, account)
type Reserved = { r: { booking_id: string; manage_token: string; price_minor: number } }
const reserve = (name: string, email: string, extra: unknown = {}) =>
  asService(pg, () => one<Reserved>(`select public.pay_reserve_booking('lake-week', $1, $2, $3, 1, $4::jsonb) as r`,
    [crypto.randomUUID(), name, email, JSON.stringify(extra)]))
async function pay(booking: string, session: string, amount = 30000) {
  await asService(pg, async () => {
    await pg.query(`select public.pay_open_payment($1, 'deposit', $2, $2, 300, $3, null)`, [booking, amount, session])
    await pg.query(`select public.pay_payment_succeeded($1, 'pi', $2, 900, null, now(), 'https://joinstowaway.app')`, [session, `ch_${session}`])
  })
}

beforeAll(async () => {
  pg = await migratedDb()
  await seed(pg)
  await asAna(async () => {
    await pg.query(`select public.save_organizer('Ana Trips', 'ana@example.com')`)
    await pg.query(`select public.claim_trip('${T1}')`)
    await pg.query(`select public.save_offer('${T1}', 'Lake week', '', 150000, 30000, '2027-02-01', 10, 'Refundable until 60 days out.', 'absorb', false)`)
    await pg.query(`select public.save_offer_plan('${T1}', $1::jsonb, '[]')`, [JSON.stringify([{ due_date: '2099-01-01', amount_minor: 60000 }, { due_date: '2099-02-01', amount_minor: 60000 }])])
  })
  await pg.exec(`update public.organizers set reviewed_at = now()`)
  const org = (await one<{ id: string }>(`select id from public.organizers`)).id
  await asService(pg, () => pg.query(`select public.pay_upsert_account($1, 'acct_1', true, true, true, '{}', null, '{}', 'US', 'usd')`, [org]))
  await asAna(() => pg.query(`select public.set_offer_status('${T1}', 'published')`))
}, 60000)
afterAll(async () => { await pg?.close() })

let olaCode = ''
let olaToken = ''

describe('referral credits', () => {
  it('give every past traveler a code, shown on their booking page once credits are on', async () => {
    const ola = await reserve('Ola', 'ola@example.com')
    olaToken = ola.r.manage_token
    await pay(ola.r.booking_id, 'cs_ola')
    olaCode = (await one<{ referral_code: string }>(`select referral_code from public.organizer_contacts where email = 'ola@example.com'`)).referral_code
    expect(olaCode).toMatch(/^[0-9A-F]{8}$/)
    expect((await asAnon(pg, () => one<{ b: { referral: unknown } }>(`select public.get_booking($1) as b`, [olaToken]))).b.referral).toBeNull()
    await expect(asUser(pg, U.B, () => pg.query(`select public.save_referral_settings(5000)`))).rejects.toThrow(/Pro/)
    await asAna(() => pg.query(`select public.save_referral_settings(5000)`))
    expect((await asAnon(pg, () => one<{ b: { referral: unknown } }>(`select public.get_booking($1) as b`, [olaToken]))).b.referral).toEqual({ code: olaCode, credit_minor: 5000 })
  })

  it('credit the referrer once, when the referred booking is paid, and never for referring yourself', async () => {
    const self = await reserve('Ola again', 'OLA@example.com', { ref: olaCode.toLowerCase() })
    expect(await one(`select referred_by from public.bookings where id = $1`, [self.r.booking_id])).toEqual({ referred_by: null })
    await pg.exec(`update public.bookings set status = 'expired' where id = '${self.r.booking_id}'`)
    const pat = await reserve('Pat', 'pat@example.com', { ref: olaCode.toLowerCase() })
    expect((await pg.query(`select 1 from public.referral_credits`)).rows).toHaveLength(0) // a hold isn't a booking yet
    await pay(pat.r.booking_id, 'cs_pat')
    await pay(pat.r.booking_id, 'cs_pat2', 20000) // a later payment doesn't earn another
    expect((await pg.query<{ amount_minor: string }>(`select amount_minor from public.referral_credits`)).rows.map((r) => Number(r.amount_minor))).toEqual([5000])
    expect((await asUser(pg, U.A, () => pg.query(`select 1 from public.referral_credits`), account)).rows).toHaveLength(1)
    expect((await asUser(pg, U.B, () => pg.query(`select 1 from public.referral_credits`))).rows).toHaveLength(0)
  })

  it('takes the credit off the referrer’s next booking, from the last payments, and gives it back if unused', async () => {
    const next = await reserve('Ola', 'ola@example.com')
    expect(next.r.price_minor).toBe(145000)
    const b = await one<{ credit_minor: string; schedule: { amount_minor: number }[] }>(`select credit_minor, schedule from public.bookings where id = $1`, [next.r.booking_id])
    expect(Number(b.credit_minor)).toBe(5000)
    expect(b.schedule.map((s) => s.amount_minor)).toEqual([60000, 55000]) // still adds up: 30000 + 60000 + 55000
    expect(await one(`select count(*)::int as n from public.referral_credits where used_booking_id is not null`)).toEqual({ n: 1 })
    await pg.exec(`update public.bookings set status = 'expired' where id = '${next.r.booking_id}'`)
    expect(await one(`select count(*)::int as n from public.referral_credits where used_booking_id is null`)).toEqual({ n: 1 })
  })
})
