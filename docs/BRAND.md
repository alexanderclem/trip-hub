# Stowaway

Domain: `joinstowaway.app` · Tagline: **The whole trip, tucked away.**

Stowaway is a shared, offline-first trip planner. The voice is friendly, practical,
and lightly adventurous. Keep action labels literal: Create a trip, Join trip, Open trip.

The mark is "Carry-on": a suitcase with a slot in it and two eyes looking out, the
stowaway. The bag is ocean ink, the handle is coral, and the slot and the eye
highlights are real cut-outs, so the mark works in one colour and on any background.

- `public/brand/stowaway-mark.svg` is the master (96-unit grid).
- `public/brand/stowaway-mark-small.svg` is the small-size cut (bigger eyes, thicker
  handle, no highlights). Use it below about 32 px; the favicon uses it.
- `public/brand/stowaway-type.svg` is the drawn wordmark: rounded lowercase with a
  coral full stop. It is paths, not a font, so never retype it.
- `public/brand/stowaway-wordmark.svg` is the full horizontal logo, and
  `src/ui/Brand.tsx` is the interface lockup (it inlines the same wordmark path).
- The travel illustration is `public/brand/packed-for-anywhere.svg`.

Keep clear space of one handle width around the logo. Don't recolour the bag,
rotate the mark in a lockup, add a second pair of eyes, or set the name in a font.

Palette: ocean ink `#183e4b`, action blue `#295361`, cream `#f8f5ee`, mist
`#d6e4e5`, coral `#ef9477`. Coral is decorative, not a small-text color on cream.
Georgia gives the homepage heading a travel-journal character (the wordmark is drawn); keep
the system sans-serif for forms, navigation, and trip details. No external fonts.

Run `node scripts/build-brand-assets.mjs` to regenerate the favicon, PNG install
icons, full logo, and 1200×630 social preview from the three masters, using
existing Playwright. The app icon keeps the bag inside the maskable safe area.

The rebrand preserves `trip-hub` database, local-storage, infrastructure, and repository
identifiers for compatibility. Share links continue to use the current origin.
Domain routing and deployment are separate from these source changes. The social
preview URL assumes this build will be served at `https://joinstowaway.app`.
Browser storage is origin-specific: trips saved on the old domain do not automatically
appear on the new domain; travelers can rejoin with their trip link.
