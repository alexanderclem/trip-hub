---
name: Stowaway public website (Luggage Tag)
description: The public site printed as one long bag tag for the group's trip, on an ocean-ink ground.
colors:
  ground: "#17343f"
  stock: "#f1f4f5"
  card: "#ffffff"
  ink: "#17343f"
  print: "#4a5e66"
  rule: "#9fb2b7"
  coral: "#f0805f"
  on-coral: "#17343f"
  signal: "#f2c230"
  on-signal: "#17343f"
  ground-dark: "#08171c"
  stock-dark: "#10262e"
  card-dark: "#163039"
  ink-dark: "#eaf1ef"
  print-dark: "#a9bcc0"
  rule-dark: "#46636c"
  on-coral-dark: "#10262e"
typography:
  display:
    fontFamily: "Antonio, 'Barlow Condensed', sans-serif"
    fontSize: "min(15.5cqi, 5.5rem)"
    fontWeight: 700
    lineHeight: 0.86
    letterSpacing: "-0.005em"
  code:
    fontFamily: "Antonio, 'Barlow Condensed', sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1
  code-day:
    fontFamily: "Antonio, 'Barlow Condensed', sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 0.9
  code-stub:
    fontFamily: "Antonio, 'Barlow Condensed', sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 0.9
  code-strip:
    fontFamily: "Antonio, 'Barlow Condensed', sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  headline-page:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  section-secondary:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(1.625rem, 3vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  price:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3.2vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  question:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 2vw, 1.5rem)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  subtitle:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
  lede:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 1.4vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  fine:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  control:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0"
  label:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
  caption:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  row-title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
  app-section:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  app-entry-title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.3
  card-title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  stub: "0px"
  mark: "2px"
  stamp: "4px"
  field: "6px"
  control: "8px"
  card: "10px"
  shell: "18px"
  sheet: "22px"
  phone-sheet: "1.5rem"
  pill: "999px"
spacing:
  edge-min: "8px"
  sheet-max: "1320px"
  shell-pad: "clamp(1.25rem, 4.2vw, 4rem)"
  stop-block: "clamp(2.5rem, 6vw, 5rem)"
  perforation: "28px"
  gap-xs: "0.5rem"
  gap-sm: "0.75rem"
  gap-md: "1rem"
  gap-lg: "1.75rem"
  target: "44px"
components:
  tear-primary:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.on-coral}"
    typography: "{typography.control}"
    rounded: "{rounded.stub}"
    padding: "0.875rem 1rem 0.875rem 1.75rem"
    height: "88px"
  tear-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.stub}"
    padding: "0.875rem 1rem 0.875rem 1.75rem"
    height: "88px"
  button-primary:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.on-coral}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0.75rem 1.375rem"
    height: "52px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1.125rem"
    height: "48px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1.125rem"
    height: "48px"
  switch:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1.125rem"
    height: "48px"
  switch-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
  choice-chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.375rem"
    height: "44px"
  choice-chip-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
  tag-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "1rem"
  mini-tag:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "2.25rem 1rem 1rem"
  stub-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "4px 10px 10px 4px"
    padding: "1.125rem 1.25rem 1rem 1.75rem"
  priority-stamp:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.on-coral}"
    rounded: "{rounded.stamp}"
    padding: "0.25rem 0.625rem"
  plan-item-open:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.on-signal}"
    rounded: "{rounded.field}"
    padding: "0.5rem"
    height: "52px"
  strip-code-picked:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.on-coral}"
    padding: "0.125rem 0.25rem"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  nav-link:
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    padding: "0 0.75rem"
    height: "44px"
---

# Design System: Stowaway public website (Luggage Tag)

## Overview

**Creative North Star: "The Group's Bag Tag"**

Every public page is one long luggage tag hung on an ocean-ink ground. The header carries the eyelet the tag hangs from, the footer closes the sheet, and everything between is printed on cool thermal stock in ink: route codes at display scale, travelers in condensed print, the plan as a routing, tickets as tear-off stubs, barcodes as the closing mark. Sections are separated by perforated tear lines with notches cut from both edges. The page reads like a trip printing itself, line by line.

