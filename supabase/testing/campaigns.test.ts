// Phase 2c (20261104000001_campaigns.sql): campaigns to past travelers who agreed, held until a
// campaign sender exists; a postal address in every email; one-tap unsubscribe.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asAnon, asService, asUser, asUserCommit, migratedDb } from './db'
import { T1, T2, U, seed } from './fixtures'

const account = { anonymous: false }
let pg: PGlite
const one = async <T,>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows[0]!
const asAna = <T,>(fn: () => Promise<T>) => asUserCommit(pg, U.A, fn, account)
let org = ''

beforeAll(async () => {
  pg = await migratedDb()
  await seed(pg)
  await asAna(async () => {
    await pg.query(`select public.save_organizer('Ana Trips', 'ana@example.com')`)
    await pg.query(`select public.claim_trip('${T1}')`)
    await pg.query(`select public.save_offer('${T1}', 'Lake week', '', 150000, 30000, '2027-02-01', 10, 'Refundable until 60 days out.', 'absorb', false)`)
  })
  await pg.exec(`update public.organizers set reviewed_at = now()`)
  org = (await one<{ id: string }>(`select id from public.organizers`)).id
  await asService(pg, () => pg.query(`select public.pay_upsert_account($1, 'acct_1', true, true, true, '{}', null, '{}', 'US', 'usd')`, [org]))
  await asAna(() => pg.query(`select public.set_offer_status('${T1}', 'published')`))
  // Ola booked the lake trip and ticked the box; Pat booked without it; Kim is a tagged contact with consent.
  for (const [name, email, consent] of [['Ola', 'ola@example.com', true], ['Pat', 'pat@example.com', false]] as const) {
    const r = await asService(pg, () => one<{ r: { booking_id: string } }>(`select public.pay_reserve_booking('lake-week', $1, $2, $3, 1, $4::jsonb) as r`,
      [crypto.randomUUID(), name, email, JSON.stringify({ consent })]))
    await asService(pg, async () => {
      await pg.query(`select public.pay_open_payment($1, 'deposit', 30000, 30000, 300, $2, null)`, [r.r.booking_id, `cs_${name}`])
      await pg.query(`select public.pay_payment_succeeded($1, 'pi', $2, 900, null, now(), 'https://joinstowaway.app')`, [`cs_${name}`, `ch_${name}`])
    })
  }
  await pg.exec(`insert into public.organizer_contacts (organizer_id, email, name, marketing_consent, tags) values ('${org}', 'kim@example.com', 'Kim', true, '{vip}')`)
}, 60000)
afterAll(async () => { await pg?.close() })

let id = ''

describe('campaigns', () => {
  it('reach only people who agreed, filtered by past trip and tag', async () => {
    const audience = (a: unknown) => asUser(pg, U.A, () => one<{ a: { count: number; first: { email: string }[] } }>(`select public.campaign_audience($1::jsonb) as a`, [JSON.stringify(a)]), account)
    expect((await audience({})).a.first.map((r) => r.email)).toEqual(['kim@example.com', 'ola@example.com'])
    expect((await audience({ trip_ids: [T1] })).a.first.map((r) => r.email)).toEqual(['ola@example.com'])
    expect((await audience({ trip_ids: [T2] })).a.count).toBe(0)
    expect((await audience({ tags: ['vip'] })).a.first.map((r) => r.email)).toEqual(['kim@example.com'])
    await expect(asUser(pg, U.B, () => pg.query(`select public.campaign_audience('{}')`))).rejects.toThrow(/Pro/)
  })

  it('need a postal address before queueing, and wait while sending is off', async () => {
    id = (await asAna(() => one<{ id: string }>(`select id from public.save_campaign(null, 'Back to the lake', 'Hi! Same week next year?', '{}')`))).id
    await expect(asUser(pg, U.A, () => pg.query(`select public.queue_campaign($1)`, [id]), account)).rejects.toThrow(/postal address/)
    await asAna(() => pg.query(`select public.save_organizer_address('12 Main St, Austin, TX 78701')`))
    await asAna(() => pg.query(`select public.send_campaign_test($1)`, [id]))
    expect(await asAna(() => one(`select public.queue_campaign($1) as n`, [id]))).toEqual({ n: 2 })
    await expect(asUser(pg, U.A, () => pg.query(`select public.queue_campaign($1)`, [id]), account)).rejects.toThrow(/already queued/)
    const mail = await one<{ data: { postal_address: string; unsubscribe_url: string } }>(`select data from private.email_outbox where channel = 'campaign' and to_email = 'ola@example.com'`)
    expect(mail.data.postal_address).toBe('12 Main St, Austin, TX 78701')
    expect(mail.data.unsubscribe_url).toMatch(/^https:\/\/joinstowaway\.app\/unsubscribe#t=/)
    // Only the test copy (transactional) and the earlier booking emails go out; campaign mail waits.
    const claimed = await asService(pg, () => pg.query<{ channel: string; template: string }>(`select channel, template from public.pay_email_claim(100)`))
    expect(claimed.rows.some((r) => r.channel === 'campaign')).toBe(false)
    expect(claimed.rows.some((r) => r.template === 'campaign')).toBe(true) // the test send
  })

  it('go out once campaign sending is switched on', async () => {
    await pg.exec(`update private.app_settings set value = 'true' where key = 'campaign_sending'; update private.email_outbox set claimed_at = null where sent_at is null`)
    const claimed = await asService(pg, () => pg.query<{ channel: string }>(`select channel from public.pay_email_claim(100)`))
    expect(claimed.rows.filter((r) => r.channel === 'campaign')).toHaveLength(2)
    await pg.exec(`update private.app_settings set value = 'false' where key = 'campaign_sending'; update private.email_outbox set claimed_at = null where sent_at is null`)
  })

  it('unsubscribe in one tap, drop unsent mail, and never re-subscribe on their own', async () => {
    const url = (await one<{ u: string }>(`select data ->> 'unsubscribe_url' as u from private.email_outbox where channel = 'campaign' and to_email = 'ola@example.com'`)).u
    const token = url.split('#t=')[1]!
    expect(await asAnon(pg, () => one(`select public.unsubscribe($1) as r`, [token]), { keep: true })).toEqual({ r: { organizer: 'Ana Trips' } })
    expect(await asAnon(pg, () => one(`select public.unsubscribe($1) as r`, [token]), { keep: true })).toEqual({ r: { organizer: 'Ana Trips' } })
    expect(await one(`select marketing_consent, unsubscribed_at is not null as gone from public.organizer_contacts where email = 'ola@example.com'`)).toEqual({ marketing_consent: false, gone: true })
    expect((await pg.query(`select 1 from private.email_outbox where channel = 'campaign' and to_email = 'ola@example.com'`)).rows).toHaveLength(0)
    await expect(asAnon(pg, () => pg.query(`select public.unsubscribe('nope')`))).rejects.toThrow(/isn't valid/)
    const audience = await asUser(pg, U.A, () => one<{ a: { count: number } }>(`select public.campaign_audience('{}') as a`), account)
    expect(audience.a.count).toBe(1)
  })

  it('are private to their organizer and need Pro', async () => {
    expect((await asUser(pg, U.B, () => pg.query(`select 1 from public.campaigns`))).rows).toHaveLength(0)
    await pg.exec(`update private.app_settings set value = 'false' where key = 'pro_free_beta'`)
    await expect(asUser(pg, U.A, () => pg.query(`select public.save_campaign(null, 'x', 'y', '{}')`), account)).rejects.toThrow(/Pro/)
    await pg.exec(`update private.app_settings set value = 'true' where key = 'pro_free_beta'`)
  })
})
