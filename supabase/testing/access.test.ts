// Access rules after 20261030000001_access_roles.sql.
// 1. Group trips (every trip that exists today) behave exactly as before: the same data, loaded into
//    a database without the migration and one with it, gives every user the same reads, writes and RPCs.
// 2. Hosted trips: roles, private documents and money, approval, removal.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asUser, asUserCommit, migratedDb } from './db'
import { ATT, EXP, M, OPT, P, PACK, POLL, T1, T2, TABLES, TOKEN, U, attempt, seed } from './fixtures'

const ACCESS_MIGRATION = '20261030000001_access_roles.sql'
const USERS = Object.entries(U)
const fresh = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`

/** Every observable effect of access rules for one user, as plain data. */
async function observe(pg: PGlite, user: string): Promise<Record<string, unknown>> {
  return asUser(pg, user, async () => {
    const out: Record<string, unknown> = {}
    for (const [table, key] of Object.entries(TABLES)) {
      const rows = await attempt(pg, `select ${key} as k from public.${table} order by 1`)
      out[`read ${table}`] = rows === 'error' ? rows : rows.map((r) => r.k)
    }
    const files = await attempt(pg, `select name from storage.objects order by 1`)
    out['read files'] = files === 'error' ? files : files.map((r) => r.name)
    // Updating each existing row (a no-op change still runs the policies).
    for (const [table, key] of Object.entries(TABLES)) {
      if (table === 'trip_devices') continue // no update policy at all
      for (const k of await superRows(pg, table, key)) {
        const res = await attempt(pg, `update public.${table} set updated_by = updated_by where ${key} = $1 returning 1`, [k])
        out[`update ${table} ${k}`] = res === 'error' ? res : res.length
      }
    }
    for (const [name, sql] of Object.entries(insertAttempts())) {
      const res = await attempt(pg, sql)
      out[`insert ${name}`] = res === 'error' ? res : res.length
    }
    const fileUpdate = await attempt(pg, `update storage.objects set owner = owner where name like $1 returning 1`, [`${T1}/%`])
    out['update files'] = fileUpdate === 'error' ? fileUpdate : fileUpdate.length
    const upload = await attempt(pg, `insert into storage.objects (bucket_id, name) values ('attachments', $1) returning 1`, [`${T1}/${fresh(99)}/new.pdf`])
    out['upload file'] = upload === 'error' ? upload : upload.length
    for (const [name, sql] of Object.entries(rpcAttempts())) {
      const res = await attempt(pg, sql)
      out[`rpc ${name}`] = res === 'error' ? res : 'ok'
    }
    return out
  })
}

// Row ids are read once by the superuser so every user tries the same rows.
const superCache = new Map<string, string[]>()
async function superRows(pg: PGlite, table: string, key: string): Promise<string[]> {
  if (!superCache.has(table)) {
    await pg.exec('savepoint su; reset role;')
    const r = await pg.query<{ k: string }>(`select ${key} as k from public.${table} order by 1`)
    await pg.exec('rollback to savepoint su')
    superCache.set(table, r.rows.map((x) => x.k))
  }
  return superCache.get(table)!
}

function insertAttempts(): Record<string, string> {
  const t1 = `'${T1}'`
  return {
    place: `insert into public.places (id, trip_id, name) values ('${fresh(1)}', ${t1}, 'New') returning 1`,
    'place in other trip': `insert into public.places (id, trip_id, name) values ('${fresh(2)}', '${T2}', 'New') returning 1`,
    poll: `insert into public.polls (id, trip_id, title) values ('${fresh(3)}', ${t1}, 'Lunch?') returning 1`,
    'vote as Ben': `insert into public.poll_votes (id, trip_id, poll_id, option_id, member_id, score) values ('${fresh(4)}', ${t1}, '${POLL}', '${OPT}', '${M.A}', 2) returning 1`,
    'rating as Cy': `insert into public.place_ratings (id, trip_id, place_id, member_id, stars) values ('${fresh(5)}', ${t1}, '${P.p2}', '${M.C}', 5) returning 1`,
    'comment as Ben': `insert into public.comments (id, trip_id, subject_type, subject_id, member_id, body) values ('${fresh(6)}', ${t1}, 'poll', '${POLL}', '${M.B}', 'Me too') returning 1`,
    'comment as Cy': `insert into public.comments (id, trip_id, subject_type, subject_id, member_id, body) values ('${fresh(7)}', ${t1}, 'poll', '${POLL}', '${M.C}', 'Me too') returning 1`,
    'expense Ana paid for Ben': `insert into public.expenses (id, trip_id, description, spent_on, amount_minor, currency, fx_rate, base_currency, base_amount_minor, payers, split_method, split)
      values ('${fresh(8)}', ${t1}, 'Taxi', '2027-03-14', 500, 'USD', 1, 'USD', 500, '[{"member_id":"${M.A}","amount_minor":500}]', 'equal', '[{"member_id":"${M.B}","value":1}]') returning 1`,
    'expense Ana paid for Cy': `insert into public.expenses (id, trip_id, description, spent_on, amount_minor, currency, fx_rate, base_currency, base_amount_minor, payers, split_method, split)
      values ('${fresh(9)}', ${t1}, 'Taxi', '2027-03-14', 500, 'USD', 1, 'USD', 500, '[{"member_id":"${M.A}","amount_minor":500}]', 'equal', '[{"member_id":"${M.C}","value":1}]') returning 1`,
    'own document': `insert into public.attachments (id, trip_id, title, storage_path, filename, mime, bytes, sha256) values ('${fresh(10)}', ${t1}, 'Doc', '${T1}/${fresh(10)}/d.pdf', 'd.pdf', 'application/pdf', 5, 'q') returning 1`,
    'safety card for Ben': `insert into public.member_safety (id, trip_id, member_id) values ('${fresh(11)}', ${t1}, '${M.B}') returning 1`,
    'personal packing for Ben': `insert into public.packing_items (id, trip_id, title, kind, owner_id) values ('${fresh(12)}', ${t1}, 'Hat', 'personal', '${M.B}') returning 1`,
    'shared packing': `insert into public.packing_items (id, trip_id, title, kind) values ('${fresh(13)}', ${t1}, 'Rope', 'group') returning 1`,
    task: `insert into public.trip_tasks (id, trip_id, title) values ('${fresh(14)}', ${t1}, 'Call hotel') returning 1`,
    member: `insert into public.members (id, trip_id, display_name) values ('${fresh(15)}', ${t1}, 'Dee') returning 1`,
    'route leg': `insert into public.route_legs (id, trip_id, from_place_id, to_place_id, mode, source, distance_m, duration_s) values ('${fresh(16)}', ${t1}, '${P.p2}', '${P.p1}', 'drive', 'osrm', 9, 9) returning 1`,
    'trip rename': `update public.trips set name = 'Renamed' where id = ${t1} returning 1`,
  }
}

function rpcAttempts(): Record<string, string> {
  return {
    'join by link': `select public.join_trip('${TOKEN}')`,
    'claim Ben': `select public.claim_member('${T1}', '${M.B}')`,
    'add me': `select public.create_member_and_claim('${T1}', '${fresh(20)}', 'New person')`,
    'replace link': `select public.rotate_share_token('${T1}')`,
  }
}

describe('group trips behave exactly as before', () => {
  let before: PGlite
  let after: PGlite
  beforeAll(async () => {
    ;[before, after] = await Promise.all([migratedDb({ until: ACCESS_MIGRATION }), migratedDb()])
    await seed(before)
    await seed(after)
  }, 120000)
  afterAll(async () => { await before?.close(); await after?.close() })

  for (const [name, user] of USERS) {
    it(`user ${name} sees and can do the same things`, async () => {
      superCache.clear()
      const old = await observe(before, user)
      superCache.clear()
      const now = await observe(after, user)
      expect(now).toEqual(old)
      // The comparison means something: members see the trip, outsiders don't.
      if (name === 'B') expect(old['read places']).toEqual([P.p1, P.p2])
      if (name === 'O') expect(old['read places']).toEqual([])
    }, 60000)
  }
})

describe('hosted trips', () => {
  let pg: PGlite
  const sel = (sql: string) => pg.query<{ k: string }>(sql).then((r) => r.rows.map((x) => x.k))

  beforeAll(async () => {
    pg = await migratedDb()
    await seed(pg)
    // Ana signs in with an account, claims the trip, and makes it hosted; Cy becomes a viewer.
    await asUserCommit(pg, U.A, async () => {
      await pg.query(`select public.claim_trip('${T1}')`)
      await pg.query(`select public.set_access_mode('${T1}', 'hosted')`)
      await pg.query(`select public.set_member_role('${T1}', '${M.C}', 'viewer')`)
    }, { anonymous: false })
    // Ben's passport is his own; the hotel contract is for organizers.
    await pg.exec(`update public.attachments set visibility = 'owner', owner_member_id = '${M.B}' where id = '${ATT.own}';
                   update public.attachments set visibility = 'staff' where id = '${ATT.staff}';`)
  }, 120000)
  afterAll(async () => { await pg?.close() })

  it('records the roles and the new mode', async () => {
    const roles = await pg.query<{ member_id: string; role: string }>(`select member_id, role from public.trip_devices where trip_id = '${T1}' order by member_id`)
    expect(roles.rows).toEqual([{ member_id: M.A, role: 'owner' }, { member_id: M.B, role: 'traveler' }, { member_id: M.C, role: 'viewer' }])
    const trip = await pg.query(`select access_mode, join_role, access_epoch from public.trips where id = '${T1}'`)
    expect(trip.rows[0]).toEqual({ access_mode: 'hosted', join_role: 'pending', access_epoch: 1 })
  })

  it('shows each person only their documents and money', async () => {
    await asUser(pg, U.A, async () => {
      expect(await sel(`select id k from public.attachments order by 1`)).toEqual([ATT.trip, ATT.own, ATT.staff])
      expect(await sel(`select id k from public.expenses order by 1`)).toEqual([EXP.e1, EXP.e2])
    })
    await asUser(pg, U.B, async () => {
      expect(await sel(`select id k from public.attachments order by 1`)).toEqual([ATT.trip, ATT.own])
      expect(await sel(`select name k from storage.objects order by 1`)).toEqual([`${T1}/${ATT.trip}/t.pdf`, `${T1}/${ATT.own}/p.jpg`])
      expect(await sel(`select id k from public.expenses order by 1`)).toEqual([EXP.e1])
      expect(await sel(`select from_member_id k from public.settlements`)).toEqual([M.B])
      expect(await sel(`select member_id k from public.member_safety`)).toEqual([M.B])
      expect(await sel(`select user_id k from public.trip_devices`)).toEqual([U.B])
    })
    await asUser(pg, U.C, async () => {
      expect(await sel(`select id k from public.attachments order by 1`)).toEqual([ATT.trip])
      expect(await sel(`select id k from public.expenses`)).toEqual([])
      expect(await sel(`select id k from public.places order by 1`)).toEqual([P.p1, P.p2])
    })
  })

  it('lets travelers take part but not edit the plan', async () => {
    await asUser(pg, U.B, async () => {
      expect(await attempt(pg, insertAttempts().place!)).toBe('error')
      expect(await attempt(pg, insertAttempts().poll!)).toBe('error')
      expect(await attempt(pg, insertAttempts()['shared packing']!)).toBe('error')
      expect(await attempt(pg, `update public.trips set name = 'Mine' where id = '${T1}' returning 1`)).toEqual([])
      expect(await attempt(pg, insertAttempts()['comment as Ben']!)).toHaveLength(1)
      expect(await attempt(pg, insertAttempts()['comment as Cy']!)).toBe('error')
      expect(await attempt(pg, insertAttempts()['personal packing for Ben']!)).toHaveLength(1)
      expect(await attempt(pg, `insert into public.poll_votes (id, trip_id, poll_id, option_id, member_id, score) values ('${fresh(30)}', '${T1}', '${POLL}', '${OPT}', '${M.C}', 0) returning 1`)).toBe('error')
      expect(await attempt(pg, `update public.packing_items set title = 'Novel' where id = '${PACK.personal}' returning 1`)).toHaveLength(1)
      expect(await attempt(pg, insertAttempts()['expense Ana paid for Ben']!)).toHaveLength(1)
      expect(await attempt(pg, insertAttempts()['expense Ana paid for Cy']!)).toBe('error')
    })
    await asUser(pg, U.C, async () => {
      expect(await attempt(pg, `insert into public.comments (id, trip_id, subject_type, subject_id, member_id, body) values ('${fresh(31)}', '${T1}', 'poll', '${POLL}', '${M.C}', 'Hi') returning 1`)).toBe('error')
    })
  })

  it('keeps the mode, epoch and join role out of reach of a plain update', async () => {
    await asUser(pg, U.A, async () => {
      await pg.query(`update public.trips set access_mode = 'group', access_epoch = 0, join_role = 'member' where id = '${T1}'`)
      const trip = await pg.query(`select access_mode, access_epoch, join_role from public.trips where id = '${T1}'`)
      expect(trip.rows[0]).toEqual({ access_mode: 'hosted', access_epoch: 1, join_role: 'pending' })
    })
  })

  it('makes new joiners wait for approval, and stops them taking someone else over', async () => {
    await asUserCommit(pg, U.O, async () => {
      expect(await pg.query(`select public.my_trip_access('${T1}') as a`).then((r) => r.rows[0])).toEqual({ a: null })
      await pg.query(`select public.join_trip('${TOKEN}')`)
      expect(await sel(`select id k from public.trips`)).toEqual([T1])
      expect(await sel(`select id k from public.places`)).toEqual([])
      expect(await attempt(pg, `select public.claim_member('${T1}', '${M.B}')`)).toBe('error')
      await pg.query(`select public.create_member_and_claim('${T1}', '${fresh(40)}', 'Ola')`)
    })
    await asUserCommit(pg, U.A, async () => { await pg.query(`select public.set_member_role('${T1}', '${fresh(40)}', 'traveler')`) }, { anonymous: false })
    await asUser(pg, U.O, async () => {
      expect(await sel(`select id k from public.places order by 1`)).toEqual([P.p1, P.p2])
      expect(await attempt(pg, `select public.claim_member('${T1}', '${M.B}')`)).toBe('error')
      const access = await pg.query<{ a: Record<string, unknown> }>(`select public.my_trip_access('${T1}') as a`)
      expect(access.rows[0]!.a).toMatchObject({ role: 'traveler', mode: 'hosted', epoch: 1, removed: false, can_remove: false, organized: true })
    })
  })

  it('removes a person for good and replaces the link', async () => {
    const token = await asUserCommit(pg, U.A, async () => {
      expect(await attempt(pg, `select public.remove_from_trip('${T1}', '${M.A}')`)).toBe('error') // not yourself
      return (await pg.query<{ t: string }>(`select public.remove_from_trip('${T1}', '${M.B}') as t`)).rows[0]!.t
    }, { anonymous: false })
    expect(token).toMatch(/^[\w-]{20,}$/)
    await asUser(pg, U.B, async () => {
      expect(await sel(`select id k from public.places`)).toEqual([])
      expect(await attempt(pg, `select public.join_trip('${TOKEN}')`)).toBe('error') // old link is gone
      await expect(pg.query(`select public.join_trip('${token}')`)).rejects.toThrow(/removed from this trip/)
    })
    await asUser(pg, U.B, async () => {
      const access = await pg.query<{ a: Record<string, unknown> }>(`select public.my_trip_access('${T1}') as a`)
      expect(access.rows[0]!.a).toMatchObject({ role: null, removed: true })
    })
    await asUserCommit(pg, U.A, async () => { await pg.query(`select public.undo_remove('${T1}', '${M.B}')`) }, { anonymous: false })
    await asUser(pg, U.B, async () => {
      await pg.query(`select public.join_trip('${token}')`)
      expect(await sel(`select role k from public.trip_devices where user_id = '${U.B}'`)).toEqual(['pending'])
    })
  })

  it('only lets the creator, signed in with an account, claim a trip', async () => {
    const db = await migratedDb()
    await seed(db)
    await asUser(db, U.B, async () => { await expect(db.query(`select public.claim_trip('${T1}')`)).rejects.toThrow(/Only the person who created/) }, { anonymous: false })
    await asUser(db, U.A, async () => { await expect(db.query(`select public.claim_trip('${T1}')`)).rejects.toThrow(/Sign in/) })
    await asUser(db, U.A, async () => { await expect(db.query(`select public.set_access_mode('${T1}', 'hosted')`)).rejects.toThrow(/Only the organizer/) }, { anonymous: false })
    await db.close()
  }, 60000)

  it('lets the creator of a trip without an organizer remove people, and nobody else', async () => {
    const db = await migratedDb()
    await seed(db)
    await asUser(db, U.B, async () => { await expect(db.query(`select public.remove_from_trip('${T1}', '${M.C}')`)).rejects.toThrow(/Only the organizer/) })
    await asUser(db, U.A, async () => {
      await db.query(`select public.remove_from_trip('${T1}', '${M.C}', false)`)
      expect((await db.query(`select share_token from public.trips where id = '${T1}'`)).rows[0]).toEqual({ share_token: TOKEN })
    })
    await db.close()
  }, 60000)
})

describe('connected apps follow the roles', () => {
  it('cannot edit a hosted trip’s plan for a traveler, and still can for an organizer', async () => {
    const db = await migratedDb()
    await seed(db)
    const client = '66666666-6666-4666-8666-666666666666'
    await db.exec(`insert into private.connector_oauth_config (client_id, resource_url) values ('${client}', 'https://stowaway.example/mcp');
      insert into private.connector_edit_grants values ('${U.A}', '${client}'), ('${U.B}', '${client}');`)
    await asUserCommit(db, U.A, async () => {
      await db.query(`select public.claim_trip('${T1}')`)
      await db.query(`select public.set_access_mode('${T1}', 'hosted')`)
    }, { anonymous: false })
    const edit = (user: string, id: string) => db.exec(`begin; set local role postgres;
      select set_config('request.jwt.claims', '{"sub":"${user}","role":"stowaway_connector","is_anonymous":false,"client_id":"${client}","aud":"https://stowaway.example/mcp"}', true);
      select public.connector_mutate_itinerary('create', '${T1}', '${id}', null, '{"title":"Kayak","start_local":"2027-03-15 09:00","start_tz":"America/Guatemala"}');
      commit;`).catch(async (e) => { await db.exec('rollback'); throw e })
    await expect(edit(U.B, fresh(50))).rejects.toThrow(/organizers/)
    await edit(U.A, fresh(51))
    expect((await db.query(`select title from public.itinerary_items where id = '${fresh(51)}'`)).rows).toEqual([{ title: 'Kayak' }])
    await db.close()
  }, 60000)
})
