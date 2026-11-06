# Travel feature parity — 4 November 2026

Branch: `codex/travel-feature-parity`. The free planner remains free. No new paid service or dependency is required.

## Implemented

| Capability | Entry point | Behavior and limits |
| --- | --- | --- |
| Reviewed reservation/place imports | More → Import reservations & places | Paste booking text or read a PDF, screenshot, text file, or raw email. The existing Workers AI binding extracts up to 20 entries. Review/edit/select before saving. Dated entries are tentative; undated entries become saved places. Imports queue normal offline writes atomically, skip identical retries, and never restore removed rows. Source links are retained but their pages are not fetched. Original files are not automatically attached. |
| Unified trip search | More → Search this trip | Searches locally saved plans, places, document text/details, day notes and tasks. Accent-insensitive, multiple terms, no network required. Results are trip-scoped and exclude removed rows. |
| Arrival buffers | Add/edit a timed plan → Arrive early | Explicit 0–1,440 minute buffer. Included in transfer warnings, leave-by times, and published reminder calculations. Detail and Up next show the target arrival time. No airline policy is assumed. A departure estimate still needs a previous located stop. |
| Calendar subscriptions | Trip settings → Keep your calendar updated | Separate 256-bit link, personal attendee filter, one-year expiry, replace/revoke controls. No notes, codes, documents, expenses, invite token, or attendee roster. Revoked access, access-epoch changes, changed traveler identity, pending roles and removed trips invalidate the link. Calendar apps control refresh timing. Static offline `.ics` export remains available. |
| Multi-stop routes | More → Build a multi-stop route | 2–20 saved places; keyboard-accessible reordering; per-leg transport; dwell time at intermediate stops; departure and arrival preview; upper travel-time estimates. Missing routes produce an explicit error. Save creates tentative transport items for everyone in one offline transaction. |
| Booking policy extraction | Tickets → document → Pull out details | Optional baggage, breakfast, parking and cancellation fields. Extracted only from printed source details; older documents remain compatible. AI extraction requires signal. |
| Cross-trip travel history | All trips → Your travel history | Past trips saved on this device, filtered to the selected traveler. Countries in those trips, deduplicated hotel nights, scheduled flight time and straight-line transport distance. Clearly labeled as plans rather than verified travel. |
| Proximity sorting | Places → Sort → Nearest to a place | Pick a saved hotel or other pinned place; sort by straight-line distance. Missing pins sort last. Works offline. |

## Release order

1. Apply `20261104070413_calendar_subscriptions.sql` to staging after committing the migration. It adds a private, RLS-protected token table and three narrow RPCs; it does not change existing synced tables.
2. Exercise the branch preview with its isolated staging database and existing free Workers AI binding. Verify imports, calendar updates/revocation, and normal sync.
3. After review, apply the same committed migration to production **before** releasing the frontend/Worker. Reverting the frontend does not require dropping the additive database objects.

## Remaining work from the comparison

These are not represented as implemented by this release:

- **Inbound email forwarding/inbox:** needs an inbound address, authenticated routing, bounded MIME parsing, sender-to-account/trip mapping, attachment storage, deduplication and an inbox review flow. Pasting an email or reading its text is supported now; that is not automatic email forwarding.
- **Background flight alerts:** existing Aviationstack lookups remain manual. Requires verified provider coverage/credentials, polling budget, change tracking and push delivery. The repository prohibits unapproved paid/background API usage.
- **Direct Google/Apple Maps list and web/social URL import:** importing their visible text is supported; fetching and parsing linked content is not. Restricted/private links must never be presented as successfully read.
- **Personal calendars inside the itinerary:** calendar subscriptions publish Stowaway events outward; no OAuth calendar read integration is introduced.
- **External assistant write tools:** the connector remains read-only. Write scopes, role-aware tools and confirmation/idempotency behavior need a separate security-tested implementation.
- **Reusable companions and addresses:** no account-wide favorites library or automatic invitations is added.
- **Native Apple apps, widgets, Spotlight and Shortcuts:** no native Apple project or developer signing setup exists in this web-app repository.
- **More selective consumer trip duplication and configurable itinerary density:** existing operator cloning remains unchanged.

## Verification

All unit/database suites passed: **90 files, 622 tests**. Type checking and the production build passed. Calendar SQL runs against all existing migrations in PGlite; tests cover membership, raw-table denial, sanitized payloads, attendee filtering, live edits, token rotation/revocation/expiry and access changes. Import tests cover atomic offline/outbox writes, invalid/DST dates, cross-zone flights, retries, sticky removals and permission failures. Worker tests cover authentication, cross-origin requests, safe calendar errors and refusal to fetch pasted URLs.

Hosted staging passed the real sign-in → trip/item writes → anonymous sanitized calendar feed → hosted ICS conversion (including New York DST) → live edit → revocation flow. The deployed Workers AI import endpoint returned review entries and created no itinerary rows automatically. The temporary staging trip and anonymous user were removed and their absence verified. Migration history matches the committed version `20261104070413`; production is unchanged.

Local Chromium checks exercised booking-code search, editable import review and saving, offline route creation, arrival-buffer editing/persistence, and screenshots of search/import/routes/settings/history at 320, 390 and 1280 CSS pixels. The existing travel-day browser regression passed after preserving its check-in guidance and adding the new buffer instruction. Screenshot artifacts are retained locally outside the repository.

The complete repository browser set exercised 80 checks: 79 passed in the combined run. The recap fixture exposed a cold-start IndexedDB setup race; after adding the same database-ready wait used by other fixtures, that final check passed three consecutive runs. No product behavior was weakened to satisfy the test.

Staging security advisors flag the new deny-by-default private token table and intentionally callable token RPCs. The table has RLS and no client grants; direct anonymous and authenticated reads were verified denied. The public feed RPC requires an unguessable, unexpired token and rechecks current trip access. See the [RLS advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [token RPC advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) for the generic findings.

Physical iPhone Safari, screen-reader testing, external calendar-app refresh behavior, inbound email and real flight-push delivery are not covered by these checks.
