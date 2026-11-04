# Operator completion — 3 Nov 2026

Branch: `codex/operator-completion`, based on `main` at `e8563b5`.

Claude's `claude/keen-ptolemy-y4goja` branch is already an ancestor of main. Its operator implementation covers roles, claiming, offers, checkout, installments, refunds, reports, travelers, rooms, waitlists, referrals, campaigns and CSV imports. This pass completes gaps in those existing flows; it does not start the supplier/corporate phase or activate payments.

## Changes

- The operator dashboard waits for complete reads, announces loading, reports failures and offers keyboard-accessible retry. A failed bookings request no longer appears as zero revenue. Offline users can retry after reconnecting, and organizers without offers see a useful next step. Results from an unmounted dashboard are ignored.
- Trip totals and the payment screen share booking accounting. Retained cancellation payments remain collected; cancelled/refunded travelers do not occupy a spot or owe the remaining trip price. Deleted bookings are excluded. Partial refunds on active bookings do not create another payment obligation.
- Cancelled and refunded bookings remain available in a disclosure on the payment screen, including further refunds and dispute evidence. CSV history retains their payments and refunds with zero still due.
- Reports retain the queried dates with their results. Changing inputs, or failing to load another period, cannot relabel an old report or its CSV. Periods with only bank payouts still display those payouts.
- Sign-in from `/organize` remembers the dashboard as its return destination. Return validation permits only existing trip paths and four exact operator routes.
- CI now includes the operator and access-role browser suites. Vitest uses two workers because each database suite boots a separate Postgres WASM instance.
- Corrected the clone-trip test to compare timestamps explicitly in UTC while preserving the wall-clock and DST assertions. Corrected the early-access test to wait for its asynchronous IndexedDB event before reloading.
- Updated the plan and owner setup notes to distinguish completed migrations from remaining account/function setup.

## Verification

The implementation checks below use local PGlite and browser fixtures with external services blocked. A subsequent staging setup pass also exercised the real Supabase boundary, as described below. No real payment or email was created.

| Check | Result |
|---|---|
| Typecheck, app and test configurations | Passed on Node 24.22.2 |
| Full unit/database suite | 83 files, 602 tests passed on Node 24.22.2 |
| Production build and PWA generation | Passed on Node 24.22.2; existing map bundle-size warnings remain |
| Browser regressions | 72 unique cases verified across 15 specs: access roles, appearance, booking questions/rooms, campaigns, first run, guest flows, imports, journal, dashboard/reports, pricing/operators, payment offer, payments, referrals, repeat business and recap |
| Browser run detail | The combined run passed 71 cases; its new cancellation-history fixture needed a reload because native IndexedDB writes do not notify Dexie. After fixing the fixture, all six payment cases passed, including history and remaining refunds. |
| Visual review | Inspected dashboard, error/retry, report and booking-history screenshots at 390×844 and 1280×844. No page-width overflow in the exercised states. |
| Interaction | Checked keyboard retry/focus, named loading/error/status elements, sign-in return, offline recovery and actual downloaded report contents. The dashboard success case records no uncaught browser errors. |

Screenshots are generated under `test-results/operator-verified/`; the corrected payment-history captures are under `/tmp/stowaway-operator-history/`. These are local verification artifacts, not committed assets.

## Connected staging verification

Initialized the owner's existing free `stowaway-staging` project (`knufofvmqopuvijvtzow`) with all 34 migrations, canonical migration versions, payment cron jobs and staging Vault settings. Deployed all six payment Edge Functions and checked their authentication guards over the network. Enabled auth methods were inspected, not weakened; email confirmation remains enabled.

The local staging frontend at `http://localhost:5173` passed browser → Supabase → second browser verification: anonymous sign-in, trip creation, itinerary save, invite join, member creation and itinerary pull. The test made no requests to production, recorded no uncaught browser errors, and its test trips were deleted afterwards. The first smoke harness navigated before member claiming completed; waiting for the overview route corrected that harness race.

Created two Snapshot webhook destinations in the owner's Stripe sandbox, pointing only to staging. Their event subscriptions include connected-account disconnections. Installed both signing secrets and pinned the Stripe API version. Payment and email verification remains pending a permanent Stripe server key and creation/consent for the dedicated Gmail sender. See `OWNER_SETUP.md` for the current account and endpoint references. No production backend configuration was changed.

The existing Cloudflare Preview command requires a `previews` block, absent from the repository. Added staging Worker bindings and branch-build selection of `.env.staging`; main retains `.env.production`. Typechecking passed, and both built browser bundles were inspected to verify that each contains only its intended database URL.

Cloudflare deployed the Preview successfully at https://codex-operator-completion-trip-hub.alexanderclem12.workers.dev. The same two-browser trip/itinerary/invite/sync check passed there against staging, with production requests blocked and no uncaught browser errors. Its test trip was cleaned up. Staging's email/checkout URLs and exact Auth callback allowlist now use that host. The keepalive workflow includes staging.

A fresh CI run also exposed an existing fixture race in the journal suite: the trip-ideas heading could render before Dexie initialized its stores. Journal and guest fixtures now wait for the empty home state produced by a completed database read before seeding IndexedDB.

## Remaining work before launch

Production's earlier migration status follows Claude's recorded 2 Nov check. The separate staging project and function deployment were independently inspected and configured in this pass.

1. Finish permanent Stripe key installation in the initialized staging project, and create/authorize the transactional Gmail sender.
2. Complete deposit → booking → installments → refund → webhook/ledger reconciliation and email-delivery checks against the deployed staging functions. Local fixtures and the staging planner sync check do not prove payments work.
3. Complete the plan's operator validation and launch review, then the owner-controlled production setup in `OWNER_SETUP.md`. Physical iPhone, Home Screen offline/push and screen-reader checks remain manual.
4. Pro entitlements and the free beta exist; paid Pro subscription billing remains unimplemented and its price undecided. Campaign delivery remains disabled pending a domain sender. These original Phase 2 acceptance criteria are not complete merely because their screens exist.
5. Phase 4's comparison page, migration offer and operator outreach remain unshipped. Phase 3's supplier/corporate work retains the original revenue or signed-pilot prerequisite.

No schema migration is needed for this branch. The financial changes affect display/export of existing booking records, not charges, refunds, ledger posting or fee calculations.
