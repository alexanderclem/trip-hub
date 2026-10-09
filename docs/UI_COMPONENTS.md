# UI component sources

The home screen uses local adaptations of shadcn/ui's Empty, Skeleton, and Card header/title/description components, discovered in the [21st.dev shadcn collection](https://21st.dev/@shadcn/library/shadcn-ui).

Source registry: https://ui.shadcn.com/r/styles/new-york-v4/{empty,skeleton,card}.json

Adaptations: existing stone/teal tokens, semantic headings, reduced-motion-aware skeletons, existing Card padding/API, and simple class composition instead of extra dependencies. Trip cards and the page composition are app-specific code. No hosted runtime or 21st account is required.

## Shared roles for trip screens

Use these before writing new class strings (`src/styles/index.css`, `src/ui`):

- Header: `PageHeader`, one per screen. It carries the back link, the title, the screen's own `action`, then the shell's tools (Stowie and sync status, supplied through the `HeaderTools` context by `TripLayout`). `below` holds a control for the whole screen (the Plan day strip, the Tickets search). Home and Map have no `PageHeader`; they render `use(HeaderTools)` themselves.
- Actions: `Button` and `LinkButton`. A link that looks like a button is a `LinkButton`, never a hand-styled `Link`. A quiet inline action is `.ui-link` (text weight, 44 px tall). Icon-only actions are `.ui-icon-button`.
- One add button: `Fab`, at most one per screen, hidden while an empty state already offers the same action.
- Surfaces: `Card` / `.ui-card` for a distinct object. Lists of destinations or records go in one `RowGroup` of `Row`s (`.ui-row-group`, `.ui-row`), divided by rules, not a card per row. Surfaces are `bg-surface` with a border; shadows are only for things that float (dialogs, sheets, map chips, the `Fab`, the selected segment of a toggle).
- Choices: `Segmented` for a two-to-four way switch; `Chip` / `.ui-chip` for filters and toggles.
- Rare or advanced content: `Disclosure`, one level down, with a summary that says what is inside. Never nest a second one.
- Text: `.ui-page-title` (one per screen, inside `PageHeader`), `SectionTitle` / `.ui-section-title` (every card and section heading), `.ui-label` (small sentence-case labels; no all-caps tracked labels). `.travel-heading` is for the Georgia display titles on Home, Welcome and the public website. Nothing is smaller than `text-xs`.
- Dates: `formatDate` and `dateRange` in `src/lib/time.ts`; never show a stored `yyyy-MM-dd`.
- Loading: `ListSkeleton` (from `collection.tsx`) inside a screen, `LoadingState` for a whole screen.
- Text colour: `text-stone-600` or darker for words; `text-stone-500` at the lightest for icons that can be tapped.
- Stowie in an empty state: Tickets, Money and Tasks only. Other empties keep a plain icon.

## Keeping screens uncluttered

These rules came out of the October 2026 clean-up; `tests/e2e/screens.spec.ts` screenshots every trip screen for checking them by eye (`SHOTS_DIR=<dir>`).

- Each destination appears once per screen. Don't add a link to something a tab or another control on the same screen already reaches.
- At most one filled (`primary`) button is visible on a screen.
- Nothing floats over content except the single `Fab`. Stowie and sync status live in the header.
- The five tabs are Home, Plan, Map, Vote and More, in that order on phone and desktop. Anything else is reached from More, grouped by when it is needed, or surfaced on Home under "Needs you" when it needs that person.
- Home is ordered by what needs the person: Needs you, Up next, What's new, first steps. A new feature earns a row in "Needs you" only when there is something for this person to do.
- Forms show what most entries need; the rest sits under one `Disclosure` that opens by itself when it already holds something. The submit button lives in `.ui-form-actions`, which stays at the bottom of the screen.
- Ticks, vote scores and stars use `.ui-check` / `.ui-press` for a short press response. No animation plays on load.
- Remove repeats, not information: times, balances, confirmation codes, vote counts and offline state stay visible.

Upstream license follows.

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
