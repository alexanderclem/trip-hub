# Stowaway polish and performance — Astra execution plan

Status: ready for implementation. Created 2026-10-08. Planning only; product code has not been changed for this plan.

## Objective and scope

Make Stowaway feel responsive, satisfying, and professionally finished through consistent interaction feedback, a useful interactive landing-page preview, restrained motion, and measured performance improvements.

Work in `stowaway-website`, not the sibling `trip-hub` directory. Preserve the cream/ocean palette, editorial typography, brand illustrations, existing routes, trip behavior, offline support, and accessibility. Use the existing Motion dependency; do not introduce Framer, GSAP, or another animation library.

Read repository instructions and the design skill before implementation. Read `.design/checkup-report.md`, then recheck its findings. The previous review was static; performance and rendered visual quality remain unmeasured.

The working tree already contains substantial unrelated changes, including trip, voting, comments, sync and notification work. Inspect the current diff before editing, preserve those changes, and never reset or overwrite them. Re-read affected files before modifying them.

## Phase 1 — Establish the baseline

1. Run the existing production build and inspect its entry chunks and imports. Serve the production build using the repository's supported workflow.
2. Capture the landing page at approximately 390px, 768px, and 1440px widths. Walk through Create a trip, Join, navigation, FAQ, and the core app interactions below.
3. Record three cold-load mobile-profile runs and a warm repeat visit with consistent network/CPU settings. Report median LCP, CLS, interaction responsiveness, entry JS/CSS transfer, and startup requests. Separate lab results from field data.
4. Inspect the startup waterfall and service-worker activity separately: determine whether broad precaching competes with the first render and whether map/OCR/PDF features enter the critical path.
5. Audit existing control states before adding anything. Shared app buttons already have Motion hover/press feedback; invite copying already has a success status. Reuse and refine these implementations rather than duplicating them.

Deliverable: `.design/performance-baseline.md` with method, measurements, screenshots or their paths, and confirmed bottlenecks. Record any environment limitation explicitly.

## Phase 2 — Complete interaction feedback

Primary files: `src/features/website/website.css`, `src/ui/index.tsx`, `src/ui/motion.ts`, `src/ui/MotionProvider.tsx`; inspect the relevant save/vote/invite flows before changing them.

- Add explicit, approximately 120–180ms background/border/transform transitions to landing-page buttons and links as appropriate. Preserve visible keyboard focus and reduced-motion handling. Avoid `transition: all`.
- Reconcile landing controls with the existing shared app button behavior. Keep one coherent timing/easing system; do not stack CSS and Motion transforms on the same control.
- Check save, vote, and copy-invite actions for immediate pending feedback, duplicate-submission prevention, truthful completion feedback, and recoverable errors. Only add states that are missing.
- Reserve success messaging space where needed to prevent distracting layout jumps. Announce meaningful asynchronous results through an existing or appropriate status region.
- Prefer existing components and inline feedback. Add no global toast system unless inspection establishes a concrete need.

Acceptance: pointer and keyboard controls feel consistent; async controls indicate pending/completed/error states; failures retain user input; rapid clicking does not duplicate operations. Reduced motion removes movement without removing feedback.

## Phase 3 — Build a useful interactive itinerary preview

Primary files: `src/features/website/LandingScreen.tsx` and `src/features/website/website.css`. Extract a local preview component only if it makes the implementation clearer.

- Extend the existing illustrative NYC itinerary to three realistic example days. Keep example data local and clearly labeled; fetch no maps, live trip data, or APIs for this marketing demo.
- Add a compact, accessible day selector with clearly labeled buttons and a programmatically exposed selected state. Use buttons rather than tab semantics unless implementing the complete tabs keyboard pattern.
- Selecting a day changes the itinerary stops and corresponding map markers/route. Keep map and textual itinerary consistent; the text conveys all necessary information.
- Preserve a stable preview footprint through content changes. Check long stop names and narrow layouts. Make the selector comfortably touchable.
- Give day changes a short fade/transform transition, roughly 180–240ms. Support rapid changes without queued animations, stale markers, focus loss, or flicker.
- Keep Create a trip and Join your group as the main actions. The preview stays a compact demonstration, not a full app embedded in the landing page.

