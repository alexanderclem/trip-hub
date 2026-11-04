# Stowaway travel experience — November 4, 2026

Implementation branch: `codex/travel-experience`, based on the main checkout at `faef6ae`. Work is isolated in `../stowaway-premium`; the existing checkouts and their untracked documents were preserved.

## Direction

A practical, personal travel companion. Use the trip's destination, actual itinerary, saved ideas, and people to establish character. Keep the existing Stowaway identity, local illustrations, custom trip photos, semantic colors, and offline architecture. Add no dependencies.

The user's requested reference was Tripsy. Reviewed its [official activity screenshots](https://tripsy.app/), [itinerary preferences and compact/large examples](https://tripsy.help/article/59-itinerary-preferences), and [overview structure](https://tripsy.help/article/100-trip-overview). Applied category markers, compact activity rows, restrained controls, and an actual itinerary preview. Reference screenshots are research material only; no Tripsy artwork, branding, or screenshots ship in the application.

## Changes

- **Trip overview:** stronger type hierarchy; relevant destination artwork; a compact group byline; one emphasized next decision; quiet planning links instead of feature-count tiles; a preview of the personal itinerary; and saved places with notes and attribution. Existing preparing, traveling, completed, and first-arrival states remain.
- **Itinerary:** compact day strip; category markers and aligned times; morning/afternoon/evening grouping; quieter statuses and actual authorship; notes/holiday tools after the plan; and suggestions after the scheduled activities. Preserved overlaps, stays, all-day items, ticket shortcuts, timezone controls, alternate timeline, and keyboard day navigation.
- **Place → decision → plan:** a recognizable place identity, actual poll outcomes, named people still voting, and links to real itinerary entries. The progress display never infers a booking or a group choice from a place's status alone.
- **Starting a vote:** replace the browser prompt with a named native dialog. Retain input on failure, guard duplicate submissions, and commit a new poll and its first place option in one local transaction. The original notes follow the place into the vote. Existing votes remain directly accessible.
- **Scheduling a saved place:** preserve the place, author, notes, and inferred activity type. Date/time come before the prefilled fields, which remain editable in a disclosure. Unbooked suggestions start tentative. On success, return to the chosen day and announce the local save and sync boundary. A stable draft ID prevents retrying from producing another item.
- **Navigation:** replace the header-obscuring route-loading notice with a slim line and accessible loading status. Contain the decorative bottom-tab marker in its own clipped track; resize measurements reposition immediately while selection changes retain their motion. This fixes a confirmed transient horizontal overflow during phone/tablet resizing without clipping actual links or focus rings.
- **Destination fallback:** name-only selections such as Lisbon select a relevant existing illustration. Coordinates still disambiguate names, and manual/custom/plain cover choices remain authoritative.

## Verification

- `npm run typecheck`: passed; production `npm run build`: passed, including public pre-rendering and PWA generation. Existing large map/PDF chunk advisories remain.
- `npm test -- --reporter=dot`: **84 files / 608 tests passed**. Added transaction/rollback tests and name-only destination coverage.
- Browser regressions: **33 distinct cases passed** across `design-flow.spec.ts`, `journal.spec.ts`, and `polish.spec.ts`, with final affected-suite reruns. Updated obsolete notification/shortcut expectations and made the journal fixture wait for actual database initialization before seeding.
- CLI browser walkthrough using disposable local data: simulate a full first-option storage failure; verify no empty poll survives; retry; verify exactly one poll and place option with notes; record enough synthetic member votes for quorum; close voting; schedule the chosen place; verify one saved item in chronological position; reload; verify the original author, notes, outcome, and itinerary links persist. **Passed with no page errors.**
- Final visual matrix: **40 checks passed** across overview, itinerary, place, and scheduling screens at 320/390/768/1440px, light/dark themes, 200% text, and reduced motion. No page errors or horizontal overflow. Inspected final desktop overview, phone itinerary, phone scheduling, and dark itinerary captures. The last eight affected navigation/resize/keyboard regression cases also passed after the tab-marker fix.
- React review: hooks stay unconditional; mutations occur in guarded event handlers; list keys use record IDs; shared accessible dialog/focus handling and reduced-motion preferences remain; status messages distinguish local storage from syncing.

All browser fixtures use synthetic trip/member data and blocked external requests. No live trip records, messages, payment operations, deployment, or schema migration were created. Chromium desktop emulation does not certify physical iPhone/Safari behavior or screen-reader operation.

## Review artifacts

- [Desktop overview](screenshots/travel-experience/overview-desktop.png)
- [Phone overview](screenshots/travel-experience/overview-phone.png)
- [Phone itinerary](screenshots/travel-experience/plan-phone.png) · [dark mode](screenshots/travel-experience/plan-dark-phone.png)
- [Place and planning progress](screenshots/travel-experience/place-phone.png)
- [Scheduling a saved place](screenshots/travel-experience/schedule-phone.png)

Local preview: `http://127.0.0.1:4187/app`. Screenshots use a synthetic Lisbon trip; the preview opens with the browser's own local trips.
