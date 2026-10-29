# UI component sources

The home screen uses local adaptations of shadcn/ui's Empty, Skeleton, and Card header/title/description components, discovered in the [21st.dev shadcn collection](https://21st.dev/@shadcn/library/shadcn-ui).

Source registry: https://ui.shadcn.com/r/styles/new-york-v4/{empty,skeleton,card}.json

Adaptations: existing stone/teal tokens, semantic headings, reduced-motion-aware skeletons, existing Card padding/API, and simple class composition instead of extra dependencies. Trip cards and the page composition are app-specific code. No hosted runtime or 21st account is required.

## Shared roles for trip screens

Use these before writing new class strings (`src/styles/index.css`, `src/ui`):

- Header: `PageHeader`, one per screen. It carries the back link, the title, the screen's own `action`, then the shell's tools (Stowie and sync status, supplied through the `HeaderTools` context by `TripLayout`). `below` holds a control for the whole screen (the Plan day strip, the Tickets search). Home and Map have no `PageHeader`; they render `use(HeaderTools)` themselves.
- Actions: `Button` and `LinkButton`. A link that looks like a button is a `LinkButton`, never a hand-styled `Link`. A quiet inline action is `.ui-link` (text weight, 44 px tall). Icon-only actions are `.ui-icon-button`.
- One add button: `Fab`, at most one per screen, hidden while an empty state already offers the same action.
- Surfaces: `Card` / `.ui-card` for a distinct object. Give it `title` (and `eyebrow`, `action`) for a Georgia heading like the website's sample trip, `footer` for a ruled caption strip, and `framed` for the one hero object on a screen (a mist frame, at most one per screen). Lists of destinations or records go in one `RowGroup` of `Row`s (`.ui-row-group`, `.ui-row`), divided by rules, not a card per row. An agenda passes `time` for the tabular time column (`.ui-time`). Surfaces are `bg-surface` with a border; shadows are only for things that float (dialogs, sheets, map chips, the `Fab`, the selected segment of a toggle).
- Choices: `Segmented` for a two-to-four way switch; `Chip` / `.ui-chip` for filters and toggles. A hand-built switch uses `.ui-segmented` with `useSlidingHighlight` and a `.ui-highlight` span (Plan view, Vote/Results).
- State: `Status` (`.ui-status`) for a short label beside a record, such as Confirmed, Winner or Overlaps another item. Tones are `warning`, `danger`, `success` and `quiet`, and the label is always words.
- Rare or advanced content: `Disclosure`, one level down, with a summary that says what is inside. Never nest a second one.
- Text: `.ui-page-title` (Georgia, one per screen, inside `PageHeader`), `SectionTitle` / `.ui-section-title` (Georgia artifact titles on every card and section), `.ui-eyebrow` / `.ui-label` (small sentence-case labels above them; no all-caps tracked labels), `.ui-display` (one large Georgia figure such as the balance, with the key words in `<em>`). `.travel-heading` is for the Georgia display titles on Home, Welcome and the public website. Nothing is smaller than `text-xs`.
- Dates: `formatDate` and `dateRange` in `src/lib/time.ts`; never show a stored `yyyy-MM-dd`.
- Loading: `ListSkeleton` (from `collection.tsx`) inside a screen, `LoadingState` for a whole screen.
- Colour: semantic tokens only (`src/styles/index.css` `@theme`). Words are `text-ink` or `text-muted`, actions `text-action`, rules `border-line`, control edges `border-control`, surfaces `bg-surface` / `bg-canvas` / `bg-mist`, and states `warning`, `danger` or `success` (with `-ink` for text). Don't add raw `stone-*`, `bg-white` or Tailwind hues; `stone` is remapped to the warm neutrals only as a safety net. Radii are `rounded-control` (6px) and `rounded-surface` (10px).
- Stowie in an empty state: Tickets, Money and Tasks only. Other empties keep a plain icon.

## Keeping screens uncluttered

These rules came out of the October 2026 clean-up; `tests/e2e/screens.spec.ts` screenshots every trip screen for checking them by eye (`SHOTS_DIR=<dir>`).

- Each destination appears once per screen. Don't add a link to something a tab or another control on the same screen already reaches.
- At most one filled (`primary`) button is visible on a screen.
- Nothing floats over content except the single `Fab`. Stowie and sync status live in the header.
- The five tabs are Home, Plan, Map, Vote and More, in that order on phone and desktop. Anything else is reached from More, grouped by when it is needed, or surfaced on Home under "Needs you" when it needs that person.
- Home is ordered by what needs the person: Needs you, Up next, What's new, first steps. A new feature earns a row in "Needs you" only when there is something for this person to do.
- Forms show what most entries need; the rest sits under one `Disclosure` that opens by itself when it already holds something. The submit button lives in `.ui-form-actions`, which stays at the bottom of the screen.
- Ticks, vote scores and stars use `.ui-check` / `.ui-press` for a short press response. The only other motion is interaction motion from `src/ui/effects.tsx`: highlights that slide to the chosen option (`Segmented`, Plan days, tabs), a balance that counts up once (`NumberTicker`), the warming `.ui-link` underline and the primary button's sheen. Nothing loops, no section reveals on load or scroll (those stay on the website), and reduced motion turns all of it off.
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
