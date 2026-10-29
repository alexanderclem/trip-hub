# Stowaway design system

**Direction: a shared travel journal.** Calm, practical, and sociable. The website
shows why a group would use Stowaway; the application makes the next action clear.
This October 29, 2026 system supersedes the October 22 poster direction.

See [.design/brand-system.html](.design/brand-system.html) for the visual reference
and [docs/BRAND.md](docs/BRAND.md) for messaging and logo rules.

## Product and message

Stowaway is a shared trip planner for trips with friends. The primary job is to
turn saved ideas into a plan everyone can find, then keep tickets and costs nearby.

- Main message: **Your group trip. All in one place.**
- Explanation: Save places, vote on favorites, and build an itinerary together.
  Keep tickets and shared expenses with the plan.
- Supporting signature: The whole trip, tucked away.
- Primary action: Create a trip. Secondary: Join your group. Returning: Open app.

Use specific actions and artifacts. Keep each section to one job. Show an
itinerary, vote, ticket, or expense example beside its explanation. Label sample
data as illustrative. Do not suggest Stowaway makes reservations or payments.

## Foundations

`src/styles/tokens.css` is the source of truth shared by the app and website.
The root `tokens.css` provides only illustration aliases for the website.

| Role | Value | Use |
| --- | --- | --- |
| Canvas | `#f8f5ee` | Warm paper behind the page and app |
| Surface | `#fffdf8` | Records, forms, and example artifacts |
| Ink | `#183e4b` | Text, primary website actions, desktop sidebar |
| Action | `#295361` | Links, app actions, focused and selected controls |
| Muted | `#586467` | Supporting text on canvas and surface |
| Mist | `#d6e4e5` | Supporting sections, selected navigation, demo frame |
| Coral | `#ef9477` | Small brand accents and closing invitation |
| Border | `#dcded5` | Noninteractive grouping and rules |
| Control border | `#687e83` | Controls and boundaries needing visible contrast |
| On action | `#fffdf8` | Text on ink or action backgrounds |

Coral takes ink text. It is not a text or focus color on cream. Status colors
keep their established meanings and visible labels. Light borders separate
content; stronger control borders identify interactive boundaries.

### Type

Two families, with distinct jobs:

- **Georgia / Times New Roman / serif:** page and section headlines, trip names,
  artifact titles. Regular weight; sentence case. Italic adds a quiet second voice
  in editorial headings and the signature. Do not apply italics to navigation.
- **System sans-serif:** body copy, navigation, labels, dates, amounts, and controls.
  Weight 400 for reading, 550–600 for controls and headings. Use tabular numerals
  for times and aligned amounts. Keep labels in sentence case.

The drawn wordmark remains artwork. No font downloads are needed. The previous
Antonio asset is retained with its license, but is not used or preloaded.

| Role | Size / line height |
| --- | --- |
| Hero | `clamp(3rem, 5.7vw, 5rem)` / 1.08; compact mobile override |
| Section | `clamp(2.25rem, 3.7vw, 3.5rem)` / 1.12 |
| Artifact title | 1.375–1.75rem / 1.2–1.3 |
| Body | 1–1.0625rem / 1.6–1.8 |
| Supporting copy | .875rem / 1.7–1.8 |
| Metadata | .75rem / 1.6–1.7 |
| Forms | At least 1rem, including on phones |

Use readable paragraph measures of roughly 39–46 characters. Headings wrap
naturally; do not truncate or hide long content.

### Space and shape

Use the 4px rhythm: 4, 8, 12, 16, 24, 32, 48, 64, 96. Content width caps at
1200px. Fluid gutters range from 20px to 64px; section spacing ranges from 64px to
96px. Editorial layouts recompose to a single column below 760px.

Controls have a 6px radius. Surfaces and photos have a 10px radius. Nested demo
frames add their padding to the inner radius. Use rules and background changes
to group content; reserve shadows for existing overlays and floating app actions.

## Components and states

