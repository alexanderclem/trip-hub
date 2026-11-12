# Implementation and verification ledger

Started November 11, 2026 at `a5f9be4`. Clean initial worktree; `git fetch --all --prune` and branch/log/worktree inspection completed. Main and other worktrees were preserved. Local branch: `codex/astryx-migration`. The initial slice had no push/deploy; the user then authorized completing this ledger and pushing all work to main. Hosted-data writes remain excluded.

Initial product commits: `e89f075` (Astryx foundations and consumer journeys) and `aa10ccc` (Money role controls and read-only expense details), followed by documentation commit `f093c46`. Results below describe that initial slice; the completion pass at the end supersedes its remaining-work entries. Commits use Codex through per-command identity settings because local Git had no configured author; no user/global Git configuration changed.

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

## Completion pass authorized by the user

- UX-07 is implemented with upstream Collapsible: schedule first, optional linking and owner/deadline editing disclosed, current task/owner/deadline and booking confirmation always visible. Native dates, explicit tentative scheduling, both `decision` and `poll` URL contracts and the existing 0–3/clear behavior remain.
- Shared Field now delegates compatible controlled text inputs to actual TextInput/Field, preserving native change events, name/ref, validation, disabled behavior, hints and keyboard traits. Explicit expense, task, itinerary and booking fields also migrate. Native composite/uncontrolled/number/date/file/select/textarea and compact custom controls remain justified compatibility exceptions. Shared Skeleton and Tasks EmptyState now use upstream components.
- The source design scan now passes with **zero anti-pattern failures** and 201 advisory notes. DESIGN.md narrowly documents SF Pro Text/Rounded for the existing simulated iOS keyboard/status time/contact monogram only. No product font, font service or font asset changed. Regex scanning still is not a rendered accessibility certification.
- Production builds enforce full static-graph gzip budgets via `scripts/check-bundle.mjs`, including shared imports. `scripts/profile-astryx.mjs` supplies repeatable cold-form CPU/network/gzip measurements and a 6-second median lab ceiling. The measured overhead remains visible in BUNDLE_SIZES/PERFORMANCE; this is not a speed improvement or field Web Vitals claim.
- A fresh offline Chromium page opens the installed app's cached trip and saved PNG, distinguishes a missing ticket, and reopens after reconnection. Two independent browser databases exercise real repository/outbox/HTTP sync code against an in-memory server: an offline task reaches the second phone and survives reload. This does not certify live hosted RLS/realtime or cross-device infrastructure.
- A real public Paris download exposed a cold-map startup/overview edge issue. Startup now waits for saved style metadata, begins at its destination, and keeps one neighboring middle-zoom tile. Annotation fonts are prepared too. The final offline map renders with no failed requests: **202 cached tiles / 60,230,270 bytes**. The old 40 KB/tile estimate understated this dense city; the estimate now uses 300 KB/tile. No map server configuration or live trip data changed.
- Windows WebKit UI checks cover create validation/themes, roster/legacy scheduling, decision ownership/deadline, shared keyboard choices and native confirmation across width/theme/motion matrices. Its ephemeral context rejects IndexedDB Blob persistence, so those UI fixtures omit the synthetic file and the file-cache contract explicitly belongs to Chromium. No Safari/physical-device file certification is implied.
- Keyboard confirmation tests explicitly focus/activate the trigger. When pointer/programmatic activation leaves no focused opener, Dialog now restores the screen heading rather than treating body as a usable opener. Focus containment, Escape, return-to-trigger and that fallback are exercised.

The user answered **“No—keep physical-device checks explicitly unverified.”** Physical iPhone Safari/PWA installation, VoiceOver, OS storage eviction and live hosted-device reconciliation remain unverified boundaries, not silently checked boxes. Native dialogs, sheets, persistent undo toasts, custom navigation and rich travel empty compositions are retained as reviewed exceptions rather than unfinished mass substitutions.

Final results and the release boundary are recorded in FINAL_REVIEW.md. Historical failed fixture/selector/platform iterations remain in local logs and are not counted as passes.

### Completion measurements and commands

