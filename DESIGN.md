# Stowaway design system

**Direction: a calm, precise trip workspace.** The public website demonstrates the
product; the app helps a group save places, decide together, and follow a plan.
This October 30, 2026 system supersedes the earlier travel-journal styling.

## Governing principles

1. **Visual hierarchy:** establish one primary task per region. Use size, weight,
   contrast, and spacing to make it the first meaningful thing to notice.
2. **Consistency:** reuse shared components, interaction states, typography, spacing,
   and route patterns. Apply the same pattern to the same job across all screens.
3. **Proximity and alignment:** group related content and its action; separate
   independent tasks. Use a shared grid and left reading edge. Remove duplicated
   headings, repeated instructions, and text that has no decision or recovery value.
4. **Feedback and responsiveness:** preserve immediate pressed/selected feedback,
   loading and disabled states, local validation, truthful completion messages,
   retained drafts on failure, and a clear recovery path. Recompose for phones.

These principles are the acceptance criteria for future UI changes. Centering a
short control label is intentional; mixing the alignment of related prose is not.

## Identity and message

Keep the official suitcase mark, drawn wordmark, and restrained ocean/coral brand
identity. Do not retype, redraw, recolor, or distort the logo masters.

- Promise: **Your group trip. All in one place.**
- Explain the actual work: save places, vote on favorites, build an itinerary,
  organize tickets, and track shared expenses.
- Primary entry: Create a trip. Invite entry: Join trip. Returning entry: Open app.
- Never imply that a preference vote books travel or that expense tracking pays people.
- Label example trips and maps as illustrative. State offline preparation requirements.

See [docs/BRAND.md](docs/BRAND.md) for voice and identity rules.

## Foundation tokens

`src/styles/tokens.css` owns shared dimensions and typography.
`src/styles/themes.css` defines the light and dark palettes as custom DaisyUI themes.
`src/styles/index.css` maps them to semantic Tailwind roles. The root `tokens.css` supplies illustration aliases only.

| Role | Value | Use |
| --- | --- | --- |
| Canvas | `#f7f9f9` | Page and workspace background |
| Surface | `#ffffff` | Forms, records, headers, sidebar |
| Ink | `#17343f` | Primary text and selected controls |
| Action | `#245b69` | Primary actions and keyboard focus |
| Muted | `#53646c` | Descriptions, supporting metadata |
| Mist | `#e8f0f1` | Selected navigation and quiet accents |
| Border | `#dce4e6` | Grouping and rules |
| Control border | `#71858d` | Input and secondary-action boundaries |
| Coral | `#ef9477` | Small brand accents, never body text |
| On action | `#ffffff` | Text on action and ink backgrounds |

Status retains semantic success/warning/danger tokens and a visible label.
Use a 6px control radius and 12px surface radius. Reserve shadows for overlays,
floating controls, and the subtle public product-preview elevation.

## Type and alignment

Use the native system sans-serif stack without a font download. The supplied
wordmark remains its original artwork. Use sentence case, regular body text,
550–600 weight for controls/headings, and tabular numbers for times and amounts.

| Role | Size / line height |
| --- | --- |
| Public headline | `clamp(2.75rem, 5.2vw, 4.75rem)` / 1.07 |
| Public section | `clamp(1.875rem, 3vw, 2.75rem)` / 1.15 |
| Trip title | `clamp(1.875rem, 3vw, 2.75rem)` / 1.18 |
| Workspace title | 20–24px / 1.2 |
| Section heading | 17px / 1.4 |
| Body and form input | 16px / 1.5–1.7 |
| Supporting text | 14px / 1.5–1.7 |
| Metadata | 12px / 1.6 |

**Use one reading edge.** Left-align headings, descriptions, metadata, empty
states, captions, and their actions. Center icons and short control labels within
their hit area; align numerical columns for comparison. Do not center a content
block merely because it is empty or introductory.

## Grouping and content

- Keep the heading, explanation, fields/records, and action for one task together.
  Use 8–12px inside a relationship, 16–24px within a component, and 24–32px between
  separate tasks. Wide public sections use 64–96px.
