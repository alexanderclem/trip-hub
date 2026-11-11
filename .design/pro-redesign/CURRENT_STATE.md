# Stowaway current experience — Phase 01

Observed November 10, 2026, against `69ea398` on local branch `codex/pro-redesign`.
Worktree: `C:/Users/alexa/Downloads/new/ecoai`; original checkout: `../stowaway`.
`git fetch origin` found the same main revision. Existing untracked files and the other worktrees were preserved.

## Evidence boundary

This is a fresh local Chromium review, with the repository's iPhone 13 profile and desktop viewport sizes. The Paris fixture has eight explicitly fictional travelers, March 16–20, 2027 dates, five places, two votes, four itinerary entries, an overlap, an overdue task, an expense and two ticket records. One ticket has an actual synthetic PNG in IndexedDB; the other is deliberately missing. A separate 15-day range, empty trip, hosted viewer and completed trip are exercised. Browser clocks select lifecycle states without changing real trip dates.

The browser reads the production build. The ignored `.env.local` uses an invented Supabase hostname and placeholder key. New tests intercept external HTTP and WebSocket traffic. Existing selected browser suites use their local fixtures or mocked responses. No hosted trip, live account, payment, email or schema was changed. Screenshots and metrics are in [screenshots](screenshots/); the generated screenshot index and gallery identify each capture. Screenshots are baseline evidence, not redesigned screens.

No physical iPhone, Safari, VoiceOver, novice participant study, live cross-device synchronization or successful Paris offline map download was tested. An unprepared offline map is intentionally captured as a failure state, not presented as a working map. CSS zoom and enlarged root text are supplementary checks, not browser toolbar zoom.

## Confirmed strengths already present at HEAD

| Area | Current behavior and evidence | Preserve |
| --- | --- | --- |
| Home | Compact identity, one planning priority, day preview, quiet essentials; lifecycle changes the content rather than tabs. `TripOverviewScreen.tsx`; `state-traveling-390.png`. | November 5 simplification, exact phase rules, direct ticket/map links during travel. |
| Setup | `/new` starts with two fields; dates/destination and inferred zone/currencies are optional. Existing `design-flow` test. | No forced wizard, quiz, account or install. |
| Join | The invite introduces the trip before name selection; shared vote links reach the vote. `first-run.spec.ts`. | Fragment tokens, target allowlist, name retention and timeout recovery. |
| Adding | `QuickAdd.tsx` hides global Add where a contextual action already serves that screen, and on forms. Existing Plan collision test passes. | One useful Add affordance; do not restore two phone plus buttons. |
| Plan | Agenda omits authors and duplicate place names, retains tentative state, conflicts and confirmations. Date selection, detail back link and deep links carry `?day=`. | Keyboard date strip, time-zone rules, meaningful conflict labels, linked ticket availability. |
| Decisions | Real 0/1/2/3 preferences can be changed or cleared. Closed decisions explicitly require scheduling and booking confirmation. `DecisionHandoff.tsx` says nothing is booked automatically. | Human decision, tentative scheduling, explicit confirmation and stable identities. |
| Money | The exact balance appears immediately; the example €80 shared by eight shows €10 owed by Alex. | Integer minor units, FX snapshots, exact splits, settlement algorithm. |
| Offline and sync | Missing documents differ from downloaded files. Failed preparation exposes problems without a Ready result. Prior rejection/race/coalescing safeguards already exist. | November 5 fixes; no sync rewrite for a label change. |
| Accessibility | Native dialogs, focus restoration, real links/buttons, live theme preference and reduced motion already have browser coverage. | Existing primitives and keyboard behaviors. |
| Public site | Exact brand assets, clear Create/Join paths, labeled Paris example, Replay, prerendered public HTML and offline `/app` fallback exist. | Luggage-tag identity, working routes, metadata and PWA identity. |

Historical `.design/review-report.md` complaints about oversized Home covers, duplicated share blocks, duplicate Add and animated financial balances are not new findings. `.design/mobile-simplification-review-2026-11-05.md` explicitly records their later fixes. `.design/website-polish-report.md` describes an older website; use it for preservation constraints, not current palette or composition claims. `docs/UI_COMPONENTS.md`'s November material section and current source describe the current app; some earlier print-style prose in `DESIGN.md` predates that implementation.

## Open findings