Chrome refinement (Nov 2026): the signature pieces (eyelet, perforations, tear stubs, route print, the reversed offline stub) keep their ink; generic chrome (header rule, field lists, FAQ rows, steps, cards on secondary pages, outline buttons) uses 1px hairlines, a faint lift and tinted fills, matching the app material in docs/UI_COMPONENTS.md. Where the text below says 2px or dashed for those, the hairline wins.

The density is a printed document's: hard 2px ink strokes, dashed rules, small condensed travel labels, and generous blocks of air between stops. Colour is almost entirely ink on stock. Coral is the one loud colour and belongs to the group's choice and the primary action; signal yellow marks what is still open. State is shown as print density (solid, half-toned, ghost), never as a new colour. Dark mode is the same tag printed in reverse.

**Scope.** The public website uses the luggage-tag composition. The working app shares its palette, fonts and printed details through `src/styles/app-theme.css`, while retaining its task-focused layouts. Shared typography roles live in `src/styles/tokens.css` and the component guidance in `docs/UI_COMPONENTS.md`.

**Key Characteristics:**
- One sheet of tag stock on an ink ground, with an eyelet at the top and 22px sheet corners top and bottom.
- Perforated tear lines are the section dividers; inside a section, rows are divided by 1px hairlines (ink at 14%), not dashes (chrome refinement, Nov 2026).
- Antonio route codes (CDG, PAR, VRS, MON) are the display voice; Barlow carries headings, body and controls; Barlow Condensed is reserved for small travel labels.
- Coral appears only on the group's choice and the primary action.
- Print density shows state: confirmed solid, tentative half-toned, empty as a dashed ghost tag.
- Motion prints in once and stamps; nothing loops.

## Colors

Ocean ink on cool thermal stock, with one coral and one signal yellow kept to precise jobs.

### Primary
- **Priority Coral** (coral): the primary action (the Create a trip tear stub and the website primary button), the PRIORITY stamp, the vote winner's ring and the highlighter under the winner's name, your own vote tick, the picked neighborhood code on the routing strip, text selection and the focus outline. Text on coral is always ink (on-coral).

### Secondary
- **Signal Yellow** (signal): "still open". The open plan slot waiting on the vote, and the Beta availability label on Pricing. Text on it is fixed ocean ink (on-signal) in both themes.

### Neutral
- **Ocean Ink Ground** (ground): the field the tag hangs on, the eyelet hole and the notches cut out of every perforation.
- **Thermal Stock** (stock): the tag sheet itself; header, main and footer share it.
- **Card White** (card): the lighter stock of cards printed on the tag (mini tags, vote options, day cards, stubs, inputs).
- **Ink** (ink): all print: text, 2px and 3px strokes, the reversed offline stub, pressed controls.
- **Faded Print** (print): secondary print: ledes, field labels, fine print, the arrow between route codes.
- **Tear Rule** (rule): dashed perforations, dashed in-section rules, ghost tag outlines and the outline stroke of a ghost route code. Decorative only; never carries text.

**Dark (reverse print).** Under the app's dark theme the same roles invert: ground-dark, stock-dark, card-dark, ink-dark, print-dark, rule-dark, on-coral-dark. Coral and signal keep their values. The half-tone dot strengthens from 16% to 22% ink so tentative items stay legible.

### Named Rules
**The Coral Ledger Rule.** Coral is spent only on the primary action, the PRIORITY stamp, the vote winner, your vote tick, the picked strip code, selection and focus. Links, hovers, the current nav item and the current strip stop are ink. If a new element wants coral, it has to be the group's choice or the one action that starts a trip.

**The Yellow Means Open Rule.** Signal yellow marks a slot or offer that is not settled yet. It never decorates, and it always carries ink text.

## Typography

All fonts are self-hosted WOFF2 under the OFL. Barlow carries sentence-case headings,
body copy, names, controls, navigation and financial information. Barlow Condensed is
reserved for small uppercase travel metadata. Antonio gives route codes their identity.

