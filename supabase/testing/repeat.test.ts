// Phase 2a (20261102000002_repeat_business.sql): running a trip again, installments, refunds,
// the policy a traveler accepted, money per trip, and invite links per role.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asAnon, asService, asUser, asUserCommit, migratedDb } from './db'
import { P, T1, U, seed } from './fixtures'

const account = { anonymous: false }
const SITE = 'https://joinstowaway.app'
let pg: PGlite
const one = async <T,>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows[0]!
const asAna = <T,>(fn: () => Promise<T>) => asUserCommit(pg, U.A, fn, account)

beforeAll(async () => {
  pg = await migratedDb()
  await seed(pg)
  await pg.exec(`update public.trips set start_date = '2027-03-10', end_date = '2027-03-17', timezone = 'America/Guatemala' where id = '${T1}';
    insert into public.itinerary_items (id, trip_id, title, kind, place_id, start_local, start_tz, status)
      values ('00000000-0000-4000-a000-000000000001', '${T1}', 'Flight to NYC', 'flight', '${P.p1}', '2027-03-13 09:00', 'America/New_York', 'confirmed');`)
  await asAna(async () => {
    await pg.query(`select public.save_organizer('Ana Trips', 'ana@example.com')`)
    await pg.query(`select public.claim_trip('${T1}')`)
    await pg.query(`select public.save_offer('${T1}', 'Lake week', '', 150000, 30000, '2027-02-01', 3, 'Refundable until 60 days out.', 'absorb', false)`)
  })
  await pg.exec(`update public.organizers set reviewed_at = now()`)
  const org = await one<{ id: string }>(`select id from public.organizers`)
  await asService(pg, () => pg.query(`select public.pay_upsert_account($1, 'acct_1', true, true, true, '{}', null, '{}', 'US', 'usd')`, [org.id]))
  await asAna(() => pg.query(`select public.set_offer_status('${T1}', 'published')`))
}, 60000)
afterAll(async () => { await pg?.close() })

describe('running a trip again', () => {
  let copy = ''
  it('only for the trip’s organizer, and only with Pro', async () => {
    await asUser(pg, U.B, async () => { await expect(pg.query(`select public.clone_trip('${T1}', 'Lake week 2028', '2028-03-10')`)).rejects.toThrow(/organizer/) })
    await pg.exec(`update private.app_settings set value = 'false' where key = 'pro_free_beta'`)
    await asUser(pg, U.A, async () => { await expect(pg.query(`select public.clone_trip('${T1}', 'Lake week 2028', '2028-03-10')`)).rejects.toThrow(/Pro/) }, account)
    await pg.exec(`update private.app_settings set value = 'true' where key = 'pro_free_beta'`)
  })

  it('copies the plan shifted to the new dates, without people or money', async () => {
    const r = await asAna(async () => one<{ r: { trip_id: string } }>(`select public.clone_trip('${T1}', 'Lake week 2028', '2028-03-10') as r`))
    copy = r.r.trip_id
    expect(await one(`select name, start_date::text, end_date::text, access_mode, join_role from public.trips where id = $1`, [copy]))
      .toEqual({ name: 'Lake week 2028', start_date: '2028-03-10', end_date: '2028-03-17', access_mode: 'hosted', join_role: 'pending' })
    expect((await pg.query(`select display_name from public.members where trip_id = $1`, [copy])).rows).toEqual([{ display_name: 'Ana' }])
    expect((await pg.query(`select role from public.trip_devices where trip_id = $1`, [copy])).rows).toEqual([{ role: 'owner' }])
    expect((await one<{ n: number }>(`select count(*)::int as n from public.places where trip_id = $1`, [copy])).n).toBe(2)
    const items = await pg.query<{ title: string; start_local: string; start_at: string; status: string; place_ok: boolean }>(`select i.title, i.start_local::text, i.start_at::text, i.status,
      exists (select 1 from public.places p where p.id = i.place_id and p.trip_id = i.trip_id) as place_ok from public.itinerary_items i where i.trip_id = $1 order by i.start_local`, [copy])
    // 366 days later (2028 is a leap year), same wall-clock times. The New York flight is now after
    // the US DST change (12 Mar 2028), so 09:00 local is 13:00Z; in 2027 it was before it (14:00Z).
    expect(items.rows.map((i) => [i.title, i.start_local, i.status])).toEqual([['Flight to NYC', '2028-03-13 09:00:00', 'tentative'], ['Breakfast', '2028-03-14 08:00:00', 'tentative']])
    expect(items.rows[0]!.place_ok).toBe(true)
    expect(items.rows[0]!.start_at).toMatch(/^2028-03-13 13:00:00/)
    expect((await one<{ t: string }>(`select start_at::text as t from public.itinerary_items where id = '00000000-0000-4000-a000-000000000001'`)).t).toMatch(/^2027-03-13 14:00:00/)
    expect((await pg.query(`select title, assignee_id, completed from public.trip_tasks where trip_id = $1`, [copy])).rows).toEqual([{ title: 'Book the shuttle', assignee_id: null, completed: false }])
    expect((await pg.query(`select title from public.packing_items where trip_id = $1`, [copy])).rows).toEqual([{ title: 'Sunscreen' }])
    expect((await one<{ n: number }>(`select count(*)::int as n from public.leg_overrides where trip_id = $1 and place_a_id < place_b_id`, [copy])).n).toBe(1)
    for (const t of ['expenses', 'attachments', 'poll_votes', 'bookings', 'comments']) {
      expect((await one<{ n: number }>(`select count(*)::int as n from public.${t} where trip_id = $1`, [copy])).n).toBe(0)
    }
    expect(await one(`select status, title, slug <> 'lake-week' as new_slug, balance_due_date::text from public.trip_offers where trip_id = $1`, [copy]))
      .toEqual({ status: 'draft', title: 'Lake week 2028', new_slug: true, balance_due_date: '2028-02-02' })
  })

  it('leaves the original untouched', async () => {
    expect((await one<{ n: number }>(`select count(*)::int as n from public.itinerary_items where trip_id = '${T1}'`)).n).toBe(2)
    expect(copy).not.toBe(T1)
  })
})

