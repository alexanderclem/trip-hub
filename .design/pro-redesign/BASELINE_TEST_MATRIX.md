# Phase 01 test and screenshot matrix

Environment: Windows, Node 24, existing dependency installation, local production preview at `http://127.0.0.1:4194`. Source revision `69ea398`; no app-source modifications. Browser: Chromium with configured iPhone 13 emulation and explicit CSS viewport sizes. `.env.local` contains only dummy public configuration and is ignored. The original checkout's `node_modules` is reused through an ignored junction; no dependency installation or lockfile changes.

## Commands and results

| Command | Result |
| --- | --- |
| `git fetch origin` | Successful; origin/main remained at `69ea398`. |
| `npm.cmd run typecheck` | Passed, app and Node/test configurations. Repeated after fixture changes. |
| `npm.cmd test` | **795 passed, 106 files**. Includes local database, permissions, finance, sync/controller and worker unit coverage; not a live-service result. |
| `npm.cmd run build` | Passed; generated public HTML, manifest and service worker. Existing chunk-size and future Vite native-config import warnings remain. No performance improvement is claimed. |
| `npx.cmd vite preview --host 127.0.0.1 --port 4194 --strictPort` | Running local production build. Backend configuration is the dummy hostname, not production. |
| `$env:BASE_URL='http://127.0.0.1:4194'; $env:SHOTS_DIR='output/pro-redesign/existing-shots'; npx.cmd playwright test tests/e2e/first-run.spec.ts tests/e2e/design-flow.spec.ts tests/e2e/journal.spec.ts tests/e2e/appearance.spec.ts tests/e2e/website.spec.ts tests/e2e/guest-evaluation.spec.ts tests/e2e/planning-features.spec.ts --workers=1 --reporter=list` | **63 passed**. Existing local-only/mock flows, including service-worker-controlled offline app reload. |
| `$env:BASE_URL='http://127.0.0.1:4194'; $env:SHOTS_DIR='.design/pro-redesign/screenshots'; npx.cmd playwright test tests/e2e/pro-redesign-baseline.spec.ts --workers=1 --reporter=list --output=output/pro-redesign/baseline-results` | **18 passed in 60 seconds**. One audit scenario records the broken roster destination without asserting it succeeds. Passing scenarios do not approve known visual/readiness-copy defects. |
| `git diff --check` and `git diff --cached --check` | Passed at handoff. |

Raw logs remain in ignored `output/pro-redesign/{build,typecheck,unit,regression,baseline}.log`. Initial fixture construction had incorrect expectations for a label, the post-save detail URL and the default selected Plan day. These were checked against the actual flow and corrected; they were not product regressions. Initial database initialization used `/app` before a store was opened; the final fixture uses the established `/inspire/manual` initialization pattern. Failed runner traces are diagnostic evidence, not a successful check.

## Actual scenarios

| Scenario | Evidence / scope |
| --- | --- |
| First-time public visitor and app entry | Landing, `/app`, `/new`, missing-token join at 390/1440; Create/Join/returning app, keyboard FAQ, metadata/contrast and PWA entry covered in existing website suite. |
| Organizer create/invite | Real form → entirely stubbed `create_trip` → actual local hydration → invite dialog → clipboard confirmation. No hosted write. |
| Participant/name/deep link | Paris name choice and existing first-run join/retry/stalled identity scenarios; shared vote target retained; no forced quiz. |
| Places and voting | Save a place; create poll; add option; cast/change all four scores and clear; reload persistence. Existing failure/retry checks remain. |
| Winner-to-plan | Click actual explicit schedule link, inspect tentative status, save to real local itinerary and return to decision. The `decision=` path intentionally has a different heading from the newer `poll=` path. |
| Itinerary | Selected day, conflict, confirmed/tentative entries, ticket links; add, edit time, back to correct day and reload; existing all-day/lodging/date/DST-related tests supplement. |
| Offline expense | Real save and outbox entry, reload, and local navigation while network is disabled. Does not establish acceptance by a remote server. |
| Tickets | Actual fixture PNG opens from `files`; missing file has an error/retry. Safe synthetic code and explicit Example label. |
| Partial preparation | One saved file, one missing, no saved map or service-worker controller in new suite. Failure is visible and never becomes Ready. Existing website suite separately tests cached-app reload with a real local service worker. |
| Lifecycle | Planning, four-day preparation, active travel, complete, empty, 15-day range, hosted viewer denied editing. Existing sync/role tests exercise cached capabilities independently. |
| Reflow/theme/keyboard | Home/Plan/Money at 320/390/768/1440, light/dark, reduced motion; 200% root text, CSS zoom; keyboard invite Escape/focus restoration. Existing appearance/day-control tests supplement. |
| Group roster entry | Actual Home → 8 travelers click records `/t/:tripId/travelers` and the not-found heading in `roster-destination.json`. This explicitly confirms UX-08; the audit capture is not a successful roster flow. |

