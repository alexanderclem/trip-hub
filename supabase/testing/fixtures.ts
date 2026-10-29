// A small but complete trip, written straight into the database (bypassing RLS), for access tests.
// Only uses columns that existed before 20261030000001_access_roles.sql, so the same data can be
// loaded into a database with and without that migration.

import type { PGlite } from '@electric-sql/pglite'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const U = { A: id(1), B: id(2), C: id(3), X: id(4), O: id(5) } // users (phones)
export const T1 = id(10)
export const T2 = id(11)
export const M = { A: id(20), B: id(21), C: id(22), X: id(23) } // members
export const P = { p1: id(30), p2: id(31), x1: id(32) }
export const POLL = id(40)
export const OPT = id(41)
export const EXP = { e1: id(50), e2: id(51) }
export const ATT = { trip: id(60), own: id(61), staff: id(62) }
export const PACK = { shared: id(70), personal: id(71) }
export const TOKEN = 'trip-one-link-token'

/** Tables each user's visibility is compared on, with the column that identifies a row. */
export const TABLES: Record<string, string> = {
  trips: 'id', members: 'id', trip_devices: "trip_id || '/' || user_id", places: 'id', links: 'id', route_legs: 'id',
  leg_overrides: 'id', polls: 'id', poll_options: 'id', poll_votes: 'id', place_ratings: 'id', itinerary_items: 'id',
  day_notes: 'id', expenses: 'id', settlements: 'id', fx_snapshots: 'id', attachments: 'id', trip_tasks: 'id',
  member_preferences: 'id', packing_items: 'id', packing_checks: 'id', member_safety: 'id', comments: 'id',
}

