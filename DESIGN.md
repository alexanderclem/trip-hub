# Stowaway design system

Direction: **Good company. Great trips.** A travel journal with the confidence of a
printed adventure poster. The public website inspires a group to start; the app
makes the next planning action clear.

This October 22, 2026 redesign supersedes the earlier locked homepage composition,
font restrictions, radius values, and motion guidance. The product identity,
suitcase artwork, local data, share URLs, and offline behavior remain compatible.

## Reference and interpretation

Reference: https://github.com/Fullstack-Empire/GSAP-Awwwards-Website

Studied `HeroSection.jsx`, `MessageSection.jsx`, `ClipPathTitle.jsx`, and the
reference stylesheet at commit `8a76a36`. Adapted its oversized condensed type,
rotated color bands, clip-path reveal, and alternating full-width sections to
Stowaway's travel category. No reference product imagery, proprietary font,
marketing copy, or application code is included.

Stowaway already uses `motion/react`; the reveal choreography uses that runtime.
No second animation engine, scroll hijacking, or animation dependency was added.
The itinerary itself stays stationary so interaction and live motion-preference
changes cannot move its click targets.

## Foundation

`src/styles/tokens.css` owns shared semantic values.

| Role | Value | Usage |
| --- | --- | --- |
| Canvas | `#f8f5ee` | Cream paper, public and application backgrounds |
| Surface | `#fffdf8` | Forms, itinerary, record groups |
| Ink | `#183e4b` | Headings, primary public actions, desktop workspace sidebar |
| Action | `#295361` | App buttons, links, selected controls |
| Muted | `#586467` | Supporting text on cream |
| Mist | `#d6e4e5` | Capability band, offline section, selected mobile tab |
| Coral | `#ef9477` | Poster stamps, closing section, desktop current tab |
| Border | `#dcded5` | Quiet grouping and separation |
| Control border | `#687e83` | Controls requiring a stronger visible boundary |

Coral pairs with ocean ink, never white text. Status colors retain their existing
meaning and labels. Key controls are at least 44px high; shared fields are 46px.
Shared control radius is 6px; surface radius is 10px. The photo and welcome poster
use a single asymmetric corner as a recognizable travel-postcard detail.

## Typography

- **Antonio**, locally hosted variable font: public poster headings and app welcome.
- **Georgia**, system serif: editorial sections, trip names, screen titles.
- **System sans-serif**: navigation, controls, forms, and trip details.

All fonts work without a third-party font request. Antonio is bundled under the
SIL Open Font License and included in the offline precache. Long headings wrap;
forms remain at 16px or larger on phones.

## Composition and behavior

- `/`: oversized left-aligned introduction beside a destination photograph;
  capabilities; interactive map/itinerary example; full-width typographic
  statement; three planning steps with labeled examples; offline preparation;
  native FAQ; closing invitation. Desktop content width is 1320px.
- `/app`: split welcome poster and create/join actions on desktop. On a phone the
  poster becomes a compact introduction and gives priority to trip entry.
- Returning workspace: editorial trip titles and bordered trip cards; existing
  create, invite, restore, and planning entry points.
- Trip workspace: ocean-ink sidebar on desktop, five labeled bottom tabs on mobile.
  The active destination has a filled treatment as well as a label. Home, Plan,
  Map, Vote, and More retain their existing routes.
- Forms, lists, and screens share the same semantic tokens and primitives.
  Existing validation, pending states, focus, error recovery, and destructive
  confirmations remain in the product flows.

## Motion and accessibility

The travel stamp reveals across its width. Noninteractive editorial content
settles into place once on entering view. Buttons retain brief press feedback;
the existing itinerary day transition explains the selected state.

The operating interface uses the existing route and state feedback, without
adding scroll animation to records or forms. Reduced-motion preferences disable
new motion, including changes to that preference during the session. Headline,
actions, and content never depend on completing an entrance animation.

Native navigation links, native FAQ disclosures, persistent form labels, visible
focus indicators, and the public/workspace skip links are retained. Site layout
must reflow at 320px and with enlarged text. Downloading trip essentials while
online remains a prerequisite for offline use; the website explains map packs
separately from saved plans and tickets.

## Assets

The brand masters remain in `public/brand`. Use `Brand` or the supplied wordmark;
do not retype or redraw the logo. See `docs/DESIGN_ASSETS.md` for the new photo,
font license, and reference provenance.

Verification for this release is recorded in `.design/redesign-2026-10-22.md`.
