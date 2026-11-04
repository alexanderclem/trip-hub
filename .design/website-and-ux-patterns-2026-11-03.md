# Stowaway website and interaction patterns

Implemented November 3, 2026 in `codex/ux-patterns`, based on the completed operator recovery branch. The main checkout's existing untracked planning and website-review documents were preserved.

## Website

- Shared desktop navigation and a keyboard-accessible mobile disclosure connect Home, How it works, For operators, Pricing, and Help. Existing create, join, and app entries remain available.
- The homepage now explains the traveler workflow, introduces operators with an illustrative dashboard, describes relevant trip types, summarizes pricing, and answers adoption questions. Removed the redundant three-step section after expanding the product explanation.
- The operator page demonstrates the dashboard/traveler roster, public trip page, and booking/deposit summary, then explains the trip lifecycle, onboarding, and practical questions. All examples use labeled synthetic data.
- Pricing separates free planning, the proposed 1% plus Stripe collection model, and Pro tools free during beta. Kept the existing shared fee calculator and added fees/refunds/payout/availability questions.
- Added a guided How it works page and practical Help/contact/About content. The contact destination is the existing project issue tracker; no private support email or customer endorsements were invented.
- Payment collection remains coming soon. Pro subscription billing and campaign delivery are not advertised as active. Replaced the unconditional no-holds heading with an explanation of the connected Stripe account and Stripe-managed payout timing.
- Public pages receive build-time HTML, individual titles/descriptions/canonicals, and a sitemap. A temporary Vite SSR server renders only the five allowlisted public paths; it never renders private trips or accounts. Rendering runs before Workbox computes its revisions. Flat HTML files support clean URLs in preview and Cloudflare assets.
- The offline navigation fallback uses the blank app shell, avoiding a pre-rendered marketing page as the private trip fallback. Public visits continue to defer full offline downloads.

## Requested patterns

| Pattern | Applied behavior |
| --- | --- |
| Skeleton loaders | Preserved existing list/card skeletons; added dashboard-shaped skeletons that do not imply zero revenue while booking data loads. |
| Optimistic updates | Preserved local-first IndexedDB/outbox saves. Task checkboxes respond immediately and revert with an error if the local transaction fails. |
| Command menu and shortcut hints | Trip search opens from its header button, Cmd/Ctrl+K, or `/` outside text fields. Filtered destinations/actions respect access permissions. Arrow keys/Enter navigate; Escape and native dialog focus behavior are preserved. |
| Undo toasts | Task completion/reopening has an explicit undo action that survives client navigation. Notices remain until dismissed, undone, or replaced by three newer notices. Undo reads the current row, preserves later edits to other fields, rejects changed completion state, and never revives deleted rows. |
| Stale while revalidate | Kept saved destination facts visible through refresh/failure. Expired lookups revalidate when the window regains focus or comes online. Offline trip data continues using the existing IndexedDB-first sync model. |
| Pre-rendering | Five public routes are useful before JavaScript and hydrate interactively afterward. Browser-dependent install instructions use a stable server snapshot. |
| Blurry image placeholders | Thirteen tiny local previews cover shipped trip artwork and the homepage photo. Full photos reveal after load; already-decoded pre-rendered/cached images are detected. No-JavaScript pages retain visible full images. Custom photos keep their existing failure fallback. |
| View transitions | React's installed ViewTransition API coordinates route changes, preserving the mounted workspace and forms. Removed the duplicate page fade and disabled transition animation under reduced motion. Browsers without support retain normal navigation. |
| Swipe to dismiss | A dedicated touch handle dismisses Quick Add, map-selection, and Stowie sheets. Short/cancelled drags settle back. The content remains scrollable, close buttons and Escape remain available, and edge gestures are not captured. |
| Interruptible animations | Native modal exit retains modality until completion; stopping/reopening cancels stale closes. Gesture settling can be interrupted. A successful drag retains its translation through dismissal rather than snapping back first. |
| Predictive back | Retained native browser/platform back gestures and the existing history/scroll restoration. No custom edge-swipe simulation is added; a web page cannot promise a native OS predictive-back preview on every device. |
| Tap targets and safe areas | Shared controls remain at least 44px. Enlarged the map close target and applied lateral header and bottom-sheet/toast safe-area spacing. |
| One-time-code autofill | Kept the existing `one-time-code` autocomplete, single numeric field, and explicit sign-in action. Added a field name and removed separators from pasted codes without blocking paste. |
| Tabular numbers | Kept stable money/time figures and applied tabular numerals to operator totals, the booking breakdown, pricing, and outputs. |
| Balanced headlines | Public headlines and shared display/section titles use balanced wrapping, with long-word wrapping preserved. |
| Smooth corners | Progressive `corner-shape: superellipse(...)` enhancement on appropriate surfaces, with existing radii as the fallback. |
| Idempotency keys | Preserved existing Stripe checkout/refund keys, deterministic row IDs, and coalesced outbox writes. Existing payment retry/idempotency tests pass. Financial operations do not receive speculative success feedback. |
| Amazon safe triangle | Not added: current navigation and commands are flat/click-controlled and have no hover flyout submenu to protect. Adding delays or a submenu solely to use this pattern would introduce friction. |

## Verification

- Node 24.22.2: app/test TypeScript checks passed; production build and pre-render/PWA generation passed. Existing large map/PDF bundle advisories remain.
- Full unit/database suite: 83 files, 604 tests passed. Backend tests use local PGlite; no live records were created.
- New browser suite: eight cases passed, including no-JavaScript public HTML/metadata; 320/390/768/1440px reflow; command search and text entry; local-save failure/rollback and undo after navigation; short/long sheet gestures; cached facts through reconnect/revalidation; delayed-image placeholders; and dark mode/reduced motion/enlarged text.
- Existing website suite: all 13 cases passed in the earlier regression run, including keyboard skip/FAQ, offline app entry, Home Screen compatibility, 200% text scaling, contrast, and laptop-fold checks.
- Final browser coverage: 77 unique cases verified across ten specs. The combined run passed 75; its two failures were the old unscoped figure selector and an enlarged-text appearance-control overflow that shifted a native dialog outside the phone viewport. Scoped the sample-trip selector, made appearance controls wrap, and added a document-overflow assertion. All 31 install/appearance/polish cases passed in the final affected-suite rerun. Tests use synthetic local fixtures/intercepted services rather than real trips, payments, or emails.
- Visually inspected phone homepage and desktop operator captures; corrected the photo wrapper positioning and removed repetitive homepage content. Final captures are under `/tmp/stowaway-ux-final` in this session.
- Visually inspected final command search, Quick Add sheet, and dark pricing captures. Physical-device, live payment, and screen-reader coverage remain separate.

Physical iPhone/Safari predictive-back behavior, screen-reader operation, live payment setup, and field performance are not certified by these Chromium fixtures. No payment activation, schema migration, or real email sending is part of this change.
