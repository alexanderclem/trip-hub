# Travel artwork revision — October 30, 2026

The first hand-authored SVG set was rejected for its visual quality. The user selected **clean flat illustrations, closer to the original reference**, after being offered textured posters, flat illustrations, or photography. This revision supersedes the artwork assessment in `.design/trip-images-2026-10-30.md`; its photo/persistence implementation remains current.

## Visual direction and assets

Twelve new illustrations were generated with the built-in `image_gen` tool using the Image Generation skill. The selected coast became a common style reference for the other eleven scenes. Prompts specify muted blue-gray, seafoam, slate teal, deep ocean ink, sand, ivory and coral, with calm wide compositions, organic silhouettes and no text. Scene-specific architecture and foliage replace the earlier primitive geometry. The photographic and textured poster explorations were discarded after the user selected the flat direction.

The final collection is saved in `public/images/trip-covers/flat-v2/`: coast, mountains, city, countryside, lake, islands, desert, jungle, snow, oldtown, canyon and temples. Each scene has a 1600×640 JPEG and a 480px preview. The 24 files total 2,179,105 bytes. JPEG encoding/resizing uses macOS `sips`; generated PNG originals remain untouched at the source paths recorded in `prompts.json`.

`prompts.json` contains the exact final prompt set and source image paths. `gallery.html` assembles the assets; `../screenshots/travel-artwork-v2/collection.png` is a portable full-set preview including the palette.

## Online research

Reviewed [DrawKit's Landscape & Scenery collection](https://www.drawkit.com/illustrations/landscape-scenery-illustrations), [Serene Scenes](https://justgoscha.gumroad.com/l/serene-scenes-illustration-pack), and other landscape collections before choosing the generation workflow. No third-party stock illustrations were embedded in the app. The final art is the generated flat collection selected through the user's stated direction.

## Integration

`TripArtwork` now renders local image assets with the existing decorative image semantics and custom-image fallback. The picker uses the smaller previews. Banner views use responsive sources. The same persisted cover IDs, destination matching, custom uploads, profile cropping and sync data path remain in use. The PWA precache includes JPEGs so these local images can work offline; there is no image-host dependency.

## Verification

- Production build passed. The existing large map/PDF bundle notices remain.
- App and tooling typecheck passed.
- The twelve new illustrations decoded in the picker at runtime. The cover picker passed 320/390/768/1440px reflow and 200% root-text-size checks.
- The 12 existing journal tests and existing traveler profile browser test passed after the asset replacement. The focused image suite verifies cover rendering, destination matching, photo crop/save/removal, and offline use. Detailed outcome recorded below after completion.
- The first combined run exposed an obsolete assertion expecting zero image elements after removing a custom cover. It was updated to require the automatic temple illustration and zero custom data-URL images. The custom-image removal itself was working; this checks the replacement behavior explicitly.
- Visually reviewed the full twelve-scene contact sheet. Runtime screenshots are saved beside the collection preview after verification.
- Local changes only. No deployment or live multi-device sync was performed. Browser checks use Chromium; physical devices and screen readers were not tested.

Final verification outcome: 17 unique browser tests passed across the combined and focused runs: 12 journal tests, 1 traveler test, and 4 image tests. The offline check confirmed service-worker control, the revisioned precache entry, a fully offline page reload, and successful decoding of all twelve illustration previews. Workbox's cache entries include revision query parameters, so the direct cache readiness assertion uses `ignoreSearch: true`. Build, typecheck and `git diff --check` passed. No product changes followed these successful checks.