- Primary buttons: ink with warm white text on the website; action blue in the
  app. Hover changes to the other ink/action shade. Press feedback moves 1px.
- Secondary buttons: transparent or surface with a strong control border; mist
  on hover. One primary filled action per decision region.
- Text links: underlined with a 5px offset in website action groups. Navigation
  gets an underline on hover. Important actions have at least 44px targets.
- Focus: a visible 2px action outline, offset from the control. On the dark app
  sidebar, use the existing coral outline. Never remove the ring without a replacement.
- Selected day: ink fill, warm white text, and `aria-pressed=true`. The itinerary
  remains a stable height while days change; announce the selected day.
- FAQ: native `details`/`summary`, plus/minus indicator, keyboard activation.
- Forms: retain existing labels, validation, pending states, confirmations, and
  recovery. Disabled buttons use native disabled behavior. Errors explain the
  next action and retain input.

## Page patterns

The homepage follows: category and promise beside an interactive sample trip →
concrete capabilities → three planning steps → offline preparation with the
destination photograph → questions → create action. The sample trip (Ideas, Vote,
Plan, Essentials) is local-only and demonstrates the product before sign-up. Do
not add a second manifesto or a string of taglines.

`/app` is a task, not another marketing page: a compact introduction and direct
create/join actions. An invite link (`#join`) gives priority to the invite field.
Installation is always an explicit choice. Creation starts with a trip name and
traveler name; dates and destination are optional and editable later in Settings.

The trip app is drawn from the website's sample trip. It uses Georgia page and card titles
with eyebrows, ruled row groups instead of a card per row, an agenda time column, ink for the
chosen option, mist frames for the one hero object on a screen, and `Status` labels. Screens use
the semantic Tailwind tokens in `src/styles/index.css` (see `docs/UI_COMPONENTS.md`). Itinerary
kinds and place categories use the same restrained journal tones (sage, coral, ocean, slate,
dusk, sand), each checked for AA.

Trip workspace: Home prioritizes decisions during planning, offline preparation
within seven destination-calendar days of departure, and the next event during
travel. Plan defaults to a compact agenda; the proportional timeline remains
available through a labeled toggle. Routes, tabs, and shared primitives are
unchanged; records inherit these tokens.

## Imagery and motion

Use destination photography to express travel, and product examples to explain
function. Serve the existing lake photo locally. Its caption identifies it as
inspiration rather than an actual offered itinerary. The suitcase illustration
belongs in onboarding and offline preparation; keep ordinary forms uncluttered.

Website-only effects live in `src/features/website/effects.tsx` and CSS. They adapt
patterns from React Bits, Magic UI, Motion Primitives, Animate UI and Animata on
the existing `motion/react` runtime, with no copied code or added dependency: a
blur-fade as sections first enter view, a word-by-word reveal of the hero's
italic line, a highlight that slides between sample-trip tabs, a number ticker
on the cost share, an underline that tightens and warms on hover, and one sheen
across the primary action on hover. Sections start readable (60% opacity);
the hero line settles within 0.75s. Nothing loops, and reduced motion disables
all of it. Particles, shader
backgrounds, globes and cursor effects are out: they add weight, ignore touch,
and compete with the product example.

The app shares only the interaction effects, from `src/ui/effects.tsx`: the sliding highlight
(segmented switches, Plan days, phone tabs), the number ticker on the balance, the warming link
underline, and the primary sheen. Load and scroll reveals stay website-only.

No entrance or scroll animation is required to read the website. Brief control
feedback uses 160ms and the shared easing. Existing day transitions communicate
selection. Respect reduced motion, including a preference change during a visit.

## Verification and compatibility

Keep skip links, native links/disclosures, keyboard focus, and responsive reflow.
Verify at 320px through wide desktop widths, 200% text size, and browser zoom.
Prepare offline access while online; maps require their own saved pack or area.

Database names, storage keys, shared URLs, backend logic, and the logo masters
remain compatible. This work does not change domain or deployment configuration.
See `.design/brand-system-2026-10-29.md` for the executed verification record.
