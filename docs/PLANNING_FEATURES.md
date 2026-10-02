# Up next, tasks, and travel buffers

The Plan screen now shows the next scheduled item for the selected member, its attendees,
linked ticket, map shortcut, and a suggested departure from the previous known stop.
The departure uses the upper travel-time estimate and refreshes every 30 seconds or when
the app becomes visible. The trip/phone time toggle applies to this card too.

Travel warnings follow each person's consecutive stops within a trip-local day and merge shared routes. They use
the arrival place for transport and flights, prefer reported/typical/routed evidence over
straight-line estimates, and label the source. They do not invent an end time or skip over
an unknown location. Lodging, all-day, cancelled, and removed items are excluded. Existing
overlap warnings handle negative gaps. Check-in and waiting buffers are not included.

Tasks are available under More → Tasks and from the Plan shortcut. Each task supports an
owner, optional due date, notes, editing, completion/reopening, and removal. Completion is
a boolean, not a tombstone. Tasks use a new Dexie v8 store and the existing outbox/sync path.
Due dates follow the trip's calendar. Forms keep edits intact during background sync.

## Release (2 Oct 2026)

The migration must be live before the frontend, which would otherwise sync to a missing table.

1. `supabase/migrations/20261005000001_trip_tasks.sql` was applied to project
   `croqjdvzbpcscdcshnet` (recorded in the migration history as `20261002185822 trip_tasks`).
2. Checked in the live database afterwards:
   - row-level security is on, with `select` / `insert` / `update` policies for `authenticated`
     that all require `has_trip_access(trip_id)`, and no delete policy
   - the `sync_guard` and `validate_trip_task` triggers run before insert and update
   - indexes on `(trip_id, updated_at)` and `(assignee_id)`
   - the table is in the `supabase_realtime` publication
   - assigning a task to a member of another trip is rejected ("Assignee must belong to
     this trip")
3. Security advisors show only the two expected kinds of warning (SECURITY DEFINER RPCs and
   "Anonymous access policies", now including `trip_tasks`) plus the leaked-password notice
   that predates this change and doesn't apply to anonymous sign-in.
4. The frontend was then pushed to `main`, which deploys through Cloudflare.

## Verification

- `npm.cmd run typecheck` — passes.
- `npm.cmd test` — 141 passing tests, including attendee-specific travel logic, offsets,
  missing locations/end times, offline task writes, and a two-device sync simulation.
- `npm.cmd run build` — production build succeeds (existing large-chunk warning remains).
- `npx.cmd playwright test tests/e2e/planning-features.spec.ts` — two passing browser flows
  against the production build. Fixtures live only in the test browser's IndexedDB; external
  requests are blocked. Covers task CRUD, filters, keyboard completion, reload persistence,
  outbox payloads, departure/time-zone updates, ticket navigation, and no page exceptions.
- `npx.cmd playwright test tests/e2e/tasks-sync.spec.ts` — one passing flow against **live
  Supabase**, with two independent browser sessions on a disposable
  `E2E TEST planning features …` trip:
  - Alex creates a task assigned to Sam; Sam's phone receives it.
  - Sam edits and completes it; both phones converge. Alex reopens it; Sam sees it reopen.
  - Sam goes offline, renames, reassigns and completes it. The server row is unchanged while
    Sam is offline, and Alex's phone catches up after Sam reconnects.
  - Alex removes it; the list empties on Sam's phone and the server row has `deleted_at` set.
  - A third signed-in device that never joined gets no rows on read, changes nothing on
    update or delete, and is refused on insert. The publishable key alone reads nothing, and
    a member's hard delete does nothing.

  It uses three anonymous sign-ins per run (see the rate limit in CLAUDE.md) and prints the
  trip and user ids so that only those are cleaned up.
- Screenshots at 320, 390, 768, and 1280 CSS pixels and with 200% CSS zoom; checked for
  horizontal page overflow. CSS zoom is a reflow check, not a physical iPhone zoom test.

Real iPhone Safari and a screen reader still need a release check.
