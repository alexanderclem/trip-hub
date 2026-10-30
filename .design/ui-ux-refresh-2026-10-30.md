# Stowaway UI/UX refresh — October 30, 2026

## Scope and governing principles

Refined the latest `alexanderclem/trip-hub` main (`c263263`) in an isolated checkout
on `codex/stowaway-ui-ux-refresh`. Existing work in the sibling local checkouts
and the DJX workspace was preserved.

The user's four principles are now explicit acceptance criteria in `DESIGN.md`:
visual hierarchy; consistency; proximity/alignment; feedback/responsiveness.
These apply to content and flow, beyond a palette change.

## Applied guidance

Read the requested [UI/UX Pro Max skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
at `9a3f14f7423037ccb8feeb4fee7482291b9c820e`, including its priority checks and
professional UI rules. Ran the design-system generator, then scoped style, UX,
and React searches. The broad travel query returned unsuitable Aurora gradients,
children's typefaces, and scroll storytelling; these were rejected. The narrower
minimal productivity query returned Minimalism & Swiss Style, a relevant match
for the user's request for restraint, hierarchy, grids, and functional controls.
Applied that guidance to Stowaway's existing trip artifacts and identity, without
installing hooks, adding a dependency, or adopting a generated marketing template.

Also reviewed the user's linked [Figma principles](https://www.figma.com/resource-library/ui-design-principles/)
and [UC San Diego UI/UX discussion](https://extendedstudies.ucsd.edu/news-events/extended-studies-blog/ui-and-ux-understanding-different-design-principles),
the existing design/brand reports, and the Design Partner and React review skills.
Historical serif, warm-paper, scroll-reveal, and dark-rail choices are superseded
by the user's explicit request for a sleeker, professional interface.

## Result

- Shared native sans-serif type, cool off-white canvas, white surfaces, ocean
  actions, restrained borders, and a quieter desktop sidebar. Logo masters remain
  intact. Browser/PWA chrome matches the new tokens.
- A single reading edge for page headings, descriptions, field labels, empty
  states, and photo captions. The two entry-card headings share an exact desktop
  baseline; their descriptions and controls stay grouped with their own task.
- Less repetition: removed welcome kicker/subtitle, decorative entry icons,
  duplicated workflow slogans, vague group heading/subtitle, quick-add filler,
  button sheen, scroll reveals, and blurred headline entrances. Shortened Places,
  Plan, Tickets, and Money empty-state instructions to their concrete next action.
- Creation appears first by default; explicit `#join` intent puts the invite form
  first in both DOM and visual order and retains input focus. Filled action
  emphasis follows that intent.
- Trip Home links directly to Places → Votes → Plan with real saved/open counts.
  Page headers retain the current trip name on subsequent screens. The next
  personal action remains primary; offline preparation/travel retain their phase
  priorities.
- Screen-specific header actions take precedence over the global Add shortcut,
  preventing two adjacent plus controls on Places and other action-led screens.
- Sample-trip tabs use a restrained underline, distinct from day selection. The
  map uses its full viewBox so route markers remain visible.
- Segmented radio controls support one tab stop, arrow-key selection/wraparound,
  Home/End, and readable nested selected labels. Existing native dialog focus,
  validation, loading, disabled, retry, local-save, sync, and offline paths remain.

## Verification

- `npm run typecheck`: passed application and tooling projects.
- `npm run build`: passed; PWA assets generated. Existing map/PDF chunk-size
  notices remain. No new dependency or external font request.
- `npm test -- --mode production`: 53 suites / 418 tests passed.
- Production-preview browser regression: **46 passed** across website, journal,
  design-flow, first-run, polish, and all-screen capture suites. Covers 320–1920px
  public layouts, 320–1440px trip layouts, 200% text, long content, keyboard focus,
  live reduced motion, create/join reading order, trip-name context, real planning
  links, radio keyboard behavior, phase priorities, offline reload, save failure
  and retry, local persistence, sample interactions, contrast, and laptop fold fit.
- Final focused check after removing duplicated Add controls: **5 passed**,
  covering contextual actions, shortcuts, keyboard settings, entry order, and
  laptop fold. Typecheck and production build passed again for the final source.
- Additional production-browser screenshots: landing, entry, create, trip list,
  overview, and Plan. No page exceptions observed in this capture run.
- Desktop entry headings measured at the same y-coordinate, 254.59375px, with
  start-aligned text. This verifies actual rendered grouping/alignment rather
  than only selected CSS rules.
- React review: unconditional hooks, unchanged lazy routes, stable list keys,
  native controls, no additional data-fetching subscriptions, retained independent
  local-query batching. New trip-name context is scoped to the existing shell.
- `git diff --check`: passed.

Browser coverage uses Chromium phone/desktop emulation, local IndexedDB fixtures,
and stubbed remote boundaries. It verifies the UI → local save/outbox → reactive
render/persistence path and recovery behavior; no real trips are written by the
selected suites. Physical-device behavior, other engines, screen readers, and
live multi-device sync are not certified by this pass. Enlarged text tests are
separate from browser-chrome zoom. This is a scoped UI refresh, not a complete
accessibility audit.

## Review artifacts

- [Homepage before](screenshots/ui-ux-refresh/before-landing.png) and
  [after](screenshots/ui-ux-refresh/landing-1440.png).
- [Entry before](screenshots/ui-ux-refresh/before-welcome.png) and
  [after](screenshots/ui-ux-refresh/welcome-1440.png).
- [Phone entry](screenshots/ui-ux-refresh/welcome-390.png).
- [Desktop trip](screenshots/ui-ux-refresh/overview-1440.png) and
  [phone trip](screenshots/ui-ux-refresh/overview-390.png).
- [Plan](screenshots/ui-ux-refresh/plan-1440.png).

Review on the feature branch; no production deployment or merge is part of this
change. Local production preview: `http://127.0.0.1:4193/`.
