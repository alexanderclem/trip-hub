# Implementation and verification ledger

Started November 11, 2026 at `a5f9be4`. Clean initial worktree; `git fetch --all --prune` and branch/log/worktree inspection completed. Main and other worktrees were preserved. Local branch: `codex/astryx-migration`. No push, deploy or hosted-data writes.

Product commits: `e89f075` (Astryx foundations and consumer journeys) and `aa10ccc` (Money role controls and read-only expense details). The final production source tested is `aa10ccc`. Local Git had no configured author, so these commits use Codex through per-command identity settings; no user/global Git configuration was changed. The later handoff commit contains documentation only.

## Execution plan and implemented slices

1. Reproduce the existing synthetic baseline; verify/pin Astryx APIs. Install compiled foundations and resolve theme/cascade ownership.
2. Migrate shared primitives and fix Home contrast, roster routing, per-phone preparation copy and touch targets. Exercise complete create/join, voting/planning and money operations.
3. Improve personal Money/history hierarchy and truthful public demonstration. Run the existing regression suites, inspect actual images and record remaining release work.

| Slice | Code implemented | Boundary |
| --- | --- | --- |
| 1: correctness/theme/shared controls | Stowaway source + compiled Astryx theme, shared Button/Card/Segmented adapters, TextField, Theme/LinkProvider, selector/first-paint compatibility, 44px controls/13px nav, readable Home priority, real Travelers route, roster-origin Back/permissions, truthful welcome/preparation anchor | Working production changes. Native Dialog retained as a justified exception; Astryx disclosure migrated through Money/public work. |
| 2: onboarding/collaboration | Existing two-field create uses Astryx TextInput/Field; shared action controls migrate create/join/invite/polls without changing data flows | No forced wizard/account/quiz/install. Full DecisionHandoff hierarchy refinement is deferred. |
| 3: home/plan/places/map | Shared controls reach the real screens; visible priority and working group link repaired; existing agenda/day/deep links preserved | Custom timeline, day-strip, route and map calculations/compositions retained. This is not a full map redesign. |
| 4: money/status | Personal payments and history before disclosed group details; explicit externally-paid wording; narrow payment form reflow; single recording form; persistent undo history no longer stacks ordinary notices across a form's Save button; modal dismissal fallback | No financial algorithm or sync/storage changes. Cold PWA/map download verification remains open. |
| 5: public | Existing animation labeled as an illustration; separate interactive fictional Paris preference -> explicit Add to plan -> tentative itinerary -> reset, all local React state | Master assets, Paris illustration, Replay, public routes, metadata/prerender and PWA identity retained. No demo trip or booking writes. |

