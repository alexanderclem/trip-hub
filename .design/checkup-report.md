# Stowaway professional polish checkup

## Scope and method
Static review of the current stowaway-website landing page, onboarding, home, shared primitives, trip shell, routes, and metadata. No product files changed. Rendered views, device behavior, and backend reliability were not verified.

## Executive read
Stowaway has a recognizable travel identity, specific copy, and a substantial product underneath it. The next pass should improve continuity between marketing and application, recovery feedback, and layouts tailored to desktop work.

## Preserve
- Warm canvas, blue-green brand palette, serif headings, suitcase illustration.
- Specific shared-trip language and honest illustrative-preview labels.
- Existing focus indicators, input sizing, loading skeletons, and offline status.
- Existing functional and end-to-end test coverage; coverage presence does not establish passing results.

## Scorecard
Static evidence only; runtime-dependent dimensions remain unscored.

| Dimension | Assessment |
| --- | --- |
| Product clarity | 3 Strong: shared trip purpose is explicit. |
| Brand consistency | 2 Mixed: marketing uses an SVG logo, app uses a separate Brand component; primitives use multiple styling patterns. |
| Credibility | 2 Mixed: illustrative preview explains the category, but does not demonstrate actual product screens. |
| Responsive behavior, accessibility, performance | Pending rendered verification. |

## Findings
| Severity | Evidence | Impact | Prescription |
| --- | --- | --- | --- |
| MEDIUM | src/app/layouts/TripLayout.tsx: trip shell uses the same five-column bottom navigation at every width. | Desktop space is not used to support planning and switching context. | Introduce a desktop sidebar with persistent trip identity; preserve mobile tabs. Verify each destination layout. |
| MEDIUM | src/app/layouts/TripLayout.tsx: SyncPill is pointer-events-none and reports only “Sync problem”. | The error message offers no recovery action or explanation of the next step. | Add a recoverable status panel with pending-change details and a retry action where supported. |
| MEDIUM | src/app/layouts/TripLayout.tsx: quiz/profile lookup returns null while pending. | This branch supplies no loading feedback. | Show a compact, accessible loading state with failure recovery. |
| MEDIUM | src/ui/index.tsx: PageHeader truncates titles and gives the back control a 40px square target. | Long trip content loses context; target sizing differs from the 44px controls elsewhere. | Standardize touch targets and provide a readable long-title treatment. |
| LOW | src/features/website/LandingScreen.tsx: product preview is illustrative; footer contains brand, tagline, and app link only. | Visitors have limited concrete product proof and limited access to support or data-handling information. | Add verified real-product examples and support/privacy links backed by actual policies. |
| LOW | Native confirm dialogs across itinerary, tickets, money, tasks, packing, and settings. | Destructive flows use browser styling and inconsistent interaction patterns. | Use a shared accessible confirmation component; provide undo only where data behavior supports it. |

## Priorities
Now: desktop shell, actionable sync errors, profile-loading feedback, consistent shared primitives.
Next: real-product website demonstration, clear first-trip onboarding, support/privacy information, consistent destructive-action flows.
Later: purposeful motion and contextual shortcuts after primary journeys are verified.

## Verification gaps
Check landing, create, invite, itinerary, ticket, expense, and offline recovery flows on phone and desktop. Include keyboard navigation, 200% zoom, long titles, slow loading, interrupted uploads, and denied permissions. Measure performance before prescribing optimization. Review real account/sync behavior before making durability or privacy claims.

## Verdict
Verdict pending rendered and end-to-end verification. This report identifies code-supported opportunities; it does not certify launch readiness.