| ID | Severity | Observed problem | Evidence | Required outcome |
| --- | --- | --- | --- | --- |
| UX-01 | HIGH | Planning Home's priority title and due-date detail disappear against its card in light mode, and are extremely low contrast in dark mode. The CTA remains readable, with its purpose missing. | `screenshots/home-planning-390.png`, `adapt-home-320-dark.png`; `metrics-390.json`: heading/detail `rgb(255,255,255)` on white, **1:1**. `travel-notebook.css:20–23` retains inverse text; `app-theme.css:116` replaces the background without replacing text. Heading top ≈254px; first plan item ≈481px. | Fix foreground inheritance at its owning style rule. Check heading, detail, action and focus in both themes; remove obsolete conflicting declarations. This is the first Phase 02 change. |
| UX-02 | HIGH | The iPhone join welcome says “Then the plan, map and tickets work with no signal” under Home Screen installation. Installation does not download every ticket or map. | `src/features/trips/JoinerWelcome.tsx:33`; actual missing ticket and failed-preparation captures. This is a false preparation promise, not a reproduced data-loss incident. | Say installation makes opening easier; separately link to preparation on this phone. Keep missing files and maps explicit. |
| UX-03 | MEDIUM | The Plan Agenda segmented control is **40px high**, below the project's 44px minimum. The app material rule overrides the control's utility minimum. | `screenshots/control-measurements.json`; `src/styles/app-theme.css:88`. | Shared segmented choices measure at least 44px; verify dialogs, time toggles and zoom after changing the shared dimension. |
| UX-04 | MEDIUM | Money prioritizes all seven group settlement rows ahead of expense history. In an eight-person fixture the first phone view is mostly other people's payment instructions. | `screenshots/money-390.png`; 1,554px content height in baseline metrics; `src/features/money/MoneyScreen.tsx` maps all transfers before history. | Show the current person's settlement and recent records first; disclose the rest with a literal group label. Do not change calculations or imply money was sent. |
| UX-05 | MEDIUM | The hero has button-shaped score labels that are spans inside an illustration, and a script moves a winning vote into the plan without an explicit planning action. Example/Replay labels exist, but agency and the manual decision step remain unclear. | `HeroDemo.tsx`: `Option`, `script`, `role="img"`; `screenshots/landing-390.png`; existing website tests confirm the script. Confusion is a design risk, not a measured usability result. | Add a deterministic, accessible local example with an explicit schedule action, or clearly identify the illustration as noninteractive and put a separate real widget beside it. |
| UX-06 | LOW | Bottom-tab labels use `.75rem` (12px), below the documented 13px caption floor. | `src/styles/app-theme.css:103`; small labels in `adapt-home-320-dark.png`. | Align the shared navigation label role with the caption floor while retaining five readable destinations at 320px. |
| UX-07 | LOW | Closed-decision UI exposes the schedule action, an existing-item selector and booking-owner form together, before later voting/results content. | `screenshots/poll-closed-390.png`; `DecisionHandoff.tsx`. This is a hierarchy judgment, not a broken scheduling flow. | Emphasize the next unfinished step and disclose optional linking/booking details; keep consequential state visible. |
| UX-08 | HIGH | Home's “8 travelers” link leaves the trip workspace for a not-found screen. The overview links to `/t/:tripId/travelers`, but the router only registers `travelers/:memberId`. | Actual click: `screenshots/group-roster-destination-390.png`, `roster-destination.json`: heading “This page didn’t make the trip.” `TripOverviewScreen.tsx:102`, `src/router.tsx:56`. | Register the already-linked roster URL using a small screen around the existing `PeopleCard`, member hooks and access controls. Verify group → individual traveler → Back and hosted roles. No route renaming or data model changes. |

HIGH means essential information is inaccessible or an essential preparation promise is misleading. MEDIUM denotes material effort, access-target or comprehension problems. LOW denotes bounded polish. No data-loss, financial arithmetic or permissions defect was established by this baseline.

## Navigation and overlays observed

Phone tabs are **Home / Plan / Map / Vote / More**, fixed across lifecycle states. Tickets and Money activate More. Place lists and destination exploration are separate destinations under More; Map has its own tab. Desktop has eight core destinations, five preparation destinations and two trip/settings destinations, plus the trip switcher and sync control. Its rail scrolls; the settings group remains reachable in the existing 720px-height regression.

The shell supplies search on wider displays, QuickAdd when appropriate, Stowie and sync trouble. Home owns its invite dialog. Polls own their share dialog. Records use their existing back links; dialogs keep native modality. Plan and populated record lists use contextual Add; empty states replace the matching floating action. Map search, filters, selected-place sheet and add affordances must remain local to the map context.

## Deferred or rejected

- Do not reopen the November 5 mobile simplification or sync-engine rewrite without a fresh failure.
- Do not rename Map to Explore while a distinct destination explorer already exists.
- Do not promote Money to a tab at the expense of direct Vote without user evidence; see the target decision matrix.
- Do not add accounts, a quiz, an installation gate, customer proof, booking automation or payment collection to the consumer entry path.
- Do not replace DaisyUI adaptations, React Router, map, data repository or design tokens. A token conflict does not justify another design system.
- Do not claim a physical-phone offline result from browser contexts or mark the product release-ready while UX-01/02 remain.

The first five priorities are UX-01 (invisible priority), UX-08 (broken roster entry), UX-02 (false installation/preparation promise), UX-03 (40px controls), and UX-04 (group settlements before personal history). UX-05 remains an important later website correction.

**Baseline verdict: Needs changes.** Discovery identified actionable defects; it does not approve the product for release. Product source is deliberately unchanged in this phase, as required by `01_BASELINE_AND_UX_ARCHITECTURE.md`.