export async function seed(pg: PGlite): Promise<void> {
  let n = 100
  const next = () => id(n++)
  const t1 = `'${T1}'`
  await pg.exec(`
    insert into auth.users (id) values ('${U.A}'), ('${U.B}'), ('${U.C}'), ('${U.X}'), ('${U.O}');
    insert into public.trips (id, name, share_token, created_by) values
      (${t1}, 'Trip one', '${TOKEN}', '${M.A}'), ('${T2}', 'Trip two', 'trip-two-link-token', '${M.X}');
    insert into public.members (id, trip_id, display_name) values
      ('${M.A}', ${t1}, 'Ana'), ('${M.B}', ${t1}, 'Ben'), ('${M.C}', ${t1}, 'Cy'), ('${M.X}', '${T2}', 'Xi');
    insert into public.trip_devices (trip_id, user_id, member_id) values
      (${t1}, '${U.A}', '${M.A}'), (${t1}, '${U.B}', '${M.B}'), (${t1}, '${U.C}', '${M.C}'), ('${T2}', '${U.X}', '${M.X}');
    insert into public.places (id, trip_id, name, created_by) values
      ('${P.p1}', ${t1}, 'Cafe', '${M.A}'), ('${P.p2}', ${t1}, 'Lake', '${M.B}'), ('${P.x1}', '${T2}', 'Elsewhere', '${M.X}');
    insert into public.links (id, trip_id, place_id, url) values ('${next()}', ${t1}, '${P.p1}', 'https://example.com');
    insert into public.route_legs (id, trip_id, from_place_id, to_place_id, mode, source, distance_m, duration_s)
      values ('${next()}', ${t1}, '${P.p1}', '${P.p2}', 'walk', 'osrm', 100, 60);
    insert into public.leg_overrides (id, trip_id, place_a_id, place_b_id, mode, min_s, max_s)
      values ('${next()}', ${t1}, '${P.p1}', '${P.p2}', 'boat', 60, 120);
    insert into public.polls (id, trip_id, title, created_by) values ('${POLL}', ${t1}, 'Dinner?', '${M.A}');
    insert into public.poll_options (id, trip_id, poll_id, label) values ('${OPT}', ${t1}, '${POLL}', 'Tacos');
    insert into public.poll_votes (id, trip_id, poll_id, option_id, member_id, score)
      values ('${next()}', ${t1}, '${POLL}', '${OPT}', '${M.B}', 3), ('${next()}', ${t1}, '${POLL}', '${OPT}', '${M.C}', 1);
    insert into public.place_ratings (id, trip_id, place_id, member_id, stars) values ('${next()}', ${t1}, '${P.p1}', '${M.B}', 4);
    insert into public.itinerary_items (id, trip_id, title, start_local, start_tz)
      values ('${next()}', ${t1}, 'Breakfast', '2027-03-14 08:00', 'America/Guatemala');
    insert into public.day_notes (id, trip_id, date) values ('${next()}', ${t1}, '2027-03-14');
    insert into public.expenses (id, trip_id, description, spent_on, amount_minor, currency, fx_rate, base_currency,
        base_amount_minor, payers, split_method, split, created_by) values
      ('${EXP.e1}', ${t1}, 'Boat', '2027-03-14', 2000, 'USD', 1, 'USD', 2000,
        '[{"member_id":"${M.A}","amount_minor":2000}]', 'equal', '[{"member_id":"${M.A}","value":1},{"member_id":"${M.B}","value":1}]', '${M.A}'),
      ('${EXP.e2}', ${t1}, 'Hotel', '2027-03-14', 9000, 'USD', 1, 'USD', 9000,
        '[{"member_id":"${M.A}","amount_minor":9000}]', 'equal', '[{"member_id":"${M.A}","value":1},{"member_id":"${M.C}","value":1}]', '${M.A}');
    insert into public.settlements (id, trip_id, from_member_id, to_member_id, amount_minor, currency, fx_rate, base_amount_minor, paid_on)
      values ('${next()}', ${t1}, '${M.B}', '${M.A}', 1000, 'USD', 1, 1000, '2027-03-15'),
             ('${next()}', ${t1}, '${M.C}', '${M.A}', 4500, 'USD', 1, 4500, '2027-03-15');
    insert into public.fx_snapshots (id, trip_id, base, rates, as_of) values ('${next()}', ${t1}, 'USD', '{"GTQ":7.7}', '2027-03-14');
    insert into public.attachments (id, trip_id, title, storage_path, filename, mime, bytes, sha256) values
      ('${ATT.trip}', ${t1}, 'Boat tickets', '${T1}/${ATT.trip}/t.pdf', 't.pdf', 'application/pdf', 10, 'x'),
      ('${ATT.own}', ${t1}, 'Ben passport', '${T1}/${ATT.own}/p.jpg', 'p.jpg', 'image/jpeg', 10, 'y'),
      ('${ATT.staff}', ${t1}, 'Hotel contract', '${T1}/${ATT.staff}/c.pdf', 'c.pdf', 'application/pdf', 10, 'z');
    insert into storage.objects (bucket_id, name) values
      ('attachments', '${T1}/${ATT.trip}/t.pdf'), ('attachments', '${T1}/${ATT.own}/p.jpg'), ('attachments', '${T1}/${ATT.staff}/c.pdf');
    insert into public.trip_tasks (id, trip_id, title, assignee_id) values ('${next()}', ${t1}, 'Book the shuttle', '${M.B}');
    insert into public.member_preferences (id, trip_id, member_id, scores)
      values ('${next()}', ${t1}, '${M.B}', '{"adventure":50,"nature":50,"culture":50,"food":50,"nightlife":50,"relaxation":50,"comfort":50,"budget":50}');
    insert into public.packing_items (id, trip_id, title, kind) values ('${PACK.shared}', ${t1}, 'Sunscreen', 'everyone');
    insert into public.packing_items (id, trip_id, title, kind, owner_id) values ('${PACK.personal}', ${t1}, 'Book', 'personal', '${M.B}');
    insert into public.packing_checks (id, trip_id, item_id, member_id, state) values ('${next()}', ${t1}, '${PACK.shared}', '${M.B}', 'packed');
    insert into public.member_safety (id, trip_id, member_id) values ('${next()}', ${t1}, '${M.B}'), ('${next()}', ${t1}, '${M.C}');
    insert into public.comments (id, trip_id, subject_type, subject_id, member_id, body) values ('${next()}', ${t1}, 'poll', '${POLL}', '${M.B}', 'Yes!');
  `)
}

/** Runs one statement in a savepoint; returns its rows, or 'error' if the database refused it. */
export async function attempt(pg: PGlite, sql: string, params: unknown[] = []): Promise<Record<string, unknown>[] | 'error'> {
  await pg.exec('savepoint attempt')
  try {
    const r = await pg.query<Record<string, unknown>>(sql, params)
    await pg.exec('release savepoint attempt')
    return r.rows
  } catch {
    await pg.exec('rollback to savepoint attempt')
    return 'error'
  }
}
