# Cohesive brand system — October 29, 2026

## Direction and scope

The public website and app welcome now share a travel-journal direction: Georgia
headings, system sans-serif details, cream canvas, ocean ink, mist surfaces, and
restrained coral. The suitcase logo and existing local artwork remain intact.

The primary message is **Your group trip. All in one place.** Copy names the actual
jobs: save places, vote, build an itinerary, organize tickets, and track shared
expenses. The separate manifesto and competing slogans were removed. The process
explanations sit directly above their illustrative invite, vote, and ticket/cost
artifacts. Offline instructions explicitly distinguish saved data from map packs.

`DESIGN.md` records the implementation contract. `docs/BRAND.md` defines the message
hierarchy, voice, truthful claims, and logo use. `src/styles/tokens.css` owns shared
values; unused portable aliases were removed. `.design/brand-system.html` is the
visual reference. Website metadata, install description, and SVG/PNG social
previews use the same positioning.

The earlier audit findings about specific product evidence, literal action
labels, stable itinerary interaction, offline prerequisites, focus, contrast, and
reflow remain applicable. Older poster-type and rotated-color-band directions
are superseded by this requested system. Existing trip data, routes, validation,
account behavior, and sync logic are preserved.

## Executed verification

- `npm run typecheck`: passed, including the final welcome copy change.
- `npm test`: 50 suites / 407 tests passed.
- `npm run build`: passed, including the final welcome copy change. The existing
  large map/PDF-related chunk warnings remain; no dependency was added.
- `BASE_URL=http://127.0.0.1:4181 SHOTS_DIR=/tmp/stowaway-brand-qa npx playwright test tests/e2e/website.spec.ts tests/e2e/polish.spec.ts tests/e2e/account.spec.ts tests/e2e/first-run.spec.ts`:
  27 passed. Covers website/app/create navigation; invite validation and focus;
  account entry; stubbed first-run flows; stable day selection and announcements;
  keyboard skip/disclosures; rendered text and control-border contrast; reduced
  motion; offline reload, ticket, and map fixtures; and local error recovery.
- The website suite was rerun after the final welcome-heading refinement: 11 passed.
- Website reflow: 320, 375, 390, 414, 768, 1280, and 1920 CSS pixels; tested without
  relying on root overflow clipping. The introduction, main action, and photo fit
  the existing 1280×800 laptop check.
- Enlarged text: the existing 200% root-font test passed, as did the narrow preview
  with long content and live reduced-motion changes. A separate 1280px / 200% CSS
  zoom screenshot had no document overflow. CSS zoom is not browser chrome zoom.
- Additional production-preview screenshots: homepage at 320/390/768/1440, app
  welcome at 390/1440, brand guide at 1280. No page exceptions or document overflow
  were observed. The local brand guide had no broken images.
- Visually reviewed desktop/mobile homepage, laptop fold, welcome, brand guide,
  and regenerated 1200×630 social preview. Final welcome copy was shortened to
  the same two-part promise as the homepage and its mobile line breaks retained.
- React review: no new data-fetching/effect paths, no nested component definitions,
  stable mapped keys, native controls, and existing lazy app routes retained.
- `git diff --check`: passed.

Selected screenshots are retained in `screenshots/brand-2026-10-29/`. Broader QA
screenshots are in `/tmp/stowaway-brand-qa/` for this session.

## Delivery and limits

Changes are local and have not been committed, pushed, or deployed. The development
preview is `http://127.0.0.1:4180/`. The separate production-preview server was
used for the browser tests. Tests use local/stubbed fixtures and do not create
real traveler trips.

Browser coverage is Chromium with desktop/mobile emulation. Screen-reader use,
other browser engines, physical-device installation, and live multi-device sync
were not exercised. This is a scoped design and messaging update, not an
accessibility certification or backend change.
