# Planning upgrades — November 5, 2026

Scope: actionable schedule warnings, private personal budgets, and winning votes through itinerary and booking follow-up. These extend the existing local database, outbox, permissions, forms, and design system. No new service, dependency, database table, or server migration is required.

## Schedule warnings and fixes

Plan → **Review fixes** is available beside short travel connections and overlapping activities for people who can edit the plan. The review offers moving the next activity later or the earlier activity earlier. Each option shows its full before/after range in the selected display timezone. Saving is explicit and supports guarded undo.

- Travel uses the upper end of the existing evidence hierarchy: reported, typical, routed, then straight-line estimate. It does not make network requests.
- More options in the itinerary form now includes check-in/preparation and waiting minutes, each 0–1,440. These are saved as string values in the existing itinerary `details` object. They affect warnings, leave-by guidance, and notification reminder timestamps. Preparation at the same place needs no invented journey.
- Automatic suggestions preserve elapsed duration and each end's timezone. Flights and items with confirmation codes are fixed; lodging and all-day items are excluded.
- A suggestion is disabled if it creates another overlap, worsens another known travel connection, fails to resolve the original warning, or leaves the trip dates. Unknown earlier end times require manual review rather than an invented duration. Unrepresentable repeated-clock-hour moves also require manual review.
- Immediately before saving, one IndexedDB transaction rereads the itinerary, trip dates, people, places, and route evidence. A changed itinerary or materially different proposal is rejected. Undo refuses to overwrite an item edited since the fix.
- Suggestions reason about saved information only. They do not verify opening hours, transport timetables, or booking availability.

## Private budgets

Money → **What this trip costs you → Set a budget** supports setting, editing, and removing a target, including on an empty trip. Targets use the trip's base currency and integer minor units; zero is valid.

- Targets live only in `_meta` under `budget:<trip>:<member>`. They never enter synced tables, the outbox, shared preferences, exports, or Stowie's snapshot. Clearing a trip removes its local targets. Clearing browser data removes them; they do not follow an account to another phone.
- The existing forecast combines the person's share of logged expenses with their share of unlogged itinerary estimates. Settlement payments do not count as more spending. Linked expenses replace estimates. Explicit zero estimates count as free; missing or unconvertible estimates remain visibly incomplete.
- The itinerary form previews the person's share, the resulting total, and the remaining or over-budget amount before saving. Editing replaces the original estimate in that preview. It does not add it twice. Excluded attendees do not receive an estimated share.
- Exceeding a target is advisory and never blocks the group from scheduling an activity. Currency conversions use the existing saved or fallback rates and remain approximate.

## Winning votes to plans

A closed vote's **Add to the plan** opens **Schedule group choice**. The form carries the winning place or text, notes, and booking URL. Positive voters who are still trip members are suggested attendees; these are editable and are not presented as confirmed attendance. The person chooses the schedule and estimated group cost, with their private budget impact visible.

**Create a booking task** optionally adds a current owner and a deadline on or before the activity. The task does not make a reservation. The saved itinerary links back to the vote and booking task; the task links to the itinerary. Completion uses the existing Tasks flow, while reservation status and confirmations remain explicit itinerary edits.

- The itinerary, place status, booking task, and their outbox entries commit in one local transaction. A failed task write leaves no partial itinerary or place update; the form retains entered values for retry.
- A deterministic ID per trip/poll/option prevents duplicate local entries and gives separate phones the same identity. Normal per-row last-write sync rules still apply to simultaneous offline edits.
- Saving rereads the vote and option. Reopened votes, changed winners, deleted/foreign options or places, former attendees/owners, and invalid deadlines are rejected. Deleted/cancelled generated entries are not resurrected.
- The result shows **View in the plan** for an existing entry. Date votes retain their separate trip-date action. Hosted travelers cannot schedule choices, close votes, or apply fixes; their private budget remains available.

## Verification

`npm run typecheck`, the full unit/database suite (94 files, 702 tests), and `npm run build` passed. The production build retains its existing map-related large-chunk warning. The source design scan found zero anti-pattern failures, with existing advisory notes. Focused tests cover guarded fix/undo behavior, route-evidence changes, duration preservation, split attendance, currency precision, zero budgets, missing prices, winner changes, duplicate saves, permissions, transaction rollback, and retry. A two-database sync test verifies that the shared plan/task and arrival buffers reach another phone while the target remains private.

Browser evidence uses disposable IndexedDB fixtures with external requests blocked: budget persistence and failure recovery; complete winner/booking-task flow; schedule preview/save/undo; stale-preview rejection; cost-edit projections; hosted access; 320/390/1440px; light/dark themes; reduced motion; keyboard dialog focus; and enlarged text. Existing local regressions cover rescheduling, copying, ticket review, date voting, deadline finalization, and trip cost forecasting.

Eighteen distinct browser cases passed: ten in `planning-upgrades.spec.ts`, one in `trip-cost.spec.ts`, four relevant itinerary regressions, and three vote-sharing/date/deadline regressions. The deadline test now expects the intentional source-poll URL. Clipboard assertions normalize Windows CRLF while preserving the exact shared content. No claim is made that the entire legacy browser suite was run; several older suites use the live backend.

Captures are in the ignored `test-results-planning-confirm/shots/` directory. No live trips, production configuration, deployment, or physical iPhone/Safari session were changed or exercised. Concurrent pre-existing workspace edits were retained.