Meaningful files: src/themes/stowaway/*; src/ui/{index,StowawayTheme,TextField,appearance,AppearancePicker,Dialog,ToastProvider}; src/features/trips/{CreateTripScreen,JoinerWelcome,TravelersScreen,TravelerScreen,TravelerLink,QuickAdd,SettingsScreen}; MoneyScreen; website/stage/{HeroDemo,PlanningExample}; router/main/prerender; theme/app/travel/journal style owners; index.html; package/lockfile; browser regression suites. No data, Supabase, worker, SQL or master brand assets changed.

## Defect evidence

| Baseline ID | Result / proof |
| --- | --- |
| UX-01 HIGH | Fixed at the owning travel-notebook foreground/background rules. Fresh before image showed white-on-white. Runtime matrix: heading 13.13:1 light / 12.09:1 dark; detail 6.81:1 / 7.02:1 across four widths and both motion settings. |
| UX-08 HIGH | Home roster URL registered using existing PeopleCard and local hooks; exact People (8), traveler details, visible Back to roster then Home pass. Viewer fixture cannot edit roles, profile or assignments. |
| UX-02 HIGH | Installation is explicitly an optional shortcut. Preparation always has a separate direct link and actual 1-of-2 on-phone file count in the Paris fixture. The settings target scrolls/focuses; partial preparation still reports failure. |
| UX-03 MEDIUM / UX-06 LOW | Restored custom switch minimum 44px and 13px phone captions; actual Astryx radio/input target measurements and keyboard selection added. |
| UX-04 MEDIUM | Money shows one's own payments then actual history before the group's suggestions/balances. External payment recording saves locally and survives reload; no transfer is initiated. |
| UX-05 MEDIUM | Illustration identified as such; separate working keyboard-accessible local example requires an explicit plan action and resets. |
| UX-07 LOW | Still open: optional linking/booking forms in DecisionHandoff need progressive disclosure without hiding assigned tasks/confirmation state. |

Migration-specific issues caught and repaired: Astryx required labels needed explicit native required; Quick Add's old direct-span hiding selector concealed the new library wrapper; TextInput's editable node was 24px within a 46px border box; group/payment duplication created two recording forms; generic status locators matched Astryx's legitimate empty live regions. Tests now select the actual status text. Native modal exit now has a cancellation-safe deadline rather than depending indefinitely on animation completion. Persistent older undo notices remain discoverable instead of covering a form's Save button.

## Verification method and commands

Before changes: `npm run build` passed; `SHOTS_DIR=output/astryx-before npx playwright test tests/e2e/pro-redesign-baseline.spec.ts --workers=1 --reporter=list` **18 passed**. Real images were inspected, not only generated.

During implementation: `npm run typecheck` passed; `npm test` **795 passed in 106 files**; `npm run build` passed repeatedly after meaningful changes; `npm run theme:check` passed. Targeted create/Money fixes passed; native confirmation passed all 16 viewport/theme/motion combinations after the exit fix. Initial failed and interrupted iterations are retained in ignored output logs; they are not counted as final passes.

The final browser command selects safe local/mock suites:

```powershell
$env:SHOTS_DIR='output/astryx-after'
npx playwright test tests/e2e/pro-redesign-baseline.spec.ts tests/e2e/first-run.spec.ts tests/e2e/design-flow.spec.ts tests/e2e/journal.spec.ts tests/e2e/appearance.spec.ts tests/e2e/website.spec.ts tests/e2e/guest-evaluation.spec.ts tests/e2e/planning-features.spec.ts tests/e2e/ux-patterns.spec.ts --workers=1 --reporter=list --timeout=90000
```

Fixtures block/stub external HTTP/WebSocket services and use fictional people/files. Live `onboarding.spec.ts`, `offline.spec.ts`, smoke tests and live-service E2E are deliberately excluded by the no-production-mutation instruction; local first-run/Paris journeys cover their relevant UI paths. Browser network-off verification uses a warmed SPA with service workers blocked, not a cold installed-PWA launch. Reconnect checks local durability, not remote acknowledgement. Existing unit suites cover outbox, conflict/retry, permissions, money/FX and vote logic.

There is no existing axe integration in this project. Browser checks cover computed contrast, labels, accessible names/roles, 44px targets, keyboard focus, radio selection, history, scroll ownership, 320/390/768/1440, normal/reduced motion and 200% root text/CSS zoom. No screen reader, physical iPhone, Safari, browser-toolbar zoom or novice usability study was performed.

### Final results

| Command/check | Final result |
| --- | --- |
| `npm run typecheck` | PASS: app and Node/test configurations |
| `npm test` | PASS: **795 tests, 106 files** |
| `npm run build` | PASS: compiled app, public prerender, service worker and manifest; existing large-chunk warning remains |
| `npm run theme:check` | PASS: compiled theme matches its source |
| Nine-suite Playwright command above | PASS: **100 tests, 4.8 minutes**, Chromium/iPhone emulation and explicit viewports |
| Hosted viewer targeted repeat | PASS: roster, traveler, Money recording/Add/Undo absence and read-only expense deep link; captured viewer expense after adding screenshot evidence |
| Public interactive example | Included in final 100; exercises all 16 width/theme/motion combinations, 0–3 preference controls, clear, manual plan and reset |
| `git diff --check` / staged whitespace check | PASS |
| `npm run lint:design` | NONZERO (exit 2): same 3 vendored Stage-kit font findings as baseline; 201 advisories versus baseline 196; see explanation below |

Complete functional journeys include stubbed new trip -> invite copy, invite -> name -> deep-linked vote, saved place -> poll -> scores/change/clear -> explicit tentative scheduling, activity add/edit -> retained selected day, Money -> personal amount -> recording an externally paid amount -> reload, and warm SPA browser-network-off -> local expense -> saved ticket/missing ticket -> reconnect/local durability. Overlap/ticket/day displays and maps' unprepared state are additionally covered by the reused fixtures. Successful trip-wide map preparation, physical PWA launch and remote synchronization acknowledgement are not claimed.

## Build footprint

Baseline production was rebuilt from an isolated archived a5f9be4, reusing the unchanged original installation. A separate git boundary was necessary to stop Tailwind scanning the containing migration checkout; the final baseline CSS/entry hashes match the initial build. Static transitive imports were parsed from built modules using es-module-lexer; gzip was computed per file. The comparison includes the entry plus each route's static imports, excludes dynamic imports/tab preloads/PWA precache and does not measure transfer speed or interaction latency. JSON receipt: output/astryx-bundle-report.json (final summary copied beside this log).

The prebuilt Astryx CSS and runtime increase the cold footprint materially. Do not call this a performance improvement. Map, saved-area/PMTiles and PDF chunks remain separate. The receipt is [BUNDLE_SIZES.json](BUNDLE_SIZES.json); units below are KiB, gzip computed per file rather than Vite's display rounding.

| Static JS graph (entry + route) | Before raw | After raw | Before gzip | After gzip |
| --- | ---: | ---: | ---: | ---: |
| Entry | 741.3 | 1232.3 | 245.5 | 397.5 |
| Create | 1099.3 | 1610.2 | 350.4 | 509.8 |
| Home | 1712.7 | 2204.0 | 529.4 | 681.3 |
| Plan | 1152.8 | 1643.9 | 371.7 | 523.5 |
| Money | 1139.5 | 1638.0 | 366.3 | 521.6 |
| Global CSS (separate from JS) | 314.4 | 611.5 | 54.1 | 100.9 |

Shared Astryx-heavy emitted chunks include `ui` (~296 kB raw / 95.7 kB Vite gzip) and `focusOutline.stylex` (~116 kB / 37.1 kB); they must not be omitted when quoting route costs. Those chunks also contain shared code, so their complete sizes cannot be attributed solely to one component. MapScreen remains ~589 kB, savedArea ~542 kB and PDF ~431 kB in distinct dynamic chunks. No production StyleX compiler, duplicated Neutral CSS or font import was added to reduce or conceal the observed increase.

The optional `npm run lint:design` source scanner returned **exit 2**: the same **3 pre-existing Stage-kit font findings** occur in the archived baseline. Baseline/current advisory counts are 196/201. The five added advisories are source/generated-theme instances of the established app's 12px track, 9px selected inset and 20px dialog radii, which the public-website DESIGN.md scale does not list. These are documented compatibility choices, not a clean design-scan result. The scanner explicitly did not perform rendered contrast or element accessibility checks. Full logs are in output/astryx-design-scan.log and output/astryx-baseline-design-scan.log.

Final visual hardening also allows PageHeader tools to wrap before squeezing its heading at 200% text, restores avatar/name spacing inside Astryx Link's text wrapper, and removes the global Add whenever the existing contextual action already serves that screen (including tablets/desktops). The 200% and four-width matrix checks the heading width and the absence of a duplicate Money Add control.

Final role review found an existing gap in the touched Money feature: hosted viewers could see Record/Add/Undo controls and reach an editable expense form. The UI now uses the existing participate/money capabilities, limits hosted travelers' recording actions to their own suggested payments, and presents an expense as a read-only summary to viewers, including direct URLs. Their private per-phone budget preference remains available. The extended viewer journey checks both roster and Money, including the expense deep link. No server access rules, repository guard or calculations changed.

## Next exact slice

Refine DecisionHandoff's unscheduled state: schedule action first; disclose existing-item linking and optional booking ownership; keep current owner/deadline and confirmation state visible. Use the installed Collapsible API, preserve both decision/poll handoff query contracts, all 0–3/clear behavior and explicit tentative scheduling. Then migrate one compatible text form at a time, and profile the measured bundle increase before further shared-library expansion.
