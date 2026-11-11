PHASE 07 — Travel essentials, trustworthy balances, and honest offline readiness
Read 00_MASTER_BRIEF.md, UX architecture and all progress. These features carry consequential information; excellent UX here means fast access, accurate states, safe recovery rather than aesthetic effects. Execute in small vertical slices (tickets, money, offline/sync), each with real data tests. Avoid modifying payment, pricing or booking infrastructure.
Part A — Tickets, confirmations, and travel-day access
Inspect
src/features/tickets/, src/features/itinerary/{UpNextCard,Agenda,ItemDetailScreen}.tsx, src/features/trips/TripOverviewScreen.tsx, src/features/offline/, ticket download storage, and current offline-attachment state helpers.
Implement
- Establish a coherent Ticket/`Document` record row with human-readable title, linked event, travel time/date if known, and On this phone / Download required / Upload pending / Unavailable status. Display only verified information from data. No generic "Saved" checkmark for a file that exists remotely but has not downloaded locally.
- Make it obvious to retrieve the next required ticket from the travel-phase Home or its event detail. Keep a stable all-tickets list reachable from the chosen navigation. Contextual Open ticket action should work offline only if the file is actually available on that device; otherwise present a truthful error/recovery.
- Ensure upload/import, linking to an itinerary item, scan/attachment previews, download failures and storage limitations still work. No unsafe object-URL lifecycle changes, silent loss of attachments, or opaque technical errors.
- Use accessible document preview, a plain alternative link when supported, and clear fallback if the preview format is unsupported.
Test
0/1/30 tickets; 1 event with multiple tickets; large/long filenames; no local download; pending remote upload; offline after successful download; file unavailable; invalid attachment; permission limits; dark mode, zoom, keyboard, phone safe areas.
Part B — Shared expenses and balances
Inspect
src/features/money/{MoneyScreen,BudgetSummary,ExpenseFormScreen,CollectPayments}.tsx, src/lib/{money,fx}.ts, src/features/money/build.ts, and existing test cases. Read CLAUDE.md money rules: minor units, per-entry exchange rate, base vs local currency, fair splits, actual settlement algorithms.
Implement
- Give users one dominant net balance or You owe / You are owed / All settled figure that is immediately readable on mount; no rolling financial numbers. Make who owes whom, expense source, currency, and balance sign unambiguous.
- Expose Add expense as the contextual action. Expenses should show who paid, who shares, amount, date, and pertinent FX explanation without burying the list under excessive summary cards.
- Forms prioritize Amount, Description, Paid by, Split with; advanced split method, FX and optional details are progressively disclosed yet easily adjusted. Existing exact, share, percent and equal split methods must remain functional. Show the impact and validation before save where relevant. Prevent duplicate submissions and show local save vs sync separately.
- Settlement should be labeled clearly as a suggestion for paying outside Stowaway. Never imply actual transfer, successful refund, payment received or Stripe transaction for ordinary group settle-up. If group organizer payment collection is a separate product, keep its authorized UI isolated and untouched.
- All figures preserve integer minor units, currency symbols/codes, rounding and transaction correctness. No recalculation with floating-point display hacks. Don't present a converted amount as the ledger base without disclosure.
Test
Zero balances, owes, owed, 8-person shared purchase, split with subsets, exact splits, shares, percentages, currencies with non-2 decimal minor units if existing support, offline stale FX, old FX snapshots, partial settlements, many transactions, invalid payer/amounts, rejection after local save, long text, keyboard/zoom/dark.
Part C — Offline readiness and synchronization
Inspect
src/features/offline/OfflineReadyCard.tsx, src/features/install/InstallAppDialog.tsx, src/features/trips/JoinerWelcome.tsx, src/features/sync/SyncStatus*, src/data/sync/{controller,engine,remote}.ts, src/features/map/offline/, ticket download helpers and existing November 5 fixes/tests. Do not rewrite working sync safeguards or table invalidation just to simplify a label.
Implement a coherent readiness model
- Installation != preparation. Installing the PWA allows easy launching, but separate per-phone downloads are needed before it is offline ready. All first-run/invite/settings copy agrees on this.
- Make readiness a compact high-level result (Ready on this phone, Still preparing, Needs attention, or another exact data-backed set) plus an expandable per-part breakdown: trip data; tickets/docs; map pack; app shell; exchange rates; optional weather. Do not aggregate partially skipped steps into false success. Explain what is optional and what blocks readiness.
- Distinguish: network offline, locally saved/queued, uploading, synced with remote, rejected write, downloaded locally, stale data. A green check means only the operation that actually completed. Old unresolved rejections must not disappear after a successful pull.
- Progress should be stable and non-verbose on small phones, with failures visible immediately and a recovery action (Retry, Download missing tickets, Open map settings, etc.). Do not expose seven large technical step cards by default.
- Provide a useful offline checklist before travel, not an obstructive modal every time the user opens the app. Keep no-signal normal travel use clean and truthful.
- Respect the existing flow that map tiles may need a destination and separate download, that documents may still be awaiting another phone's upload, and that storage/Service Worker support differs across browsers.
- For any sync change, protect recent local edits, deadletter history and permission refreshes; introduce targeted tests for race conditions. If no underlying bug is reproduced, stay within presentation and messaging.
Test matrix
- Online ready device, online unprepared device, airplane mode with complete downloads, airplane mode without tickets/map, service worker absent, denied storage, interrupted downloads, cache eviction, recovery after reconnect, rejected write that later resolves, permission change during sync, multiple devices different readiness.
- Real content still renders from IndexedDB while offline; link targets do not redirect to an empty marketing page; user never loses edits due to a visual refactor.
- Browser navigation, screen reader/status announcements when possible, 320/390px, long labels and zoom, dark/reduced motion.
Composite acceptance scenario
A traveler at an airport with no signal opens their trip. They can immediately find the next event, view the right ticket if it was saved, recognize when it was not saved, see the plan and cached map if ready, and confidently know whether an expense they add is locally saved vs shared with the group. Everything must work without a fake network-success badge.
Phase exit requirements
- Clear before/after screens for ticket list/detail, Money overview/add, Offline status in complete/partial/error states.
- Focused data tests cover all affected storage and FX calculations; existing offline/sync regression suite passes.
- Manual browser scenarios substantiate the copy and controls; limitations of simulated offline vs physical iPhone explicitly documented.
- User-visible status wording is accurate across onboarding, Home, Settings and dedicated screens.
- No live payments, booking attempts or real attachments are created; no changes to server/database configuration just to achieve UI polish.
Update PROGRESS.md with per-subsystem verdicts and known limitations before moving on.