Acceptance: all three days work with pointer and keyboard; selected state is accessible; the preview is immediately readable without animation; it triggers no new network requests; layout stays stable.

## Phase 4 — Add restrained motion choreography

Primary files: the preview component, `src/ui/motion.ts`, and existing motion infrastructure.

- Keep headline and CTA visible immediately. Refine the current hero entrance rather than adding multiple nested entrances.
- Animate the illustrative route drawing and marker/stop appearance once when the preview becomes visible. Use a short sequence with approximately 40–60ms stagger and no more than approximately 600ms total choreography.
- Use transform and opacity for ordinary movement. A small SVG route stroke animation is acceptable if profiling confirms it remains smooth.
- On day changes, use the transition from Phase 3 rather than replaying the entire initial sequence.
- No autoplay day carousel, infinite map motion, scroll hijacking, or decorative parallax. Add section reveals only if rendered review shows a specific benefit, and never delay access to content.
- Respect reduced motion at first render and when the preference changes live. Cancel or finish animation cleanly when interrupted or unmounted.

Acceptance: motion explains state changes and directs attention; controls remain usable during animation; reduced motion shows the complete static result; repeated navigation creates no accumulating animation work.

## Phase 5 — Optimize confirmed loading bottlenecks

Primary files to inspect: `src/main.tsx`, `src/router.tsx`, `src/app/layouts/RootLayout.tsx`, `src/ui/MotionProvider.tsx`, and `vite.config.ts`.

Implement improvements supported by Phase 1 measurements:

- Keep map rendering, PDF viewing and OCR out of the landing page's critical path; preserve existing route splitting and identify accidental eager imports.
- If worthwhile, asynchronously load Motion features through the existing LazyMotion setup. Verify first-interaction behavior and avoid replacing bundle savings with a noticeable animation delay.
- If service-worker precaching competes with initial rendering, adjust registration timing or caching boundaries. Preserve offline preparation, offline revisits, ticket access, map assets, and deployment-update recovery. Do not simply disable precaching to improve a benchmark.
- Consider lazy-loading globally mounted app-only UI, such as install dialogs, if its measured cost justifies the change and install behavior remains reliable.
- Optimize large assets and cache behavior only where the waterfall identifies a real cost. Preserve explicit image dimensions and the lightweight illustrative SVG preview.

Targets: no regression against the baseline; aim for lab LCP at or below 2.5s and CLS at or below 0.1 on the documented profile. Check representative interaction latency with a 200ms responsiveness goal; do not claim field INP from a short lab run. Report actual improvement and remaining constraints rather than promising targets that the environment cannot meet.

## Phase 6 — Verify and hand off

- Run `npm run typecheck`, `npm run build`, and relevant existing tests. Run existing end-to-end coverage for touched flows. Add focused behavior tests for the day selector or changed async/error behavior where useful; avoid tests that merely assert animation constants or CSS class names.
- Verify production-mode desktop and mobile rendering, touch/keyboard use, visible focus, 200% zoom, long preview content, reduced motion, and rapid repeated selection.
- Exercise save/vote/copy success and failure paths if changed, including clipboard rejection and slow requests.
- Re-run the baseline profile and compare medians using the same conditions. Check console errors and layout shifts.
- Verify a fresh service-worker install, warm/offline revisit, explicit offline trip preparation, and update recovery if caching or registration changed.
- Review the final diff for unrelated changes and unnecessary dependencies.

Deliverables: working implementation; before/after screenshots; `.design/polish-verification.md` with checks actually run, baseline versus final performance, remaining limitations, and concise file-level summary. Finish with a reviewer-friendly summary; deployment is outside this plan.

## Suggested execution sequence

Complete Phase 1 before deciding performance changes. Implement Phases 2–4 as one cohesive polish pass, verifying each phase before moving on. Execute Phase 5 against measured evidence, then Phase 6. Continue autonomously within this scope; ask only for missing information that prevents a concrete decision.
