# UI component sources

The home screen uses local adaptations of shadcn/ui's Empty, Skeleton, and Card header/title/description components, discovered in the [21st.dev shadcn collection](https://21st.dev/@shadcn/library/shadcn-ui).

Source registry: https://ui.shadcn.com/r/styles/new-york-v4/{empty,skeleton,card}.json

Adaptations: existing stone/teal tokens, semantic headings, reduced-motion-aware skeletons, existing Card padding/API, and simple class composition instead of extra dependencies. Trip cards and the page composition are app-specific code. No hosted runtime or 21st account is required.

## Shared roles for trip screens

Use these before writing new class strings (`src/styles/index.css`, `src/ui`):

- Actions: `Button` and `LinkButton`. A link that looks like a button is a `LinkButton`, never a hand-styled `Link`.
- Surfaces: `Card` / `.ui-card`, and `.ui-row` for a tappable row in a list of destinations. Surfaces are `bg-surface` with a border; shadows are only for things that float (dialogs, sheets, map chips, the selected segment of a toggle).
- Text: `.ui-page-title` (one per screen, also inside `PageHeader`, which takes an optional `eyebrow`), `.ui-section-title` (card headings), `.ui-label` (small sentence-case labels; no all-caps tracked labels). `.travel-heading` is for the Georgia display titles on Home, Welcome and the trip overview.
- Dates: `formatDate` and `dateRange` in `src/lib/time.ts`; never show a stored `yyyy-MM-dd`.
- Loading: `ListSkeleton` (from `collection.tsx`) inside a screen, `LoadingState` for a whole screen.
- Text colour: `text-stone-600` or darker for words; `text-stone-500` at the lightest for icons that can be tapped.
- Stowie in an empty state: Tickets, Money and Tasks only. Other empties keep a plain icon.

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
