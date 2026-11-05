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
    fontFamily: "Antonio, 'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "min(12.6cqi, 10.25rem)"
    fontWeight: 700
    lineHeight: 0.86
    letterSpacing: "-0.005em"
  display-close:
    fontFamily: "Antonio, 'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "clamp(3rem, 8vw, 6.5rem)"
    fontWeight: 700
    lineHeight: 0.92
  code:
    fontFamily: "Antonio, 'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(2.375rem, 5vw, 4.25rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline-page:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(2.125rem, 4.4vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.015em"
  title:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "clamp(2.125rem, 4.2vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  fine:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
  control:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    letterSpacing: "0.04em"
  label:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.12em"
rounded:
  stub: "0px"
  stamp: "4px"
  field: "6px"
  control: "8px"
  card: "10px"
  sheet: "22px"
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

The density is a printed document's: hard 2px ink strokes, dashed rules, uppercase condensed field print, and generous blocks of air between stops. Colour is almost entirely ink on stock. Coral is the one loud colour and belongs to the group's choice and the primary action; signal yellow marks what is still open. State is shown as print density (solid, half-toned, ghost), never as a new colour. Dark mode is the same tag printed in reverse.

**Scope.** This world governs the public website only: the landing page, How it works, Pricing, For organizers, Help, Not found and the legal pages, all inside the shared website frame and its world stylesheet (`src/features/website/tag.css`). The signed-in app keeps its own calm-workspace system, defined in `src/styles/tokens.css` and `src/styles/themes.css` and described in `docs/UI_COMPONENTS.md` and the visual identity section of `docs/BRAND.md`. Nothing here applies to the app, and the app's tokens are not part of this file.

**Key Characteristics:**
- One sheet of tag stock on an ink ground, with an eyelet at the top and 22px sheet corners top and bottom.
- Perforated tear lines are the section dividers; dashed rules divide inside a section.
- Antonio route codes (GUA, ANT, PAN, SMR) are the display voice; Barlow carries headlines and body; Barlow Condensed prints every label and control.
- Coral appears only on the group's choice and the primary action.
- Print density shows state: confirmed solid, tentative half-toned, empty as a dashed ghost tag.
- Motion prints in once and stamps; nothing loops.

## Colors

Ocean ink on cool thermal stock, with one coral and one signal yellow kept to precise jobs.

### Primary
- **Priority Coral** (coral): the primary action (the Create a trip tear stub and the website primary button), the PRIORITY stamp, the vote winner's ring and the highlighter under the winner's name, your own vote tick, the picked lake code on the routing strip, text selection and the focus outline. Text on coral is always ink (on-coral).

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

**Display Font:** Antonio (with Barlow Condensed, Arial Narrow)
**Body Font:** Barlow (with system-ui)
**Label/Mono Font:** Barlow Condensed (with Arial Narrow)

**Character:** Antonio's tall, tight caps print route codes like a baggage system; Barlow, a plain grotesque from the same signage family, keeps headlines and sentences readable; Barlow Condensed is the tag's field print for every label, control and section title. All three are self-hosted WOFF2 under the OFL (provenance in `docs/DESIGN_ASSETS.md`).

### Hierarchy
- **Display** (Antonio 700, sized to the container at min(12.6cqi, 10.25rem), line-height 0.86): the hero route GUA → ANT → PAN, printed on one line. The closing line uses display-close (clamp 3rem to 6.5rem, uppercase).
- **Code** (Antonio 700, 2.25rem): three-letter codes on vote options, mini tags (2rem), day routes (clamp 2.25rem to 3.25rem), the offline stub (clamp 2.25rem to 3rem) and the routing strip (1.375rem on phones, 1.875rem on the rail).
- **Headline** (Barlow 700, clamp 2.375rem to 4.25rem, line-height 1.02, -0.02em): the landing h1 only. Subpage h1s use headline-page (clamp 2.125rem to 3.75rem, max 20ch).
- **Title** (Barlow Condensed 700, clamp 2.125rem to 3.5rem, line-height 1, uppercase): stop and section h2s. Subpage section h2s step down to clamp 2rem to 3rem; card titles in condensed uppercase run 1.5rem to 2rem.
- **Body** (Barlow 400, 1.0625rem, line-height 1.6): sentences. Intros max 40ch at up to 1.25rem; ledes max 46ch in faded print; FAQ answers max 62ch.
- **Label** (Barlow Condensed 600, 0.8125rem, 0.12em, uppercase): field print, data labels (dt), strip labels, the hero's print row. Controls use the control style (Barlow Condensed 700, 1.125rem to 1.25rem, 0.04em, uppercase).
- **Fine** (Barlow 400, 0.8125rem, faded print): the example disclosures and small print under every demonstration.

### Named Rules
**The Code Is Print Rule.** Route codes are decoration of a fact already stated in words. Every code is hidden from assistive tech and the readable name sits beside it (or in screen-reader text). Barcodes are the same: decorative, always next to the text they encode.

**The Field, Not Kicker Rule.** Small uppercase print is a field on the tag: a label with its value (Travelers · 8, Paid by / Maya, Updated / October 30, 2026). It never sits alone above a heading as a section label.

