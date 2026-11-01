// Phase 2b (20261103000001_travelers.sql): questions at booking, room choices, the traveler list,
// the waitlist with 48-hour holds, and the rooming board.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asAnon, asService, asUser, asUserCommit, migratedDb } from './db'
import { T1, U, seed } from './fixtures'

const account = { anonymous: false }
const SITE = 'https://joinstowaway.app'
let pg: PGlite
const one = async <T,>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows[0]!
const keep = <T,>(fn: () => Promise<T>) => asAnon(pg, fn, { keep: true })
const asAna = <T,>(fn: () => Promise<T>) => asUserCommit(pg, U.A, fn, account)
type Reserved = { r: { booking_id: string; manage_token: string; price_minor: number } }
const reserve = (name: string, email: string, extra: unknown) =>
  asService(pg, () => one<Reserved>(`select public.pay_reserve_booking('lake-week', $1, $2, $3, 1, $4::jsonb) as r`,
    [crypto.randomUUID(), name, email, JSON.stringify(extra)]))
async function pay(booking: string, session: string, amount = 30000) {
  await asService(pg, async () => {
    await pg.query(`select public.pay_open_payment($1, 'deposit', $2, $2, 300, $3, null)`, [booking, amount, session])
    await pg.query(`select public.pay_payment_succeeded($1, 'pi', $2, 900, null, now(), '${SITE}')`, [session, `ch_${session}`])
  })
}

beforeAll(async () => {
  pg = await migratedDb()
  await seed(pg)
  await pg.exec(`update public.trips set start_date = '2027-03-10', end_date = '2027-03-17', timezone = 'America/Guatemala' where id = '${T1}'`)
  await asAna(async () => {
    await pg.query(`select public.save_organizer('Ana Trips', 'ana@example.com')`)
    await pg.query(`select public.claim_trip('${T1}')`)
    await pg.query(`select public.save_offer('${T1}', 'Lake week', '', 150000, 30000, '2027-02-01', 10, 'Refundable until 60 days out.', 'absorb', false)`)
    await pg.query(`select public.save_offer_plan('${T1}', $1::jsonb, '[]')`, [JSON.stringify([{ due_date: '2099-01-01', amount_minor: 60000 }, { due_date: '2099-02-01', amount_minor: 60000 }])])
  })
  await pg.exec(`update public.organizers set reviewed_at = now()`)
  const org = await one<{ id: string }>(`select id from public.organizers`)
  await asService(pg, () => pg.query(`select public.pay_upsert_account($1, 'acct_1', true, true, true, '{}', null, '{}', 'US', 'usd')`, [org.id]))
  await asAna(() => pg.query(`select public.set_offer_status('${T1}', 'published')`))
}, 60000)
afterAll(async () => { await pg?.close() })

let single = ''
let singleToken = ''