### Hierarchy
- **Route display:** Antonio 700, sized to the example tag it prints on (up to 5.5rem), always below the headline in size. The readable place names print directly under it.
- **Printed codes:** Antonio 700 at fixed steps below the display: day-card routes 2.25–3.25rem, the offline stub 2.25–3rem, saved-place and vote codes 2.25rem, the desktop strip 1.875rem.
- **Lede and question:** Barlow 400 at 1.0625–1.25rem for intros; Barlow 600 at 1.25–1.5rem for the vote question. Prices print at 2.5rem Barlow 600.
- **Headline:** Barlow 700, 2.5–4.5rem, line-height 1.04; the home h1 is the largest type on the page. Subpage titles use 2–3.5rem at 1.1.
- **Section title:** Barlow 600, 1.75–2.75rem, line-height 1.2 and -0.02em tracking. Sentence case.
- **Card title:** Barlow 600, 1.0625–1.5rem, line-height 1.3. App section titles use 1.125rem.
- **Body:** Barlow 400, 1rem in the app and 1.0625rem publicly, line-height 1.6–1.65.
  Keep prose to 65ch; shorter intros stay around 40–46ch. Do not constrain structured rows.
- **Control:** Barlow 600, 1rem, line-height 1.4, normal tracking and sentence case.
- **Travel label:** Barlow Condensed 600, 0.8125rem, modest tracking and uppercase. Use only
  for a printed field or travel metadata; regular form labels use Barlow in sentence case.
- **Secondary information:** Barlow 400–500, 0.8125–0.875rem, line-height 1.5.
- **Caption floor:** 0.8125rem (13px) is the smallest text anyone reads. Tailwind's `text-xs`
  is remapped to it in `src/styles/index.css`, and CSS uses `var(--stowaway-text-caption)`.
  Only the initials inside a 20px avatar dot go smaller. Form fields stay at 16px so iPhone
  Safari never zooms on focus.
- **Numbers:** tabular numerals for times and amounts. Financial amounts and actual booking
  references use Barlow for readability; they are not decorative route lettering.

### Named Rules
**The Code Is Print Rule.** Route codes decorate a fact stated in words. Hide decorative
codes and barcodes from assistive technology and supply the readable meaning nearby.

**The Field, Not Kicker Rule.** Small uppercase print identifies a travel field or metadata.
Never use condensed capitals as the default for section headings, buttons or long text.

**The Hierarchy Rule.** Reserve the largest type for the page's subject. Body, captions,
controls and statuses have distinct roles; stronger weight is not the default everywhere.
Use actual supplied weights, preserve user text scaling and let containers grow.

## Layout

The tag sheet is centred with a maximum width of 1320px and a minimum 8px of ground showing on each side; content inside uses a fluid shell padding (clamp 1.25rem to 4rem). Stops are separated by perforations (28px tall) and have fluid vertical padding (clamp 2.5rem to 5rem).

The landing page's first screen is only the header and the hero, message first: the h1, one line and the two tear stubs on the left; on the right (below on phones) a product demo built with the Stageshow kit (`src/features/website/stage/`, vendored in `stage/kit`). A phone pinned top-left and cropped by the hero's tear line shows the app's Vote screen; the day's plan card straddles its right edge as one satellite. It plays once as it scrolls in (a tap on Must-do breaks the tie, the score rolls, the plan's open 15:00 slot becomes the group's pick) and its poster, shown under reduced motion, is that result. Columns are 1fr and 560px from 960px. Below the hero a feature bento ("hero and strip": plan 2/3, offline 1/3, then money, tickets, invite) replaces the old routing rail and stops; each picture is its own Stage at 1:1 with a 358px-column compact design, copy is page text, the money stat is the one inverted tile, and each tile plays one small beat once in view. Product demos draw in the app's own tokens and may use soft shadows (the one exception to flat print), so they read as the real app. Pass `film.mjs --gate` from the Stageshow skill at 1280 and 390 after changing them. The layer order in `index.html` puts `stageshow` last so Tailwind's preflight can't reset the kit.

Secondary pages open with a tag head: title and intro on the left, a printed field list (label and value rows on dashed rules, under a 3px ink rule) on the right from 960px. Sections below are divided by 2px dashed rules.

