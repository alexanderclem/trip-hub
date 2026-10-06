# Stowaway website entry polish

Profile: marketing page inside the existing Stowaway design system.
Scope: a public homepage, the existing app entry, and the navigation connecting them.

## Guidance and direction

Applied [avoid-ai-design v0.4.0](https://github.com/funboy322/avoid-ai-design/blob/main/SKILL.md),
alongside the local Design Partner guidance. The user selected product-led:
map, itinerary, and clear copy. The existing `docs/BRAND.md` remains authoritative.
`DESIGN.md` records the shared contract.

## Initial audit of the draft

Scanner: 0 P0, 3 P1, 0 P2 across the homepage and styles.

| ID | Evidence | Finding | Resolution |
| --- | --- | --- | --- |
| I3 | Code-certain, LandingScreen import and actions | Repeated ArrowRight and Check icons added default decoration. | Removed them; map, date, ticket, and group icons carry specific meaning. |
| SD5 | Code-certain, homepage h1 | The tagline's second phrase had isolated italic/color emphasis. | One display treatment for the entire headline. |
| SD6 | Code-certain, explanation list | Zero-padded markers were unnecessary visual chrome. | Removed the markers; headings describe each action. |
| SD4/T5 | Visual/code review, section introductions | Repeated tracked, all-caps openers carried little extra information. | Removed them; only the product category and example label remain in sentence case. |
| L9/S1 | Visual judgment | A marketing template would not help a traveler understand the product. | The group's mapped day is the main evidence, with unboxed explanations and native FAQs. |

The existing cream, ocean ink, coral logo detail, Georgia wordmark, and luggage
illustration are intentional brand choices, not a newly selected palette.

## Implementation

- `/` introduces Stowaway through an illustrative map and itinerary, capability
  labels, practical explanations, and FAQ disclosures.
- `/app` retains the existing new-user welcome or returning-user trip workspace.
- Create, join, trip return links, canceled account sign-in, and quiz continuation
  point to their relevant app destinations. Shared trip URLs are preserved.
- `/app#join` scrolls to and focuses the invite field.
- Existing standalone shortcuts at `/` continue into `/app`. The manifest keeps
  `id: '/'` and launches at `/app`; [manifest identity guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id)
  informed that compatibility choice.
- Routes load app features on demand. The build still precaches the generated
  chunks for offline access. Initial JavaScript decreased from 503.23 KB gzip
  before splitting to 109.27 KB gzip after splitting.
- No dependencies were added. The original checkout's edits were preserved by
  using a worktree based on `origin/main`, branch `polish/website-entry`.

## Final verification

- `npm run build`: passed; PWA manifest and service worker generated. Large map
  chunks still produce the build's size warning, outside the initial homepage bundle.
- `npm run typecheck`: passed.
- `npm test -- --mode production`: 36 suites, 272 tests passed. Production mode
  loads the project's existing public Supabase configuration; default test mode
  initially lacked those values.
- `BASE_URL=http://127.0.0.1:4174 SHOTS_DIR=/tmp/stowaway-website-shots npx playwright test tests/e2e/website.spec.ts tests/e2e/account.spec.ts`:
  11 tests passed. Covered app/create/back navigation, focused join and invalid-link
  recovery, returning-device entry, keyboard skip and FAQ, optional account behavior,
  standalone entry, and service-worker-controlled offline app reload.
- Chromium reflow checks and screenshots at 320, 390, 768, and 1280 CSS px passed.
  Full-page 390px and 1280px screenshots were visually reviewed. An oversized map
  label icon found during native browser review was corrected before this pass.
- 200% text scaling at a 640px viewport: no horizontal overflow; primary action visible.
- Measured contrast: ink on cream 10.54:1, secondary text on cream 5.62:1,
  secondary text on the offline section 5.29:1, white on action blue 8.39:1.
- `git diff --check`: passed.
- Final scanner: 0 P0, 0 P1, 0 P2 on `src/features/website` with no ignore comments.

The scanner is supporting evidence, not a visual verdict: the final page preserves
the brand, shows a specific trip artifact, varies density by purpose, and removes
the draft's unnecessary emphasis and decoration.

## Limits and delivery state

Screen-reader, physical iPhone installation, and full live trip creation/sync tests
were not run. Browser tests use local contexts and stub account settings; no
server-side trips were created. 200% text scaling is separate from browser zoom.
This is a local production preview, not a published update.
