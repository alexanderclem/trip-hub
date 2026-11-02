# Stowaway: Impeccable application pass — November 2, 2026

Applied to the current clean `trip-hub` main (`33ef1f7`) on
`codex/impeccable-app`. Sibling checkouts are unchanged. The user subsequently requested production deployment through the existing main-branch Cloudflare workflow.

## Implementation

- Installed the requested Impeccable 4.8.0 skill locally and followed its context,
  polish, hardening, operating-interface and craft guidance. Retained Stowaway's
  existing identity and product behavior. The local skill is ignored; the pinned
  package lock and `npm run lint:design` provide a repeatable source check.
- Composed the shared Button, LinkButton, Card, Input, Select, Textarea and Skeleton
  primitives with DaisyUI 5 and Tailwind 4. Limited generated DaisyUI components
  to the ones used; retained native dialogs and the existing Motion/Lucide stack.
- Added custom Stowaway light/dark palettes, with System as the default appearance.
  Preferences persist, follow live system changes, synchronize across tabs, and
  still work for the current session when preference storage is unavailable.
  A small external bootstrap applies the preference before the first paint.
- Added native, keyboard-operable DaisyUI theme controllers to public pages,
  app entry, saved trips and trip settings. The theme controls have full 44px hit
  areas and visible focus. Tailwind `dark:` follows the same active theme.
- Replaced light-only text and background pairs in activity, tasks, packing,
  map actions, organizer filters, emergency calls and Stowie messages. Itinerary
  kind/status colors now have separate readable light/dark tokens. Logo masters
  remain unchanged and have a light backing in dark mode.
- Associated shared Field hints with their actual controls, preserving explicit
  descriptions. Kept input text at 16px and improved error wrapping and status cues.
- Removed all three source findings: thick side borders on timeline blocks,
  departure guidance and shared error messages. Used full borders and an explicit
  alert icon, preserving kind and overlap information in the itinerary.
- Simplified segmented controls to CSS columns with immediate selection feedback,
  retaining their existing radio-group keyboard behavior without inline layout.
- Adapted Pasta UI's Follow-up Suggestions keyboard pattern to Stowie's native
  reply buttons. Arrow keys wrap; Home/End select a focus destination without
  submitting a reply. Retained its MIT notice in `docs/licenses/pastaui.txt`.
- Corrected the pricing calculator's invalid whitespace child of a table row,
  removed a static inline style, refined overly tight tracking, and documented
  the resulting shared component and appearance conventions.

Existing data, role enforcement, sync, URLs, drafts, error/retry behavior, offline
preparation and payment boundaries remain in the existing application architecture.
Existing runtime layout for maps, timeline placement and user-defined colors is
retained; this change does not claim to remove every historical inline style.

## Verification

- `npm run typecheck`: passed for application and tooling projects.
- `npm run build`: passed, including PWA generation. Existing large map/PDF bundle
  warnings remain. These checks were completed before deployment.
- `npm run lint:design`: passed, **296 source files, zero findings**. See the
  [before](impeccable-source-before.json) and [after](impeccable-source-after.json)
  records. No detector rules or findings were suppressed.
- Full unit suite under the repository's supported Node 22 with UTC:
  `TZ=UTC npx --yes --package=node@22 node node_modules/vitest/vitest.mjs run --mode production --maxWorkers=2`
  — **79 suites, 586 tests passed**. The initial host Node 23 run had 585 passing
  tests and one timezone-sensitive SQL string expectation; the supported-runtime
  UTC run passed without changing backend code or weakening the assertion.
- Production-preview Chromium regression: **58 existing browser tests passed**
  across website, design-flow, first-run, journal, organizer pricing, access roles,
  imports, payments and screen capture. All external service boundaries in the
  selected fixtures are aborted or stubbed; no live trips or payments were created.
- Screen captures covered **19 populated trip screens × phone/desktop × light/dark**,
  with overflow and page-error assertions. Reviewed representative rendered
  overview, forms, settings, plan and public-page screenshots.
- New appearance regression: **7 browser tests passed**. Covers system changes,
  manual override/reload/navigation, cross-tab updates, blocked storage, native
  radio keyboard/focus, Stowie reply navigation, and nine public/form routes at
  320/768/1440px in both themes. Text/status/action token pairs meet 4.5:1 and
  control borders meet 3:1. Visible public-page form inputs are at least 16px.
- Existing browser tests also exercise enlarged text, reduced motion, keyboard
  navigation, offline reload, local persistence, failed saves and retry, modal
  focus restoration, permissions and draft retention.
- `git diff --check`: passed.

Impeccable's URL scanner was also attempted, but its browser launch timed out
waiting for a WebSocket endpoint. That rendered Impeccable scan is incomplete;
the source scan's success is separate from the executed Playwright checks.
Chromium emulation and token/DOM checks do not certify physical-device behavior,
other browser engines, screen readers, every possible content state, or live
multi-device/backend integration.

## Review

Local production preview: http://127.0.0.1:4188/

- [Light public page](screenshots/impeccable/public-landing-light.png)
- [Dark public page](screenshots/impeccable/public-landing-dark.png)
- [Light trip workspace](screenshots/impeccable/light-overview-1440.png)
- [Dark trip workspace](screenshots/impeccable/dark-overview-1440.png)
- [Dark trip settings](screenshots/impeccable/dark-settings-390.png)

Only representative review screenshots are retained; the full disposable capture
set and interrupted-run traces are not part of the source change.
