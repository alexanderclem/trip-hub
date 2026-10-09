# App consistency and landing polish: verification (2026-10-08)

Branch `polish/website-entry`, uncommitted. Plan: app screens first, then the landing page.

## What changed

- **Shared roles** (`src/styles/index.css`, `src/ui/index.tsx`, `src/ui/collection.tsx`, `src/lib/time.ts`):
  `.ui-row`, `.ui-page-title`, `.ui-section-title`, `.ui-label`, `PageHeader` `eyebrow`,
  `ListSkeleton`, `formatDate`, `dateRange`. Fields show one focus indicator (the outline, on the border).
- **Buttons**: 12 hand-styled button links now use `LinkButton`.
- **Surfaces**: static cards and rows are `bg-surface` with a border and no shadow (23 lines);
  More uses `.ui-row`. Shadows remain on dialogs, sheets, map chips, toggle thumbs, plan blocks, PDF pages.
- **Headers and labels**: Plan, Money and Tickets headers share the canvas background and page-title
  role; all-caps tracked labels are sentence-case `.ui-label`. Home shows one line under its title.
- **Dates, loading, contrast, icons**: no raw `yyyy-MM-dd` in the sidebar, open tasks or traveler page;
  eight inline "Loading…" lines are skeletons; `text-stone-400` no longer carries words or tappable
  icons; typed `📍` and `✓` glyphs are gone.
- **Sidebar**: the trip name appears once (the switcher) with formatted dates.
- **Empty states**: Stowie replaces the icon on Tickets, Money and Tasks.
- **Landing**: three labelled examples beside "How it works", a drawn FAQ chevron, a sticky header
  from 44rem, footer section links, a not-found page for unknown addresses, a branded error screen.

## Checks run

- `npm run typecheck`: passed.
- `npm test -- --mode production`: 50 files, 407 tests passed.
- `npm run build`: passed, 174 precache entries.
- Playwright against a local preview (`website`, `polish`, `account`, `first-run` specs): 27 passed.
- Greps: no hand-styled `bg-brand-700 px` button links; no `uppercase` outside the Wrapped slides
  and the Plan day strip.
- Screenshots reviewed by eye at 390 and 1440 px, saved in `screenshots/app-consistency/`:
  landing, not-found, `/app`, and a locally seeded trip's overview, More, Money, Tasks, Tickets, Plan, Votes.

## Test fixtures corrected

`tests/e2e/polish.spec.ts` seeds a local trip. Its helper opened `/inspire` (now Stowie's chat, so the
expected heading never appeared) and used a join time before the alpha reset (so the app cleared the
trip on start). It now opens `/inspire/manual` and joins after the reset. `tests/e2e/tickets.spec.ts`
matches "Ready for offline · checked" without the typed tick.

## Not done or not verified

- Money keeps its own header markup (restyled) instead of moving to `PageHeader`, because the tab
  screens have no back target.
- The hero and brand copy were changed by a separate session during this work and were left as that
  session wrote them; it kept "The whole trip, tucked away." as the supporting tagline.
- Live-backend specs, a physical iPhone, screen readers and the Map screen were not exercised.
  Filled states (expenses, tickets, plan items) were checked in code, not in screenshots.
- Card headings still vary between `font-semibold` and `.ui-section-title` inside feature cards.
