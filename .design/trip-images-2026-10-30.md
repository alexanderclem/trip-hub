# Trip photos and destination postcards — October 30, 2026

Implemented in `Downloads/trip hub/stowaway-website`; the initially open DJ workspace did not contain the travel app. The pre-existing edit to `src/main.tsx` was preserved.

The story is: choose a destination or upload a photo in the existing trip/profile UI → resolve local artwork or crop/compress the image → save the trip/member through the IndexedDB repository and sync outbox → show the result across trip cards, overview, Settings and traveler avatars, including after reload.

## Result

- Twelve local SVG postcards share the reference's flat shapes and ocean, sage, sand and coral palette. Eight new scenes: lakes, islands, desert, jungle, snow, old town, canyons and temples. Four original scenes and the plain cover remain available.
- Automatic mode uses selected destination coordinates against a curated inspiration catalog, then recognizable landscape terms, then a city scene. With no destination it starts by the water. The first destination determines the automatic cover; additional destinations supply other suggested choices. Suggestions appear first and are labeled. These are illustrated travel themes, not exact depictions of each destination.
- Existing deliberate illustration/plain choices remain selected. Automatic mode follows destination changes. Custom photos have precedence until changed by the user.
- Custom covers and profile photos accept JPG, PNG and WebP up to 10 MB. Native keyboard-operable sliders adjust horizontal position, vertical position and zoom. Transparent input is flattened against warm white. Covers become 1200×480 JPEGs limited to 400,000 characters; profile photos become 256×256 JPEGs limited to the existing 200,000-character server constraint.
- Upload failures retain the previous photo. Cancel discards cover drafts. Remove/save clears custom bytes and restores automatic artwork; profile removal restores initials and resets the crop session. Images are stored with the existing offline rows and queued for sync. Original files remain unchanged and are retained only in memory during the current crop session.
- Saves read the latest local row to preserve unrelated settings/fields and guard repeated submission. File labels are separate from their format/size descriptions. The artwork grid adapts to available space and enlarged text.

## Verification

- `npm run build`: passed; existing map/PDF chunk-size notices remain.
- `npm run typecheck`: passed for app and tooling projects.
- `npm test -- --mode production`: 56 suites, 446 tests passed. New coverage includes curated destination matches, ordering/deduplication, automatic/manual/custom precedence, malformed settings, bounded local JPEG values, crop geometry and file validation.
- `BASE_URL=http://127.0.0.1:4185 npx playwright test tests/e2e/trip-images.spec.ts tests/e2e/travelers.spec.ts tests/e2e/journal.spec.ts --max-failures=1`: 16 passed in the final run (36.2 seconds).
- Browser tests verify actual saved JPEG pixel colors after keyboard crop/zoom; image persistence after reload; shared cover rendering in overview, trip cards and Settings; failed decoding retaining the previous draft; cancel/remove/save behavior; preservation of unrelated settings; outbox coalescing; profile save/removal; native radio navigation and Escape/focus restoration.
- Cover picker checked at 320, 390, 768 and 1440 CSS px, plus 200% root text size at 320px. Existing journal tests cover planning/preparing/traveling/empty reflow and reduced motion. File labels and modal geometry found during the first pass were corrected before the final successful run.
- Visually reviewed the twelve-scene contact sheet, phone picker, custom cover and traveler profile. Artifacts are in `screenshots/trip-images-2026-10-30/`.
- React review: stable mapped keys, hooks at component top level, shared image conversion, upload cancellation on unmount, no added dependencies, native controls and existing dialog primitive retained.
- `git diff --check`: passed.

## Boundaries

Image tests use local fixtures and block external requests. IndexedDB and sync-queue boundaries were exercised; the existing Supabase remote adapter and schema constraints were inspected. Live multi-device sync and deployment were not performed. Chromium mobile emulation was used; physical iOS, other engines and screen readers were not tested. The text enlargement check is not browser-chrome zoom.
