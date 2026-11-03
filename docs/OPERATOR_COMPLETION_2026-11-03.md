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

All backend tests use local PGlite. Browser checks use synthetic sessions, IndexedDB fixtures and intercepted requests, with external services blocked. No real trip, payment or email was created.

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

## Remaining work before launch

The deployment status here follows Claude's recorded 2 Nov migration check; this pass did not independently inspect live administrative state or deploy anything.

1. Establish the isolated staging Supabase project and configure Stripe Connect/test-mode webhooks plus the transactional Gmail sender.
2. Configure secrets, deploy payment functions to staging, and complete deposit → booking → installments → refund → webhook/ledger reconciliation and email-delivery checks. Local fixtures do not prove external integrations work.
3. Complete the plan's operator validation and launch review, then the owner-controlled production setup in `OWNER_SETUP.md`. Physical iPhone, Home Screen offline/push and screen-reader checks remain manual.
4. Pro entitlements and the free beta exist; paid Pro subscription billing remains unimplemented and its price undecided. Campaign delivery remains disabled pending a domain sender. These original Phase 2 acceptance criteria are not complete merely because their screens exist.
5. Phase 4's comparison page, migration offer and operator outreach remain unshipped. Phase 3's supplier/corporate work retains the original revenue or signed-pilot prerequisite.

No schema migration is needed for this branch. The financial changes affect display/export of existing booking records, not charges, refunds, ledger posting or fee calculations.