Breakpoints are 360px (hide the header's Open app box), 640px (three-across mini tags, four-across name buttons and footer links), 960px (two-column grids) and 1100px (desktop nav and the routing rail). Every target is at least 44px; plan rows and name buttons are 52px.

## Elevation & Depth

The tag is flat. Depth comes from print and paper: card-white stock on thermal stock, 2px ink strokes, the ground showing through punched holes, and the stub printed in reverse. There are no blurred drop shadows. Box-shadow is used only as print: solid rings and bars with no blur or offset.

### Shadow Vocabulary
- **Eyelet ring** (`box-shadow: 0 0 0 4px stock, 0 0 0 6px rule`): the reinforced hole at the top of the tag.
- **Mini-tag hole** (`box-shadow: 0 0 0 2px ink`): the string hole on each saved-place tag.
- **Winner ring** (`box-shadow: 0 0 0 4px coral`): the vote option the group picked.
- **Current stop bar** (`box-shadow: inset 0 -4px 0 ink`): the lit stop on the phone route bar. On the desktop rail the lit stop is a 9% ink tint instead.
- **Winner highlighter** (`box-shadow: inset 0 -0.4em 0 coral at 55%`): under the winner's name in the vote result.

### Named Rules
**The Print Density Rule.** State is shown by how heavily something is printed. Confirmed prints solid. Tentative prints on a 5px half-tone dot with lighter weight and faded state text. Empty is a ghost: dashed rule outline, no fill, faded print ("Your idea"), or an outline-only code on the strip. Don't add a colour to show state.

**The Reverse Print Rule.** Reversal is the only inversion: dark mode prints the whole tag in reverse, and the offline stub prints in reverse (ink fill, stock text) when airplane mode is on.

## Shapes

The tag sheet has 22px corners top and bottom; perforations cut 11px semicircular notches out of both edges with a 2px dashed tear line between them. Cards printed on the tag have 10px corners and a 2px ink stroke. Controls have 8px corners, field highlights 6px, the stamp 4px, the airplane-mode switch is a full pill. Tear stubs are square, with a 9px half-circle punched out of the tear side by a mask, a ringed hole rim, and a dashed tear line just inside. Stub cards have a dashed left edge and asymmetric corners (4px on the tear side, 10px on the far side). Saved-place mini tags hang slightly askew (between -1.2deg and 1.4deg) and the PRIORITY stamp lands at -5deg; those are the only rotations.

## Components

### Buttons
Tactile print: sentence-case Barlow controls, small condensed travel labels, 2px ink strokes, nothing glossy.
- **Tear stub (signature primary):** the landing page's Create a trip and Join trip are tear-off stubs (88px tall, 76px on phones, 64px compact). Primary is coral with ink text; secondary is an ink outline with a punched hole rim. Each carries a large label (clamp 1.625rem to 2.125rem) and one line of field print. Hover lifts 2px with an ink tint (primary darkens coral by 14% ink); press drops 1px; transitions 160ms on the world easing.
- **Website primary:** subpage primary actions are coral buttons, 52px, 8px corners, 1rem Barlow 600 in sentence case; hover darkens and lifts 1px.
- **Ink and quiet buttons:** in-demo actions (Save another place) are 48px with an ink stroke, quiet by default and filled ink on hover. Disabled drops to 55% opacity.
- **Text link:** Barlow 600 at 1rem in sentence case with an ink underline.
- **Focus:** every interactive element shows a 3px coral outline offset 3px over a 3px ink ring
  (`box-shadow: 0 0 0 3px ink`). Coral alone is 2.4:1 on light stock; the ink ring carries the
  contrast in both themes. Fields drop the ring and put the coral outline straight on their ink edge.

### Chips (choice buttons)
- **Style:** vote scores (No way, Fine, Want, Must-do) and the Join name picker: 44px (52px for names), 2px ink stroke, 8px corners, Barlow 600 in sentence case.
- **State:** hover takes an 8% ink tint; pressed (aria-pressed) fills ink with stock text. Pressed is never coral.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** card white on stock, 2px ink stroke.
- **Shadow Strategy:** flat; only the winner ring (see Elevation & Depth).
- **Internal Padding:** 1rem to 1.25rem; lists inside run under a 2px ink rule with 1px dashed rule separators and 52px rows.
- **Variants:** vote option (code, town, points, tick bar of the group's votes with yours in coral), day card (route codes, Day n title, time / what / state rows), mini tag (string hole, code, place, "Saved by"), stub card (dashed tear edge, barcode, cost fields in tabular Barlow figures).

### Inputs / Fields
- **Style:** 2px ink stroke, 8px corners, card-white fill, ink text (fee calculator and the early-access form). A checked choice fills ink.
- **Focus:** the world's 3px coral outline.

### Navigation
- **Header:** the drawn wordmark at left, sentence-case Barlow links (0.9375rem, normal tracking) at right from 1100px. Hover underlines 2px; the current page underlines 3px in ink. Open app is a pill with a 1.5px ink edge (3:1, tested). Below 1100px a 44px round menu icon (tinted on press) opens a full-width list of 52px rows on hairlines; Escape closes it and returns focus.
- **Routing strip:** on desktop, route codes with small labels (CDG Trip, PAR Save, ··· Vote, VRS Plan, OFF Offline, TIX Tickets, YOU Join). The vote stop is a ghost (an empty dashed slot) until the vote; then the winning neighborhood code (MON, MAR, LAT) prints solid on coral with the stamp animation. Below 1100px, show only the readable labels so visitors can scan the sections, with one exception: once the group picks, the winner's code prints beside "Vote" on phones too. The stop being read is lit in ink. There are no stop numerals.
- **Footer:** the tag's bottom edge: wordmark and signature line, a two- to four-column link grid, the appearance picker printed flat, and a barcode for joinstowaway.app.

### PRIORITY Stamp
The group's choice gets a coral label with an ink stroke, condensed bold at 0.12em, rotated -5deg. It stamps in (420ms, from 1.6x scale at -14deg) on the winning vote option and on the plan slot it fills.

### Perforation
The only divider between stops and sections: a 28px band with notches cut from both edges and a dashed tear line. Inside the sheet the notches are ringed in rule colour.

### Barcode
Drawn from its own text so each tag has a stable, different code. Ink bars, 34px to 44px tall, always decorative.

### Tag Head
The opening of every secondary page: h1 and intro, an optional action row, and a printed field list stating facts about the page (Groups / Free, Status / Not found, Updated / October 30, 2026). Then a perforation.

### Motion
The hero prints itself on the first load of the page: a 3px ink print head runs down the hero (1000ms with no delay, cubic-bezier(.42, .06, .3, 1), so the headline and both stubs are printed within the first half-second), and the print just behind it develops from a 4px half-tone to solid ink over about 8rem, the Print Density Rule played in time. The travelers then print one name at a time, and coral lands last, stamped onto Create a trip (520ms, a 1.045 press). Later visits to home in the same session show the tag already printed. Elsewhere, print-in is a left-to-right clip reveal (300ms to 620ms on cubic-bezier(.16, 1, .3, 1)), triggered once per stop as it scrolls into view. The stamp is the only other motion. Nothing loops. Reduced motion removes all animation and transition and shows the printed state.

## Do's and Don'ts

### Do:
- **Do** keep every public page inside the website frame so it hangs as one tag: eyelet header, stock sheet, perforated sections, footer edge.
- **Do** separate stops and sections with the Perforation, and divide within a section with 1px or 2px dashed rule lines.
- **Do** print state as density: solid for confirmed, the half-tone dot for tentative, a dashed ghost for empty.
- **Do** put a readable name beside every route code and barcode, and hide the code itself from assistive tech.
- **Do** introduce the homepage's demonstrations together as an example trip. Keep individual example labels on standalone previews; avoid repeating disclaimers below each section of the same trip.
- **Do** use short feature names and action labels. Let the trip demonstrate the details. Omit explanatory captions that repeat the heading, controls, or example; put necessary setup instructions in the FAQ.
- **Do** write factual status messages and specific changes. Avoid encouragement, metaphors, slogans, and reassurance beneath ordinary controls.
- **Do** use the Tag Head with printed fields to open a secondary page.
- **Do** keep targets at 44px or more (segmented options, chips, checkboxes through their row label)
  and the coral-over-ink focus ring on everything interactive.
- **Do** carry the luggage-tag palette, locally served fonts, flat ink borders and dashed rules into the app. Use Barlow for headings, body and controls, Barlow Condensed for small travel metadata, and Antonio for route codes.
- **Do** keep the app's primary actions coral and its selected controls ink. Preserve semantic warning, danger, success, and itinerary-category colors.
- **Do** pass place-category colours through `categoryTone()` (`src/features/places/categories.ts`) whenever they colour an icon or text on paper. Dark mode lifts them 50% toward ink (`--stowaway-category-lift`); map pins keep the raw tone under a white icon.
- **Do** keep overlays flat: dialogs, sheets, toasts and the add button carry no blurred shadow, and backdrops are the ground colour at 45%.

### Don't:
- **Don't** use coral outside the Coral Ledger: not for links, hovers, the current nav item, pressed chips or the lit strip stop.
- **Don't** use signal yellow for anything that is settled.
- **Don't** add blurred or offset drop shadows; depth is stock, stroke, holes and reverse print.
- **Don't** put small uppercase print alone above a heading as a section label; field print always pairs a label with its value.
- **Don't** number the stops; the routing strip identifies them by route code.
- **Don't** retype, recolour or rotate the Stowaway wordmark or mark; use the drawn lockup from `src/ui/Brand.tsx`.
- **Don't** use the public page's oversized display scale or decorative route codes for the app's everyday navigation. Trip names, dates, real confirmation codes and saved states provide the character there.

## App theme

The app now shares the luggage-tag direction at a practical working scale. `src/styles/fonts.css` supplies the local fonts to both surfaces. `themes.css` defines the matching light/dark paper, ink, coral and semantic roles; `app-theme.css` translates them into app components under `.app-world`.

**Shared header.** A screen's header prints its title first and the trip's name under it in muted Barlow (never a condensed label above the title). On phones the header carries at most two shell tools (QuickAdd where no floating add button exists, and Stowie); search lives on wider screens and the keyboard. Offline and sync trouble print in words across the header on phones ("Offline · Saved trip data still works", "Not synced · Tap to review"), and stay silent while everything is up to date.

**Print density in the app.** Tentative and idea plan rows print on the half-tone dot with lighter titles; confirmed rows print solid. Real confirmation codes print on plan rows as field print (CONFIRMATION, then the code in Barlow). Vote options show the group's votes as ticks under the score buttons: ink for others, coral for yours, an outline for anyone who hasn't voted, as on the website's sample vote.

**Group pick (the app's one authored moment).** The PRIORITY stamp appears in the app as "Group pick" (`src/features/polls/PickStamp.tsx`, `src/styles/group-pick.css`). When a vote closes in front of someone, the Decided card prints in, the winner's name takes the coral highlighter, and the stamp lands. "Add to the plan" carries the place and its stamp into the form (view transition), and saving flies them onto the new plan row (a FLIP, because the plan loads after it mounts). The row gives under the stamp and develops from half-tone to solid. Plan rows for places that won a vote keep the stamp. Reduced motion shows every state already printed. Nothing else in the app stamps.

Desktop trips sit inside a rounded sheet on ocean ink, with a dashed workspace rail and a clear current navigation item. Phones keep full-width content, a ruled header, and the existing bottom navigation. Weight follows use: lists of things to tap (row groups) keep the 2px ink outline, while section containers (`.ui-card`) print on a 1px tear rule so a stack of them reads as one page. Grouped records, itinerary entries and document stubs use dashed internal rules. Long settings-style screens group their cards under small labels by who they affect (the group, the trip, this phone) rather than stacking a box per setting. A record's own screen (a plan item) prints as one framed record whose parts (when, confirmation, where, who, tickets) are divided by dashed rules. Inputs retain regular-width 16px body text. Document cards show actual confirmation codes and download states. App theme changes preserve the public site's own composition and the application's navigation, storage and offline behavior.