## Screenshot paths

All paths below are under `.design/pro-redesign/screenshots/`. The generated `SCREENSHOT_INDEX.md` lists every actual PNG. `BASELINE_GALLERY.html` provides a local contact sheet with filtering; there are no “after” screenshots because Phase 01 did not change product UI.

| Surface | Baseline pairs / variants |
| --- | --- |
| Landing, first app entry, create, missing-token join | `landing-{390,1440}.png`, `first-entry-{390,1440}.png`, `create-{390,1440}.png`, `join-entry-{390,1440}.png` |
| Home | `home-planning-{390,1440}.png`; `state-{preparing,traveling,complete,empty}-390.png` |
| Plan and detail | `plan-{390,1440}.png`, `item-{390,1440}.png`, `state-long-390.png` |
| Places/map | `places-{390,1440}.png`, `place-{390,1440}.png`, `map-unprepared-{390,1440}.png` |
| Voting | `votes-{390,1440}.png`, `poll-open-{390,1440}.png`, `poll-closed-{390,1440}.png`, `winner-manual-plan-handoff-390.png` |
| Money | `money-{390,1440}.png`, `offline-edits-persist-390.png` |
| Documents/readiness | `tickets-{390,1440}.png`, `ticket-local-{390,1440}.png`, `ticket-missing-{390,1440}.png`, `settings-offline-{390,1440}.png`, `offline-preparation-failed-390.png` |
| Permissions | `state-hosted-390.png` captures denied direct edit; preserves viewer behavior rather than pretending an editable form exists. |
| Adaptation | `adapt-{home,plan,money}-{320,390,768,1440}-{light,dark}.png`, `home-200-percent-text-640.png`, `home-css-zoom-200-640.png`, `invite-keyboard-640.png` |
| Entry interaction | `create-and-copy-invite-390.png`, `paris-join-choose-name-390.png`, `paris-join-welcome-390.png` when the final respective flow has run. |

Personally reviewed representative rendered images: planning Home phone/desktop, active travel, Plan, open/closed poll, Money, local/missing tickets, dark 320px Home, public landing, failed offline preparation, plus the final gallery. Rendering a capture is separate from inspecting it. Route metrics record no horizontal document overflow in the core sample; they do not prove all accessibility requirements.

## Coverage still open

- Physical iPhone Safari, installation, airplane-mode storage retention and VoiceOver. Chromium mobile emulation is not equivalent.
- Browser toolbar 200% zoom and OS text-size settings; root text scaling and CSS zoom are checked separately here.
- Successful first-time Paris map download, tile rendering while online/offline and cache eviction. The baseline map is deliberately unprepared.
- Live Supabase identity/permissions propagation, cross-device invite/sync, object storage uploads, real FX/weather/routing and any booking/payment/email. Local/in-memory tests do not replace these boundaries.
- Full adversarial 20-person/30-ticket/multiple-currency/DST/RTL/denied-storage matrix, performance profiling, and moderated novice user tests.

These gaps are explicit follow-up coverage for the affected implementation phases, not silent passes or permission requests to use real traveler data.