Final constrained lab comparison: **4,108 ms before / 5,240 ms after median form use**, three fresh contexts for each build. Both real text inputs were filled; no hosted submission occurred. Chromium used a 390×844 viewport, gzip HTTP, 4× CPU slowdown, 1.6 Mbps down / 0.75 Mbps up and 150 ms latency, with service workers/external traffic blocked. The increase is **1,132 ms (27.6%)**. Current samples transferred about 745 KB and painted first content around 4.06 seconds. The 6-second median lab ceiling passes, but this does not establish good field Web Vitals. Full samples are committed in PERFORMANCE.json.

Current gzip static graphs: entry **403.9 KiB**, Create **508.9**, Home **687.7**, Plan **530.3**, Money **528.2**; global CSS **100.9 KiB**. Relative to the original baseline, entry adds **158.3 KiB gzip JS**, and CSS adds **46.8 KiB**. Full shared imports are counted once; dynamic imports, tab preloads and the service worker's full precache are explicitly separate. The production build enforces caps of 410/525/700/540/540 KiB and 105 KiB CSS. No unsupported stylesheet pruning or internal imports are used.

```powershell
npm run typecheck
npm test
npm run build # includes check:bundle
npm run theme:check
npm run lint:design

$env:SHOTS_DIR='output/astryx-after'
$env:VERIFY_PUBLIC_MAP='1' # read-only public tile downloads; no hosted trip writes
npx playwright test tests/e2e/pro-redesign-baseline.spec.ts tests/e2e/first-run.spec.ts tests/e2e/design-flow.spec.ts tests/e2e/journal.spec.ts tests/e2e/appearance.spec.ts tests/e2e/website.spec.ts tests/e2e/guest-evaluation.spec.ts tests/e2e/planning-features.spec.ts tests/e2e/ux-patterns.spec.ts --output=output/pw-astryx-final --workers=1 --reporter=list --timeout=90000

# Run the profile separately from browser tests to avoid CPU contention.
npm run profile:astryx -- output/astryx-baseline-source/dist dist

$env:E2E_BROWSER='webkit'
$env:SHOTS_DIR='output/astryx-after-webkit'
npx playwright test tests/e2e/pro-redesign-baseline.spec.ts --grep 'cross-engine consumer|decision options|Astryx create fields|retained native confirmation|shared choices' --output=output/pw-astryx-webkit --workers=1 --reporter=list --timeout=90000
Remove-Item Env:E2E_BROWSER
```

Completion results: **796 unit tests / 106 files; 105 Chromium consumer browser tests; 5 WebKit UI journeys; build, app/node typecheck, theme check, bundle budgets and source design scan pass.** Browser runs are sequential with independent artifact directories and a stable preview server. The real Paris map/cache result and the two-phone stubbed reconciliation are included in the 105, not added again to inflate the count. Local logs: `output/astryx-completion-{unit,browser,build,design-scan}.log`, `output/astryx-completion-webkit-final.log`, `output/astryx-performance.log`.

The main-branch CI workflow additionally exercises wrapped trips and operator/booking/payment/import fixtures through these shared controls. Its report-export assertion now selects the report's actual status message rather than also matching Astryx Button's empty busy-announcement region; the queried dates and downloaded CSV assertions remain intact. The consumer migration suites are now registered in CI as well. Public map downloading stays opt-in; CI uses local/mock services.

The additional CI fixtures also pass: **38/38**, giving **143 Chromium tests plus 5 WebKit journeys** in the final verification. Exact additional command (no live payments, emails or hosted data):

```powershell
npx playwright test tests/e2e/wrapped.spec.ts tests/e2e/access-roles.spec.ts tests/e2e/organizers-pricing.spec.ts tests/e2e/operator-dashboard.spec.ts tests/e2e/payments-offer.spec.ts tests/e2e/payments.spec.ts tests/e2e/repeat-business.spec.ts tests/e2e/booking-travelers.spec.ts tests/e2e/campaigns.spec.ts tests/e2e/referrals.spec.ts tests/e2e/imports.spec.ts --output=output/pw-astryx-ci --workers=1 --reporter=list --timeout=90000
```

Receipt: `output/astryx-completion-ci-browser-final.log`. Main and unrelated worktrees remain untouched; release is pushed from the isolated migration branch with a normal fast-forward push, never a force push.
