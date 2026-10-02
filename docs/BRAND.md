# Stowaway

Domain: `joinstowaway.app` · Tagline: **The whole trip, tucked away.**

Stowaway is a shared, offline-first trip planner. The voice is friendly, practical,
and lightly adventurous. Keep action labels literal: Create a trip, Join trip, Open trip.

The mark is a luggage tag containing an S-shaped route, with a coral destination dot.
Use `public/brand/stowaway-mark.svg` as the master and `src/ui/Brand.tsx` for the
interface lockup. `public/brand/stowaway-wordmark.svg` is the standalone full logo.
The travel illustration is `public/brand/packed-for-anywhere.svg`.

Palette: ocean ink `#183e4b`, action blue `#295361`, cream `#f8f5ee`, mist
`#d6e4e5`, coral `#ef9477`. Coral is decorative, not a small-text color on cream.
Georgia gives the wordmark and homepage heading a travel-journal character; keep
the system sans-serif for forms, navigation, and trip details. No external fonts.

Run `node scripts/build-brand-assets.mjs` to regenerate the favicon, PNG install
icons, standalone wordmark, and 1200×630 social preview using existing Playwright.
The app icon keeps the tag inside the maskable safe area.

The rebrand preserves `trip-hub` database, local-storage, infrastructure, and repository
identifiers for compatibility. Share links continue to use the current origin.
Domain routing and deployment are separate from these source changes. The social
preview URL assumes this build will be served at `https://joinstowaway.app`.
Browser storage is origin-specific: trips saved on the old domain do not automatically
appear on the new domain; travelers can rejoin with their trip link.
