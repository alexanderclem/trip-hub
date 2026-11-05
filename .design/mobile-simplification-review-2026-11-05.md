# Mobile simplification review — November 5, 2026

Scope: recommendations for reducing reading and decision load, with supporting sync improvements. Product files unchanged.

## Evidence and limits

- User reports that mobile presents too much text and feels overwhelming.
- Inspected current overview, agenda, plan, trip creation, More, offline preparation, sync status, sync engine, remote adapter, controller, and CI configuration.
- Visually inspected the existing November 4 phone overview and itinerary captures in `screenshots/travel-experience/`. These are historical evidence, not fresh captures of HEAD; current source already removes some copy seen there.
- Ran `npm test -- src/data/sync/controller.test.ts src/data/sync/engine.test.ts`: 21 tests passed in two files.
- No fresh browser session, physical iPhone/Safari evaluation, live database inspection, or production load measurement. Backend concerns below are follow-up targets, not reproduced production incidents.

## Findings

| ID | Severity | Area | Location / evidence | Current behavior | Proposed correction | User impact |
|---|---|---|---|---|---|---|
| MS-01 | MEDIUM | Overview scope | `src/features/trips/TripOverviewScreen.tsx:142`; user feedback | Depending on data and phase, home includes activity, priority, navigation, day preview, saved places, personal needs, group decisions, setup, group and essentials. | Make the mobile default a compact trip header, one priority, and a short day preview. Move other content to existing destinations; retain direct access to urgent problems. | Fewer simultaneous decisions and less repeated reading. |
| MS-02 | LOW | Duplicate paths and summaries | `src/features/trips/TripOverviewScreen.tsx:151`, `:170`, `:178` | Votes can appear as priority, planning link, personal needs, group decisions, and bottom tab. Money/group summaries also repeat. | Give each piece of information one primary home. Keep one contextual shortcut when useful, with counts instead of repeated lists. | Clearer routes and a shorter overview. |
| MS-03 | LOW | Agenda metadata | `src/features/itinerary/Agenda.tsx:42` | Rows include title, time, place, status, author, and sometimes ticket text; place can duplicate the activity title. | Default to time, activity and useful location. Hide duplicate location and author from the list; retain tentative status, conflicts and essential ticket access. | The plan is easier to scan while traveling. |
| MS-04 | LOW | Trip creation | `src/features/trips/CreateTripScreen.tsx:124` | The form exposes name, traveler name, dates, destination, timezone and currencies, with explanations. | Lead with names, destination and optional dates. Show inferred timezone/currencies in an editable secondary section, with safe defaults and explicit correction access. | Less setup work before a usable trip exists. |
| MS-05 | LOW | Offline feedback | `src/features/offline/OfflineReadyCard.tsx` | Compact presentation already exists; starting the download exposes the full seven-step card and explanatory copy. | Keep compact progress plus one result line by default, with details on demand. Always surface actual failures and partial readiness. | Less operational text without concealing relevant problems. |

These are scoped product recommendations, not claims of accessibility failure. Keep readable type, existing touch targets, navigation labels, permission rules and offline behavior. Avoid replacing text with unexplained icons or putting all content into accordions.

## Backend priorities that support the simpler interface

1. **Accurate completion:** the controller checks retryable push failures but does not incorporate `pushed.deadLettered` into the checked-cycle success outcome. Existing sync UI separately shows rejections. Define whether “updated” means the latest server copy was downloaded or every local edit was accepted, and prevent offline preparation from implying both after a rejection. Reproduce with a rejected expense followed by a successful pull before changing behavior.
2. **Protect newer edits:** `markPushed` checks revision equality, while `deadLetter` unconditionally deletes the queued entry and clears dirty state. Add a focused race test for an edit made during an in-flight request that is subsequently rejected; preserve the newer revision and retain the rejected payload separately.
3. **Reduce refresh work:** normal pulls inspect all 27 synced tables, with a 60-second visible-page timer and realtime hints. Evaluate table-specific invalidation and request coalescing while preserving full initial hydration and periodic reconciliation. Measure request volume before claiming a performance improvement.

## Proposed acceptance criteria