describe('questions and room choices at booking', () => {
  it('only the organizer sets them; rooms need Pro', async () => {
    await expect(asUser(pg, U.B, () => pg.query(`select public.save_offer_questions('${T1}', '{"dietary": true}')`))).rejects.toThrow(/organizer/)
    await asAna(async () => {
      await pg.query(`select public.save_offer_questions('${T1}', $1::jsonb)`, [JSON.stringify({ dietary: true, custom: [{ id: 'tshirt', label: ' T-shirt size ', required: true }] })])
      await pg.query(`select public.save_room_options('${T1}', $1::jsonb)`, [JSON.stringify([
        { id: 'shared', label: 'Shared', price_delta_minor: 0, count: 8 }, { id: 'single', label: 'Single', price_delta_minor: 40000, count: 1 }])])
    })
    const page = await asAnon(pg, () => one<{ o: { questions: unknown; rooms: { id: string; left: number }[] } }>(`select public.get_public_offer('lake-week') as o`))
    expect(page.o.questions).toEqual({ dietary: true, accessibility: false, emergency_contact: false, custom: [{ id: 'tshirt', label: 'T-shirt size', required: true }] })
    expect(page.o.rooms.map((r) => [r.id, r.left])).toEqual([['shared', 8], ['single', 1]])
  })

  it('needs required answers and a room, keeps only the offer’s questions, and prices the room', async () => {
    await expect(reserve('Ola', 'ola@example.com', { room_option: 'single' })).rejects.toThrow(/T-shirt size/)
    await expect(reserve('Ola', 'ola@example.com', { answers: { tshirt: 'M' } })).rejects.toThrow(/Choose a room/)
    const r = await reserve('Ola', 'ola@example.com', { room_option: 'single', consent: true, answers: { tshirt: ' M ', dietary: 'vegan', sneaky: 'x', accessibility: 'n/a' } })
    single = r.r.booking_id
    singleToken = r.r.manage_token
    expect(r.r.price_minor).toBe(190000)
    const b = await one<{ answers: unknown; schedule: { amount_minor: number }[]; marketing_consent: boolean }>(`select answers, schedule, marketing_consent from public.bookings where id = $1`, [single])
    expect(b.answers).toEqual({ dietary: 'vegan', tshirt: 'M' })
    // The room's extra price joins the last installment, so the plan still adds up to the price.
    expect(b.schedule.map((s) => s.amount_minor)).toEqual([60000, 100000])
    expect(b.marketing_consent).toBe(true)
    await expect(reserve('Pat', 'pat@example.com', { room_option: 'single', answers: { tshirt: 'L' } })).rejects.toThrow(/No single rooms are left/)
  })

  it('lets the traveler change answers from their link, and shows them only to staff and that traveler', async () => {
    expect(await keep(() => one<{ a: unknown }>(`select public.update_booking_answers($1, '{"tshirt": "L"}') as a`, [singleToken]))).toEqual({ a: { tshirt: 'L' } })
    await expect(asAnon(pg, () => pg.query(`select public.update_booking_answers('wrong', '{}')`))).rejects.toThrow(/couldn/)
    const booking = await asAnon(pg, () => one<{ b: { answers: unknown; room_option: string } }>(`select public.get_booking($1) as b`, [singleToken]))
    expect(booking.b).toMatchObject({ answers: { tshirt: 'L' }, room_option: 'single' })
    expect((await asUser(pg, U.A, () => pg.query(`select answers from public.bookings`), account)).rows).toHaveLength(1)
    expect((await asUser(pg, U.B, () => pg.query(`select answers from public.bookings`))).rows).toHaveLength(0)
  })
})

describe('the traveler list', () => {
  it('adds people once they pay, with consent only from the box, for the organizer only', async () => {
    expect((await pg.query(`select 1 from public.organizer_contacts`)).rows).toHaveLength(0) // a hold isn't a traveler yet
    await pay(single, 'cs_single')
    const pat = await reserve('Pat', 'PAT@example.com', { room_option: 'shared', answers: { tshirt: 'S' } })
    await pay(pat.r.booking_id, 'cs_pat')
    const rows = (await asUser(pg, U.A, () => pg.query<{ email: string; trips: number; total_paid_minor: string; marketing_consent: boolean; last_trip_on: string }>(
      `select email, trips, total_paid_minor, marketing_consent, last_trip_on::text from public.organizer_contacts order by email`), account)).rows
    expect(rows.map((r) => [r.email, r.trips, Number(r.total_paid_minor), r.marketing_consent, r.last_trip_on])).toEqual([
      ['ola@example.com', 1, 30000, true, '2027-03-10'], ['pat@example.com', 1, 30000, false, '2027-03-10']])
    expect((await asUser(pg, U.B, () => pg.query(`select 1 from public.organizer_contacts`))).rows).toHaveLength(0)
  })

  it('keeps tags and notes, through the organizer’s own RPC', async () => {
    const id = (await one<{ id: string }>(`select id from public.organizer_contacts where email = 'ola@example.com'`)).id
    await asAna(() => pg.query(`select public.save_contact($1, $2, 'Loves kayaks')`, [id, ['Repeat', ' repeat ', 'vip']]))
    expect(await one(`select tags, notes from public.organizer_contacts where id = $1`, [id])).toEqual({ tags: ['repeat', 'vip'], notes: 'Loves kayaks' })
    await expect(asUser(pg, U.B, () => pg.query(`select public.save_contact($1, '{}', '')`, [id]))).rejects.toThrow(/Not your/)
  })
})

