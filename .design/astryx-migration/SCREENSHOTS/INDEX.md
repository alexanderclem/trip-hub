# Local visual evidence

Before source: a5f9be4. Both sets reuse the same synthetic Paris fixture, 2027-02-15 planning clock, March 16–20 trip, eight fictional travelers, actual local PNG ticket and a deliberately missing ticket. Lifecycle variants select their own deterministic clock in pro-redesign-baseline.spec.ts. Screen sizes are CSS pixels, not a physical device.

Captures are ignored local artifacts to avoid committing a binary gallery. Regenerate with SHOTS_DIR and the command in IMPLEMENTATION_LOG. Older tracked evidence remains at `.design/pro-redesign/screenshots`.

| Comparison | Before | After |
| --- | --- | --- |
| Home, 390 light | [before](../../../output/astryx-before/adapt-home-390-light.png) | [after](../../../output/astryx-after/adapt-home-390-light.png) |
| Home, 390 dark | [before](../../../output/astryx-before/adapt-home-390-dark.png) | [after](../../../output/astryx-after/adapt-home-390-dark.png) |
| Home, 320 light | [before](../../../output/astryx-before/adapt-home-320-light.png) | [after](../../../output/astryx-after/adapt-home-320-light.png) |
| Home, desktop | [before](../../../output/astryx-before/home-planning-1440.png) | [after](../../../output/astryx-after/home-planning-1440.png) |
| Money, 390 | [before](../../../output/astryx-before/money-390.png) | [after](../../../output/astryx-after/money-390.png) |
| Roster link | [missing route](../../../output/astryx-before/group-roster-destination-390.png) | [real roster](../../../output/astryx-after/group-roster-destination-390.png) |
| Join welcome | [before](../../../output/astryx-before/paris-join-welcome-390.png) | [after](../../../output/astryx-after/paris-join-welcome-390.png) |

Additional migration artifacts: `astryx-create-{320,390,768,1440}-{light,dark}.png`, `astryx-segmented-*`, `astryx-confirm-*-{reduce,no-preference}.png`, `astryx-viewer-traveler-390.png`, `astryx-preparation-anchor-390.png`, `astryx-money-recorded-390.png`, `astryx-public-example-390.png`, and `astryx-*-200-percent-text.png` under output/astryx-after. `contrast-regression.json` records measured text pairs. Normal-motion dialog captures allow animations rather than fast-forwarding them.

The image inspection record is limited to images actually opened during the session. Generated files alone do not establish a visual pass; final reviewed captures are enumerated in the handoff.

Actually inspected: before Home at 390 light/dark; after contact sheets for Home, Money, create validation and segmented settings at all four widths in both themes; regenerated roster contact sheet at all four widths/both themes; individual create-and-copy invite, invite name selection, join welcome, manual winner-to-plan handoff, recorded-payment group details, per-phone preparation anchor, 390 dark native confirmation in both motion settings, the expanded public example, 200% Money after the heading correction, and the final hosted viewer's read-only expense summary (`astryx-viewer-expense-390.png`). Public preference/planning controls additionally run through a 16-case width/theme/motion matrix. Contact sheets remain local `contact-*.png/html` artifacts.
