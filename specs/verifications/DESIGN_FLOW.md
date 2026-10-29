---
type: verification
context: User-approved Stowaway flow, messaging, and design update
---

# Design and flow verification

## Delivered

- Shorter landing page with concrete copy and an interactive, local-only sample trip in the hero.
- Direct create/join entry, optional preferences, and explicit Home Screen installation.
- Two-field trip creation with optional destination, dates, time zone, and currencies.
- Later edits to trip name, dates, and time zone in Settings. Base currency stays unchanged.
- Compact agenda by default. Timeline, overlap warnings, stays, all-day items, and ticket shortcuts remain available.
- Home prioritizes decisions, departure preparation, or the next event using destination-calendar dates.
- Offline status remains neutral. Existing synchronization and error handling remain unchanged.

## Checks

- `npm run typecheck`: passed.
- `npm test`: 51 files, 412 tests passed.
- `npm run build`: passed. Vite reports the existing large-chunk advisory.
- Focused Playwright run: 41 tests passed across website, first-run, install, discovery, and design-flow specs.
- `git diff --check`: passed.
- Inspected mobile and desktop screenshots of the landing page, app entry, creation, agenda, and Home phases.
- Browser coverage includes 320px reflow, enlarged text, reduced motion, keyboard navigation, installation recovery, offline agenda switching, and offline settings saves.
- Live-query updates preserve the settings draft during editing.

## Self-review

- Correctness: existing itinerary layout supplies day membership and conflicts in both views.
- Security: no new dependencies, secrets, backend endpoints, access policies, or migrations. React renders user text. Writes use the existing save/outbox contract.
- Performance: sample interactions stay local. Home refreshes calendar priorities once per minute and on visibility changes.
- Clarity: updated design and onboarding documentation. Removed the unused landing examples and obsolete styles.
- Scope: stable navigation and existing authentication remain intact.

## Limits

Browser tests use disposable local fixtures or stubbed service boundaries. No live test trips were created or modified.
Live-backend onboarding, itinerary, and ticket specs were updated for intentional UI changes but were not run against Supabase.
Real-iPhone airplane-mode and push checks still require a physical device.
These results describe local verification before the production release. They do not verify the deployed website.