- Use one heading per subject. Remove a subtitle that repeats that heading or the
  next control. Add help only when it explains a consequence or prevents an error.
- Put dates/destination with the trip name; put attendees and ticket/map actions
  with their event; put balance details with expenses.
- Use a border or surface to express a real object or decision region. List rows
  share a container and rules; avoid a separate card around every sentence.
- Keep prose to a readable measure. Wrap long trip names and user content.

## Flow and composition

- `/`: one dominant create action and a quieter join link beside the interactive
  sample trip. Plain workflow steps explain invite → decide → follow the plan.
  Offline prerequisites and FAQs follow. No blur-in text, scroll reveals, sheen,
  promotional metrics, or looping decoration.
- `/app`: create appears first in both DOM and mobile layout. `/app#join` puts
  joining first and focuses the invite field. Optional accounts, inspiration, and
  installation follow the entry choices.
- `/new`: two required fields; optional dates/destination and advanced currency/time
  settings are disclosed progressively. Keep draft values and recovery behavior.
- Trip Home: trip identity → planning shortcuts (Places / Votes / Plan with real
  counts) → one next action → other personal needs, upcoming event, group decisions.
  Preparation/travel phases prioritize offline readiness and the next event.
- Desktop: quiet white navigation rail, grouped destinations, clear selected state.
  Phone: five persistent tabs. Header context names the current trip.
- Keep local data, URLs, backend validation, sync, save/undo, and account behavior.

## Components and behavior

Use existing `PageHeader`, `Card`, `RowGroup`, `Row`, `SectionTitle`, `Button`,
`LinkButton`, `Disclosure`, `Segmented`, and `Empty` primitives. See
[docs/UI_COMPONENTS.md](docs/UI_COMPONENTS.md).

Keep one primary action per decision region. Controls retain hover, focus,
pressed/selected, disabled, loading, error, and recovery states. Essential touch
controls are at least 44px high. Native dialogs retain Escape and focus restoration.
Segmented radio groups have one tab stop, arrow-key selection with wraparound,
and Home/End. Selected content retains readable contrast, including nested labels.

Motion is limited to short state/selection feedback; honor reduced motion. One exception
(November 4, 2026): opening a plan item, place or ticket carries its icon, title and time or code
from the list row into its own screen (`Morph`, 340ms, View Transitions). It never loops, never
decorates, and is off with reduced motion and in browsers without View Transitions.
Test 320px through desktop, enlarged text, long/empty content, keyboard access,
phase-specific priorities, offline readiness, and persistence after reload.

Historical `.design` reports record prior decisions. The current implementation
and `.design/ui-ux-refresh-2026-10-30.md` describe this revision and its verification.

## Appearance and implementation — November 2, 2026

- Shared buttons, cards, inputs, textareas, selects, skeletons and the appearance
  controller use DaisyUI 5 with Tailwind 4. Generate only the components in use;
  avoid global resets that could change map, PDF or native dialog behavior.
- Appearance defaults to the system. Light/Dark overrides persist on this device,
  synchronize across tabs, and keep working for the session when storage is blocked.
  The small external `appearance.js` applies the choice before the first paint.
- Map existing `ink`, `muted`, `action`, `on-action`, status and itinerary roles to
  each theme. Use `text-on-action` on action backgrounds, `text-danger` on danger-ink
  backgrounds; fixed-color artwork/avatars retain their own foreground pairs.
- Tailwind `dark:` follows `data-theme="stowaway-dark"`. Native DaisyUI theme
  controller radios share that same state. Preserve logo masters on a light backing.
- Form hints belong to their field's accessible description. Keep input font sizes
  at least 16px on phones. Controls have a visible focus indicator and 44px targets.
- Stowie reply suggestions adapt Pasta UI's keyboard pattern using existing native
  buttons, without adding its separate component runtime or icon library.
- Impeccable is a development tool. `npm run lint:design` scans all application source;
  TypeScript and the test suites supply the code and behavior checks.