- At 390px, the initial home viewport shows trip identity and one clear next action; a first plan entry is reachable with little scrolling.
- Votes, places, money and people are reachable through clear existing navigation; home does not repeat their full summaries.
- Agenda rows emphasize activity and time; unconfirmed plans and schedule conflicts remain visible.
- Essential warnings remain visible; optional explanation appears when requested or when the relevant action needs it.
- Test empty, busy, newly joined, offline and rejected-write states, enlarged text and physical iPhone behavior.

Showing the common task first and deferring secondary detail follows [NN/g's progressive disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/). The specific proposed screen limits are design hypotheses for this app and should be checked with the user.

Recommended first implementation: mobile overview and agenda together, followed by trip creation. Backend race protection and completion semantics should accompany any change to save/offline status wording.

Verdict: **Needs changes**, scoped to information hierarchy and reading load. Fresh runtime validation remains outstanding.

## Implementation and verification — November 5

The user authorized the changes after this review. MS-01 through MS-05 are implemented:

- Home now has a compact identity/group header, one planning priority, a short itinerary preview and compact essentials. The repeated setup, full activity, saved-place and group-decision panels are removed. Inviting opens the existing accessible dialog. Cover editing remains in Settings; people, votes, places, tasks, money and activity retain their existing destinations.
- During travel, the next departure remains first; overdue tasks stay labeled in essentials. Before departure, offline preparation is the main action.
- Agenda rows omit author names, routine confirmed labels and locations already contained in titles. Unconfirmed status, overlaps, cross-day warnings and ticket links remain. Author attribution is available on the item detail screen. Short agendas omit day-period labels; longer agendas retain them. The redundant day/count line above the selected date is removed.
- New trip removes the repeated heading, explanatory hints and footer paragraph. Optional date/destination details remain optional; timezone/currency adjustments now have their own disclosure with current values summarized.
- Compact offline preparation remains compact throughout progress and completion. Optional step details are expandable; actual failures remain visible. Rechecks clear the previous readiness marker, incomplete maps/documents cannot pass as ready, and ticket readiness reads fresh local records after syncing. A missing service-worker controller returns recovery guidance instead of waiting indefinitely.
- Rejected older writes and transient failures cannot discard or delay newer revisions. Accepted corrections mark earlier rejections resolved while retaining their payloads. Outstanding rejections block checked completion; corrected rows clear the warning. Realtime hints coalesce and pull affected tables in dependency order; full refreshes still run on entry, reconnection, visibility, the existing periodic timer, and permission changes.

### Evidence

| Check | Result |
|---|---|
| `npm run typecheck` | Passed, including browser and Node/worker configuration. |
| `npm test` | 668 tests passed across 91 files. Added regressions cover rejected-write races, retry backoff, resolution history, checked completion, hint coalescing and permission-change rehydration. |
| `npm run build` | Passed. Existing large-chunk warning remains. |
| Playwright: `journal`, `first-run`, `design-flow`, `ux-patterns` | All 35 tests passed against the production preview on port 4188. |
| Phone hierarchy | The planning fixture's priority begins above 360px and first itinerary item above 760px in a 390×844 viewport. |
| Responsive and interaction states | 320/390/768/1440px; long unbroken titles; enlarged text; light/dark themes; reduced motion; keyboard invite open/close/focus restoration; empty/planning/preparing/traveling states; offline failure without false success. |
| Existing paths | Join → local trip → places → save; vote → updated priority; task completion/undo and persistence; cover editing and failed-write recovery; itinerary → timeline and tickets. |
| React review | Hooks remain unconditional; stable row keys; existing navigation/dialog primitives retained; new download actions have duplicate-request protection; rendering reads local data. |
| `git diff --check` | Passed. |

Browser evidence uses disposable IndexedDB fixtures and stubbed or blocked backend requests. Sync behavior is verified with an in-memory remote and local databases. Production Supabase and physical iPhone/Safari behavior were not exercised; no field-performance reduction is claimed. Two existing UX tests were aligned with the current undo wording and the current operator image asset, retaining their behavioral assertions.

Fresh captures are in `test-results-mobile-simplification/` (ignored), including `planning-390.png`, `planning-dark-320.png`, `agenda-390.png`, and `create-390.png`; these were visually inspected. Preview: `http://127.0.0.1:4188/app`.

Additional accessibility/style edits arrived concurrently in the workspace. Those edits were preserved; this section describes this pass's changes and the combined snapshot actually checked. No deployment or live schema changes were made.

Implementation verdict: **Pass for the local scope tested.** Physical iPhone/Safari verification remains a follow-up.