describe('the waitlist', () => {
  let hold = ''
  it('opens only when the trip is full', async () => {
    await expect(asAnon(pg, () => pg.query(`select public.join_waitlist('lake-week', 'Wen', 'wen@example.com')`))).rejects.toThrow(/places left/)
    await pg.exec(`update public.trip_offers set capacity = 2`)
    expect(await keep(() => one(`select public.join_waitlist('lake-week', 'Wen', 'wen@example.com') as n`))).toEqual({ n: 1 })
    expect(await keep(() => one(`select public.join_waitlist('lake-week', 'Xu', 'xu@example.com') as n`))).toEqual({ n: 2 })
    expect(await keep(() => one(`select public.join_waitlist('lake-week', 'Wen', 'WEN@example.com') as n`))).toEqual({ n: 1 }) // once each
    expect(await one(`select private.waitlist_tick() as n`)).toEqual({ n: 0 })
  })

  it('holds a freed place for the next person, who can book it while a stranger can’t', async () => {
    await pg.exec(`update public.bookings set status = 'cancelled' where id = '${single}'`)
    expect(await one(`select private.waitlist_tick() as n`)).toEqual({ n: 1 })
    const mail = await one<{ to_email: string; template: string; data: { url: string } }>(`select to_email, template, data from private.email_outbox where template = 'waitlist_offer'`)
    expect(mail).toMatchObject({ to_email: 'wen@example.com', template: 'waitlist_offer' })
    hold = mail.data.url.split('#hold=')[1]!
    expect(mail.data.url).toBe(`${SITE}/go/lake-week#hold=${hold}`)
    expect(await asAnon(pg, () => one<{ h: { name: string } }>(`select public.get_hold('lake-week', $1) as h`, [hold]))).toMatchObject({ h: { name: 'Wen' } })
    await expect(reserve('Stranger', 's@example.com', { room_option: 'shared', answers: { tshirt: 'M' } })).rejects.toThrow(/full/)
    const wen = await reserve('Wen', 'wen@example.com', { room_option: 'shared', answers: { tshirt: 'M' }, hold })
    await pay(wen.r.booking_id, 'cs_wen')
    expect(await one(`select status from public.waitlist_entries where email = 'wen@example.com'`)).toEqual({ status: 'booked' })
  })

  it('passes a lapsed hold to the next person', async () => {
    await pg.exec(`update public.bookings set status = 'cancelled' where traveler_email = 'pat@example.com'`)
    expect(await one(`select private.waitlist_tick() as n`)).toEqual({ n: 1 })
    expect(await one(`select status from public.waitlist_entries where email = 'xu@example.com'`)).toEqual({ status: 'offered' })
    await pg.exec(`update public.waitlist_entries set hold_until = now() - interval '1 minute' where email = 'xu@example.com'`)
    await pg.exec(`update public.trip_offers set capacity = 3`)
    await keep(() => pg.query(`select public.join_waitlist('lake-week', 'Yan', 'yan@example.com')`)).catch(() => undefined)
    expect(await one(`select private.waitlist_tick() as n`)).toEqual({ n: 0 }) // nobody else waiting yet
    expect(await one(`select status from public.waitlist_entries where email = 'xu@example.com'`)).toEqual({ status: 'expired' })
  })

  it('lets the organizer see the queue and take people off it', async () => {
    expect((await asUser(pg, U.A, () => pg.query(`select email from public.waitlist_entries`), account)).rows.length).toBeGreaterThan(0)
    expect((await asUser(pg, U.B, () => pg.query(`select email from public.waitlist_entries`))).rows).toHaveLength(0)
    const xu = (await one<{ id: string }>(`select id from public.waitlist_entries where email = 'xu@example.com'`)).id
    await expect(asUser(pg, U.B, () => pg.query(`select public.remove_waitlist_entry($1)`, [xu]))).rejects.toThrow(/organizer/)
  })
})

describe('the rooming board', () => {
  it('is for the organizer only', async () => {
    const ins = `insert into public.room_assignments (id, trip_id, booking_id, room_name) values (gen_random_uuid(), '${T1}', $1, 'Casa 1')`
    await asUserCommit(pg, U.A, () => pg.query(ins, [single]), account)
    await expect(asUser(pg, U.B, () => pg.query(ins, [single]))).rejects.toThrow(/row-level security/)
    expect((await asUser(pg, U.B, () => pg.query(`select 1 from public.room_assignments`))).rows).toHaveLength(0)
    expect((await asUser(pg, U.A, () => pg.query(`update public.room_assignments set room_name = null returning 1`), account)).rows).toHaveLength(1)
  })
})

describe('without Pro', () => {
  it('refuses rooms and the waitlist, and hides the traveler list', async () => {
    await pg.exec(`update private.app_settings set value = 'false' where key = 'pro_free_beta'`)
    await expect(asUser(pg, U.A, () => pg.query(`select public.save_room_options('${T1}', '[]')`), account)).rejects.toThrow(/Pro/)
    await pg.exec(`update public.trip_offers set capacity = 1`)
    await expect(asAnon(pg, () => pg.query(`select public.join_waitlist('lake-week', 'Zo', 'zo@example.com')`))).rejects.toThrow(/no waitlist/)
    expect((await asUser(pg, U.A, () => pg.query(`select 1 from public.organizer_contacts`), account)).rows).toHaveLength(0)
    await pg.exec(`update private.app_settings set value = 'true' where key = 'pro_free_beta'`)
  })
})
