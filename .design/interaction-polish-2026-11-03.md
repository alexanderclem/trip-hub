# Stowaway interaction polish — 3 November 2026

Implemented from the confirmed findings in [the research review](review-report.md). This is a targeted implementation and verification record, not a whole-product accessibility or performance certification.

## Changes delivered

| Finding | Result |
| --- | --- |
| ST-01: phone overview priority | Returning travelers get a compact destination cover and title. The next useful action comes before planning shortcuts. New arrivals retain the larger welcome composition. |
| ST-02: poll task priority | Scoring and honest saved progress come first. One header control opens sharing in a named native modal, retaining the invite access warning. |
| ST-03: ambiguous add controls | Phones use the contextual action on the current planning, places, expenses, tickets, tasks, and packing screen. Creation/edit forms suppress global Add. |
| ST-04/ST-05: misleading/interrupted amounts | Financial amounts render their exact value immediately. Later real changes receive brief opacity/position feedback, with no numeric interpolation or per-frame React updates. |
| ST-06: abrupt overlay dismissal | Native dialogs remain modal during a short exit. Reopening cancels dismissal, reduced motion closes immediately, and focus returns to the opener or new reading context. |
| ST-07: inconsistent motion | Shared enter/change/exit/fade roles coordinate CSS and Motion. Selections and meaningful text update immediately. |

Additional iterations:

- Plan days use roving tab focus, Arrow keys, Home/End, an immediate selected state, and a short moving underline. Right-to-left direction reverses the Arrow keys. URL state and unrelated query parameters are retained.
- Day/view changes animate the existing content wrapper rather than remounting the form. Agenda insertion/removal uses position layout animation, with projection features loaded only on that surface. Normal day loads do not stagger the itinerary.
- Voting gives immediate visual selection, retains keyboard focus during saving, blocks duplicate saves, and restores the prior real choice after failure. Completion has a static Stowie pose with one finite acknowledgment.
- Day-note drafts survive switching days. Failed saves retain text and provide a dated retry action. A slower save never deletes a newer draft.
- A ticket can retry a failed open. “Saved on this phone” appears only after the file is available locally. File/object-URL state is tied to its attachment, and URLs are revoked on cleanup.
- Route focus follows the final heading when an asynchronous form replaces a temporary header. User interaction cancels pending focus and scroll restoration.
- Selection indicators measure when their controls actually mount after local data loads, so their first placement is present before the first interaction.

## Verification

- Production build passed. Existing map/PDF chunk-size advisories remain; no new dependency was installed.
- Typecheck passed for app and Node configurations.
- 596 unit tests passed across 82 files using supported Node 22 with UTC and production mode.
- Design source scan passed across 304 files. This is a regex scan; rendered contrast and element checks are separate.
- New browser regressions exercise interrupted dialog dismissal and reopening, reduced-motion changes, Quick Add route focus, rapid day switching and per-day notes, failed-note recovery, exact balances updated through another tab’s real save flow, and missing-ticket recovery.
- Long trip titles were checked at 320 CSS px, 640px with 200% root text size, 768px, and 1440px in light and dark mode. Main content did not overflow. Right-to-left day navigation retained selection and focus. Text enlargement is not a physical-browser zoom test.
- Existing offline sharing, date votes, deadline resolution, comments, preparation, local save/outbox behavior, navigation, and appearance checks are included in the final browser run.
- Older voting fixtures were updated to use a membership after the app's documented alpha reset. Activity assertions now use the current traveler links and scope dates to the main content.
- Screen captures cover 19 trip screens at 390px and 1440px in light/dark appearance. These checks assert document reflow and no page exceptions; captures are evidence for visual inspection, not a usability score.

The broad regression run passed all **56 browser tests** in 6.3 minutes. After the final indicator and attachment refinements, all **31 affected browser tests** passed again against the final build in 6.3 minutes. These are repeat checks, not 87 distinct tests.

Reproduction commands, from the project root:

```sh
npm run typecheck
npm run build
npm run lint:design
TZ=UTC npx --yes --package=node@22 node node_modules/vitest/vitest.mjs run --mode production --maxWorkers=2
BASE_URL=http://127.0.0.1:4193 npx playwright test tests/e2e/journal.spec.ts tests/e2e/polish.spec.ts tests/e2e/votes-share-comments.spec.ts
```

Browser checks require the production preview running at that address. The broader run also includes `appearance.spec.ts`, `design-flow.spec.ts`, `guest-evaluation.spec.ts`, and `screens.spec.ts`; the screen suite requires `SHOTS_DIR`.

Twelve representative images are retained in `screenshots/interaction-polish-final-2026-11-03/`, including the [phone overview](screenshots/interaction-polish-final-2026-11-03/planning-390.png), [phone voting](screenshots/interaction-polish-final-2026-11-03/light-vote-poll-390.png), [phone plan](screenshots/interaction-polish-final-2026-11-03/light-plan-390.png), and [dark money view](screenshots/interaction-polish-final-2026-11-03/dark-money-390.png). The latest phone/light and desktop/dark Plan captures were regenerated after the indicator fix, with a first-placement assertion. Full and intermediate capture sets are archived at `/tmp/stowaway-polish-captures-2026-11-03-hqku9bc1/` to avoid adding dozens of megabytes of redundant images to the project.

## Review limits

Browser checks use local production assets in headless Chromium with local IndexedDB fixtures. No real trip was modified. Physical iPhone keyboard/pinch gestures, Safari, screen-reader sessions, live multi-device server synchronization, field Core Web Vitals, and traveler task studies were not run. The remaining large map/PDF bundles predate this pass.

The inspected tasks have a concrete quality bar: readable immediately, one clear next action, stable keyboard context, accurate save/download feedback, recovery after failure, and motion that can be interrupted or disabled. A subjective “10/10” is not established by passing automated checks alone.