describe('installments', () => {
  let token = ''
  let booking = ''
  it('must add up to what is left after the deposit, in date order', async () => {
    const plan = (s: unknown) => asUser(pg, U.A, () => pg.query(`select public.save_offer_plan('${T1}', $1::jsonb, '[]')`, [JSON.stringify(s)]), account)
    await expect(plan([{ due_date: '2027-01-01', amount_minor: 60000 }, { due_date: '2027-02-01', amount_minor: 50000 }])).rejects.toThrow(/add up/)
    await expect(plan([{ due_date: '2027-02-01', amount_minor: 60000 }, { due_date: '2027-01-01', amount_minor: 60000 }])).rejects.toThrow(/date order/)
    await asAna(() => pg.query(`select public.save_offer_plan('${T1}', $1::jsonb, $2::jsonb)`, [
      JSON.stringify([{ due_date: '2026-12-01', amount_minor: 60000 }, { due_date: '2099-02-01', amount_minor: 60000 }]),
      JSON.stringify([{ days_before: 60, percent: 100 }, { days_before: 30, percent: 50 }])]))
    expect(await one(`select balance_due_date::text from public.trip_offers where trip_id = '${T1}'`)).toEqual({ balance_due_date: '2099-02-01' })
    // The public trip page shows the plan and the refund steps travelers agree to.
    const page = await asAnon(pg, () => one<{ o: { schedule: unknown[]; refund_tiers: unknown[] } }>(`select public.get_public_offer('lake-week') as o`))
    expect(page.o.schedule).toHaveLength(2)
    expect(page.o.refund_tiers).toEqual([{ days_before: 60, percent: 100 }, { days_before: 30, percent: 50 }])
  })

  it('keeps the schedule a traveler booked under and says what is due next', async () => {
    const r = await asService(pg, () => one<{ r: { booking_id: string; manage_token: string } }>(`select public.pay_reserve_booking('lake-week', '${U.O}', 'Ola', 'ola@example.com', 1) as r`))
    booking = r.r.booking_id
    token = r.r.manage_token
    await asService(pg, async () => {
      await pg.query(`select public.pay_open_payment($1, 'deposit', 30000, 30000, 300, 'cs_d', null)`, [booking])
      await pg.query(`select public.pay_payment_succeeded('cs_d', 'pi', 'ch_d', 900, 'fee_d', now() - interval '2 days', '${SITE}')`)
    })
    // The first installment (1 Dec 2026) is past, so it is due now; the second waits.
    let due = await asService(pg, () => one<{ d: { next_minor: number; next_date: string; due_minor: number; installments: boolean } }>(`select public.pay_booking_due($1) as d`, [token]))
    expect(due.d).toMatchObject({ next_minor: 60000, next_date: '2026-12-01', due_minor: 120000, installments: true })
    await asService(pg, async () => {
      await pg.query(`select public.pay_open_payment($1, 'installment', 60000, 60000, 600, 'cs_i1', null)`, [booking])
      await pg.query(`select public.pay_payment_succeeded('cs_i1', 'pi', 'ch_i1', 2000, 'fee_i1', now() - interval '1 day', '${SITE}')`)
    })
    due = await asService(pg, () => one(`select public.pay_booking_due($1) as d`, [token]))
    expect(due.d).toMatchObject({ next_minor: 60000, next_date: '2099-02-01', due_minor: 60000 })
  })

  it('lets the organizer plan a refund (newest charge first) and cancel the booking', async () => {
    expect(await asService(pg, () => one(`select public.pay_refund_plan('${U.B}', $1) as p`, [booking]))).toEqual({ p: null })
    const plan = await asService(pg, () => one<{ p: { charges: { charge: string; refundable: number }[]; stripe_account_id: string } }>(`select public.pay_refund_plan('${U.A}', $1) as p`, [booking]))
    expect(plan.p.charges).toEqual([{ charge: 'ch_i1', refundable: 60000 }, { charge: 'ch_d', refundable: 30000 }])
    const before = await one<{ o: { spots_left: number } }>(`select public.get_public_offer('lake-week') as o`)
    await asService(pg, () => pg.query(`select public.pay_cancel_booking('${U.A}', $1)`, [booking]))
    const after = await one<{ o: { spots_left: number } }>(`select public.get_public_offer('lake-week') as o`)
    expect(after.o.spots_left).toBe(before.o.spots_left + 1)
    const page = await one<{ b: { status: string; offer: { refund_tiers: unknown[] } } }>(`select public.get_booking($1) as b`, [token])
    expect(page.b.status).toBe('cancelled')
    expect(page.b.offer.refund_tiers).toHaveLength(2)
  })
})

