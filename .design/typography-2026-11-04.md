# Typography refinement — November 4, 2026

The user requested a professional typography system centered on hierarchy, spacing, readable
line lengths and disciplined weights. Kept the existing locally licensed faces and luggage-tag
identity. Earlier reports' requirements for condensed uppercase headings and controls are
superseded by this request.

## Implementation

- Barlow now carries page/section headings, controls, names, navigation, status text and amounts.
  Sentence case and normal tracking replace the previous condensed uppercase treatment.
- Barlow Condensed is reserved for small travel metadata; Antonio retains the route lettering.
  Actual confirmation references use readable Barlow rather than decorative route type.
- Added shared type roles for sizes, leading, tracking and prose measure. App titles, section
  titles, body text, actions and captions have distinct scales and weights. Normalized legacy
  550/650 requests to the supplied 500/600 faces and disabled synthesized font styles.
- Increased itinerary line height and row spacing. Bounded public prose, app descriptions and
  itinerary/place notes to 65ch. Structured rows and form controls retain their available width.
- Kept tabular numerals on times and amounts. Added preload hints for the two main Barlow faces.
- Updated DESIGN.md, brand guidance and component guidance to preserve these roles.
- Palette retained. In response to the user's color question: coral/ink is coherent but familiar;
  warmer vermilion is a candidate for a separate visual comparison, not an implemented change.

## Verification

- Production build, both TypeScript configs and whitespace check passed. No new dependencies.
- Initial browser suite: 27 cases passed, including 19 populated app screens in each of four
  light/dark and phone/desktop combinations, public/entry forms, pricing, keyboard use, contrast,
  reduced motion and 200% text scaling.
- Final build: 16 website/polish cases passed, including vote-to-plan feedback without lost focus
  or layout shift. There are 30 distinct browser cases across the two runs.
- Additional local visual checks covered nine routes at 320px in both themes and at 640px with
  200% text in both themes. Document and trip-content overflow checks passed, controls stayed at
  least 16px, and there were no page exceptions.
- Reschedule dialog and ticket review passed additional 320px, 390px dark, 1440px and 200% text
  checks. Inspected before/after phone itinerary, desktop overview, landing and dark money/dialog
  captures. Scratch captures/logs are in ignored `test-results-typography/`.
- React review: TSX edits only change presentation classes; existing semantics, labels, state,
  permissions and handlers are preserved. No data, backend or payment behavior changed.

Implemented locally. Physical iPhone/Safari and screen-reader checks were not performed; this
is not deployed. No new unit tests were needed for the presentation changes.