## Layout

The tag sheet is centred with a maximum width of 1320px and a minimum 8px of ground showing on each side; content inside uses a fluid shell padding (clamp 1.25rem to 4rem). Stops are separated by perforations (28px tall) and have fluid vertical padding (clamp 2.5rem to 5rem).

On the landing page one routing axis pins every stop. From 1100px it is a 12rem rail down the left edge, sticky, with an ink rule along its left side; below 1100px it becomes a sticky route bar under the header that scrolls sideways. The hero is one tag face: a print row, the route at display scale, then a two-column grid from 960px (copy and tear stubs on the left, the traveler list and barcode on the right). Stops are a 5:7 head and body split from 960px, or full width with a 52rem head for wide stops (vote, plan, join).

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
Tactile print: uppercase condensed labels, 2px ink strokes, nothing glossy.
- **Tear stub (signature primary):** the landing page's Create a trip and Join trip are tear-off stubs (88px tall, 76px on phones, 64px compact). Primary is coral with ink text; secondary is an ink outline with a punched hole rim. Each carries a large label (clamp 1.625rem to 2.125rem) and one line of field print. Hover lifts 2px with an ink tint (primary darkens coral by 14% ink); press drops 1px; transitions 160ms on the world easing.
- **Website primary:** subpage primary actions are coral buttons, 52px, 8px corners, 1.25rem condensed uppercase; hover darkens and lifts 1px.
- **Ink and quiet buttons:** in-demo actions (Save another place) are 48px with an ink stroke, quiet by default and filled ink on hover. Disabled drops to 55% opacity.
- **Text link:** condensed uppercase at 1.1875rem with a 2px ink underline that thickens to 3px on hover.
- **Focus:** every interactive element shows a 3px coral outline offset 3px.

### Chips (choice buttons)
- **Style:** vote scores (No way, Maybe, Keen, Must-do) and the Join name picker: 44px (52px for names), 2px ink stroke, 8px corners, condensed uppercase.
- **State:** hover takes an 8% ink tint; pressed (aria-pressed) fills ink with stock text. Pressed is never coral.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** card white on stock, 2px ink stroke.
- **Shadow Strategy:** flat; only the winner ring (see Elevation & Depth).
- **Internal Padding:** 1rem to 1.25rem; lists inside run under a 2px ink rule with 1px dashed rule separators and 52px rows.
- **Variants:** vote option (code, town, points, tick bar of the group's votes with yours in coral), day card (route codes, Day n title, time / what / state rows), mini tag (string hole, code, place, "Saved by"), stub card (dashed tear edge, barcode, cost fields in tabular condensed figures).

### Inputs / Fields
- **Style:** 2px ink stroke, 8px corners, card-white fill, ink text (fee calculator and the early-access form). A checked choice fills ink.
- **Focus:** the world's 3px coral outline.

### Navigation
- **Header:** the drawn wordmark at left, condensed uppercase links (1.0625rem, 0.04em) at right from 1100px. Hover underlines 2px; the current page underlines 3px in ink. Open app is boxed with a 2px ink stroke. Below 1100px a 44px boxed menu button opens a full-width list of 52px rows on dashed rules; Escape closes it and returns focus.
- **Routing strip:** route codes with small labels (GUA Trip, ANT Save, ··· Vote, PAN Plan, OFF Offline, TIX Tickets, YOU Join). The lake code is a ghost (outline only) until the vote; then it prints solid on coral with the stamp animation. The stop being read is lit in ink. There are no stop numerals.
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
Print-in is a left-to-right clip reveal (300ms to 620ms on cubic-bezier(.16, 1, .3, 1)), staggered for the route codes and travelers and triggered once per stop as it scrolls into view. The stamp is the only other motion. Nothing loops. Reduced motion removes all animation and transition and shows the printed state.

## Do's and Don'ts

### Do:
- **Do** keep every public page inside the website frame so it hangs as one tag: eyelet header, stock sheet, perforated sections, footer edge.
- **Do** separate stops and sections with the Perforation, and divide within a section with 1px or 2px dashed rule lines.
- **Do** print state as density: solid for confirmed, the half-tone dot for tentative, a dashed ghost for empty.
- **Do** put a readable name beside every route code and barcode, and hide the code itself from assistive tech.
- **Do** label every demonstration honestly in fine print (example names, example votes, example amounts, real places).
- **Do** use the Tag Head with printed fields to open a secondary page.
- **Do** keep targets at 44px or more and the 3px coral focus outline on everything interactive.

### Don't:
- **Don't** use coral outside the Coral Ledger: not for links, hovers, the current nav item, pressed chips or the lit strip stop.
- **Don't** use signal yellow for anything that is settled.
- **Don't** add blurred or offset drop shadows; depth is stock, stroke, holes and reverse print.
- **Don't** put small uppercase print alone above a heading as a section label; field print always pairs a label with its value.
- **Don't** number the stops; the routing strip identifies them by route code.
- **Don't** retype, recolour or rotate the Stowaway wordmark or mark; use the drawn lockup from `src/ui/Brand.tsx`.
- **Don't** apply this world to the signed-in app, or the app's tokens to the public site.