describe('the policy each traveler accepted', () => {
  it('keeps every version for the organizer', async () => {
    await asAna(() => pg.query(`select public.save_offer('${T1}', 'Lake week', '', 150000, 30000, '2099-02-01', 3, 'Refundable until 45 days out.', 'absorb', false)`))
    const offer = await one<{ id: string }>(`select id from public.trip_offers where trip_id = '${T1}'`)
    const v1 = await asUser(pg, U.A, () => one<{ p: { text: string } }>(`select public.get_offer_policy($1, 1) as p`, [offer.id]), account)
    const v2 = await asUser(pg, U.A, () => one<{ p: { text: string } }>(`select public.get_offer_policy($1, 2) as p`, [offer.id]), account)
    expect([v1.p.text, v2.p.text]).toEqual(['Refundable until 60 days out.', 'Refundable until 45 days out.'])
    expect(await asUser(pg, U.B, () => one(`select public.get_offer_policy($1, 1) as p`, [offer.id]))).toEqual({ p: null })
  })
})

describe('money per trip', () => {
  it('reports what each trip collected, from the ledger, for Pro organizers', async () => {
    const r = await asUser(pg, U.A, () => one<{ r: { trips: Record<string, unknown>[]; payouts: number } }>(`select public.organizer_report('2000-01-01', '2100-01-01') as r`), account)
    expect(r.r.trips).toEqual([{ trip_id: T1, title: 'Lake week', collected: 90000, stripe_fees: 2900, stowaway_fees: 900, refunds: 0, net: 86200 }])
    await asUser(pg, U.B, async () => { await expect(pg.query(`select public.organizer_report('2000-01-01', '2100-01-01')`)).rejects.toThrow(/Pro/) })
  })
})

describe('invite links per role', () => {
  it('joins people with the invite’s role, and honours uses, expiry and revoking', async () => {
    await asUser(pg, U.B, async () => { await expect(pg.query(`select public.create_invite('${T1}', 'viewer', 'Parents', 0, null)`)).rejects.toThrow(/organizer/) })
    const viewer = await asAna(async () => (await one<{ t: string }>(`select public.create_invite('${T1}', 'viewer', 'Parents', 0, null) as t`)).t)
    const once = await asAna(async () => (await one<{ t: string }>(`select public.create_invite('${T1}', 'traveler', null, 7, 1) as t`)).t)
    await asUserCommit(pg, U.X, () => pg.query(`select public.join_trip($1)`, [viewer]))
    expect(await one(`select role from public.trip_devices where trip_id = '${T1}' and user_id = '${U.X}'`)).toEqual({ role: 'viewer' })
    const [n1, n2] = ['00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000002']
    await pg.exec(`insert into auth.users (id) values ('${n1}'), ('${n2}')`)
    await asUserCommit(pg, n1, () => pg.query(`select public.join_trip($1)`, [once]))
    await asUserCommit(pg, n1, () => pg.query(`select public.join_trip($1)`, [once])) // rejoining doesn't use it up again
    expect(await one(`select role from public.trip_devices where trip_id = '${T1}' and user_id = '${n1}'`)).toEqual({ role: 'traveler' })
    await asUser(pg, n2, async () => { await expect(pg.query(`select public.join_trip($1)`, [once])).rejects.toThrow(/invalid/) })
    const invite = await one<{ id: string }>(`select id from public.trip_invites where label = 'Parents'`)
    await asAna(() => pg.query(`select public.revoke_invite($1)`, [invite.id]))
    await asUser(pg, n2, async () => { await expect(pg.query(`select public.join_trip($1)`, [viewer])).rejects.toThrow(/invalid/) })
    await asUser(pg, U.B, async () => { expect((await pg.query(`select * from public.trip_invites`)).rows).toEqual([]) })
  })
})
