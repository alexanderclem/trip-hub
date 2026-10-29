# Trip journal polish — October 29, 2026

## Scope and direction

Implemented the seven requested improvements in the existing React/Vite app. The
warm paper, ocean ink, Georgia headings, coral accents, and Stowie identity remain
the visual foundation. Existing unrelated workspace changes were preserved. No
dependency, database migration, or new external media service was introduced.

## The seven changes

1. **Trip cards:** destination names, traveler previews, destination-calendar
   countdowns and phase labels; upcoming trips sorted chronologically, past trips
   tucked into a native disclosure. A single trip becomes a horizontal postcard on
   desktop; multiple trips use a responsive grid. Skeletons preserve the structure.
2. **Overview hierarchy:** one emphasized next action, ordered by overdue personal
   task, pending vote, balance, then personal task. The emphasized item is removed
   from the secondary personal list. Preparation and travel phases prioritize their
   own essentials. Setup guidance is lower on the page and initially collapsed for
   returning travelers; the first arrival retains onboarding guidance.
3. **Up next:** larger event name, local time with time-zone label, place, travelers,
   departure estimate, and direct map/ticket access. Travel-estimate explanations
   live inside a native disclosure. Tickets distinguish downloaded files from
   metadata. Travel/preparation headers are compact on phones.
4. **Quick add:** every trip screen receives an Add control that opens the existing
   native dialog primitive. Four ordinary links open plan, place, expense, and
   ticket creation. Plan additions retain a selected day when available. Keyboard
   dismissal restores focus; crowded mobile headers wrap rather than overflow.
5. **Group decisions:** each open vote reports how many current travelers have
   options still to score. A zero score counts as a vote; withdrawn/deleted votes
   and former members do not. Empty polls ask for options. Unassigned tasks link
   directly to the corresponding persistent URL filter. Both overview and vote
   list expose the group summaries.
6. **Trip personality:** four local SVG postcards (water, mountains, city, scenic
   route) and a plain option. Pickers are available in the overview and Settings.
   Covers persist through the normal trip-settings sync path. Saves read the latest
   trip row to preserve unrelated settings; draft choices survive failures. Stowie
   appears at arrival, setup completion, and the trip recap introduction.
7. **Finishing:** full-width offline preparation actions, readable dark-sidebar
   labels, long-name wrapping, mobile header reflow, consistent save/completion
   feedback, guarded submissions, keyboard focus behavior, and history-based
   scroll restoration that waits for local data to populate a returning screen.

## Motion and interaction

Use the existing Motion runtime and brand timing. Postcards lift slightly on hover,
art enlarges gently, and the arrow advances; presses settle immediately. Cover
changes fade into place, dialogs use the existing short entrance, and success
checks give one brief response. No animation loops or extra animation framework.
Reduced motion disables these transforms and preserves the feedback text.

The cover picker uses native radio keyboard behavior, a visible selected check,
and a persistent action footer. While saving, duplicate submission and dismissal
are prevented. Errors retain the selected cover for retry. Settings and task saves
also announce their outcome without suggesting that offline edits reached a server.

## Data and verification story

Trip list/overview → local IndexedDB reads → rendered summaries. Cover selection,
task completion, and votes → existing repository save → IndexedDB and sync outbox →
reactive rendering and persistence after reload. Test fixtures remain local or use
stubbed Supabase boundaries; no real trip is created or edited by browser tests.

## Coverage limits

Browser coverage uses Chromium with desktop and mobile emulation, keyboard input,
320–1440px layouts, 200% root text size, and live reduced-motion changes. Native
phone keyboards, physical iOS installation, other browser engines, screen readers,
and live multi-device server sync are not certified by this pass. Enlarged text is
not browser-chrome zoom. The existing large map/PDF chunk notices remain.

Local work only; no commit, push, or deployment was requested or performed.

## Executed checks

- `npm run typecheck`: passed for app and tooling TypeScript projects.
- `npm test -- --mode production`: 53 suites, 418 tests passed. New tests cover
  destination-calendar labels across DST, cover validation/fallbacks, partial
  voting, zero scores, withdrawn/deleted votes, and former members.
- `npm run build`: passed. Existing map/PDF chunk-size notices remain.
- `BASE_URL=http://127.0.0.1:4183 SHOTS_DIR=/tmp/stowaway-journal-final npx playwright test tests/e2e/journal.spec.ts tests/e2e/first-run.spec.ts tests/e2e/design-flow.spec.ts tests/e2e/polish.spec.ts --max-failures=1`:
  **29 passed** in the final integrated run.
- Browser checks cover phase priorities; all four quick-add destinations; native
  dialog Escape/focus restoration; radio arrow-key selection; cover persistence
  and retry after simulated storage failure; preservation of other settings;
  task completion/persistence; changing vote counts; unassigned filtering and
  history scroll restoration; first-run joining; retaining draft form values;
  failed saves/retries; service-worker offline reload; and saved ticket/map use.
- Tested the overview at 320, 390, 768, and 1440 CSS pixels in planning,
  preparing, traveling, and empty states. Long unbroken titles and 200% root
  font size fit the 320px content scroller. New-item forms were checked at 320px,
  with focused inputs retaining at least 16px text. Live reduced motion disables
  the quick-add transforms. Browser fixtures recorded no page exceptions in the
  phase/reflow checks.
- Calculated role-pair contrast: muted text on the focus surface 5.24:1; action
  ink on mist 6.42:1; mist sidebar labels on ocean ink 8.79:1; success labels
  6.42:1; warning labels 6.24:1. This checks these pairs, not every app surface.
- Visually reviewed final desktop home and overview, phone planning/traveling
  overview, quick add, cover picker, and departure-estimate card. Selected
  screenshots are in `screenshots/journal-2026-10-29/`; full captures remain in
  `/tmp/stowaway-journal-final/`.
- React review: stable mapped keys; no nested component definitions; effects
  clean up timers/listeners/observers; data reads are batched where independent;
  native links, buttons, radios, details, and dialog semantics retained; no new
  animation or UI dependency.
- `git diff --check`: passed.

## Finding fixes from verification

The test pass found and corrected narrow-header overflow, the group card's
minimum-width behavior under enlarged text, the compact offline action's width,
and premature scroll restoration before IndexedDB content returned. The cover
picker's plain option is a compact full-width row and its action footer remains
in reach on short viewports. Older tests were updated for the current page/copy
and intentionally collapsed returning-user guidance; no assertions about data
persistence or recovery were removed.
