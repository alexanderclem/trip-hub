PHASE 02 — Cohesive application shell, navigation, and visual system
Read 00_MASTER_BRIEF.md, all Phase 01 deliverables under .design/pro-redesign/, and then this prompt. Implement real UI changes, not mockups. Work on a safe local branch; no deploy.
Objective
Give Stowaway one coherent, premium-quality application frame. A traveler should not feel that Home, Plan, Map, Vote, Money, and Tickets belong to separate mini-products. The product should have the same calm, recognizable visual grammar across every route, with task-appropriate density and stable interaction patterns.
Where to inspect
src/app/layouts/TripLayout.tsx; TripSwitcher.tsx; src/features/trips/QuickAdd.tsx; shared src/ui/index.tsx, collection.tsx, Dialog.tsx, PageTransition.tsx, CommandMenu.tsx, SyncStatus and header contexts; src/styles/{tokens,themes,app-theme,index,journal,travel-notebook}.css; docs/UI_COMPONENTS.md. Read the existing motion and interaction reports; many earlier polish issues are already fixed. Examine the exact current mobile tabs and desktop sidebar before coding.
Implement
1. Stable, intentional navigation
Implement the chosen Phase 01 IA. If Phase 01 recommends the original five-tab model, keep it but make its discoverability genuinely better; do not change merely to look redesigned. If a combined Explore is selected, preserve existing /map, /more/places, /more/vote routes as working direct links even if entry points are regrouped. The bottom bar must always display understandable labels and the active state. No icons alone. The desktop rail should group truly related destinations under useful headings; avoid more than one highlighted group or orphaned selected states.

Test primary routes with deeply nested paths, browser back and forward, direct URL loads, empty trips, current trip switching, and permission-limited access. Any new mapping logic must have focused route tests. Keep the content area responsive and not obscured by the safe-area bottom nav.
2. Unify the top-level shell
Use consistent screen headers with one primary context label or trip title, a predictable back affordance on detail screens, relevant action(s), and restrained sync/assistant controls. Eliminate header overcrowding on 320–390px; preserve accessible names and visible keyboard focus. Do not turn every page into a permanently sticky massive header. Treat Map as an intentional exception where the map itself is the work surface. Keep install and optional account flows secondary.
3. Clarify Add actions
Inspect QuickAdd vs contextual Fab and screen actions. Give every route one dominant Add location. On Plan, Add activity should be context-specific and prefill the selected date; a general Add sheet can remain accessible where it does not compete. On Money, Add expense should be explicit. On Tickets, Add ticket. On Explore, Save place. On a read-only role, never display a clickable but unauthorized action; explain permissions where useful. Ensure header/floating actions do not cover map gestures, bottom navigation, form submits, or inline error messages.
4. Establish a small real design system
Define or refine semantic tokens for canvas, surface, elevated surface, border, focus, text, muted text, action, on-action, success, warning, danger, tentative, and quiet metadata. Prefer existing tokens; do not add a parallel stylesheet or arbitrary Tailwind palette. Record type roles (display trip name; page title; section; row title; body; small data label; microcopy), spacing intervals, content max-widths by surface, border/elevation rules, and radii. Preserve the existing Barlow/Antonio visual DNA and dark-mode design rather than merely inverting colors.

Create a few reusable composition primitives where repetition is real (e.g. AppSection, StatusCluster, ScreenActions, DataRow variants), but do not build a generic component library that makes application code harder to understand. Keep all visual decisions driven by actual trip UI and data. Prefer hairline-divided lists over repetitive nested cards. Every screen does NOT need a hero image.
5. Standardize feedback and states
Define exact text and visual treatment for locally saved, pending synchronization, synced, rejected, tentative, confirmed, selected group pick, missing download and on-device download. Never equate installation with offline readiness. Existing Status, ErrorNote, LoadingState, Disclosure, native dialog and semantic buttons should be reused. Ensure action-state transitions are immediately visible without animation-dependent clarity.
6. Animation and interaction discipline
Keep the existing motion library, but make high-frequency interactions fast and interruptible. Remove or reduce decorative movement with no task benefit. Maintain reduced-motion path and focus restoration. Do not animate financial number values. Keep the selected Plan day stable while content changes, and do not silently reorder a list beneath a touch.
Real-state test matrix
- Empty/new/loaded trips and an account with 3+ trips.
- 320, 390, 768, 1024, 1440 widths; 200% zoom.
- Dense trip title and long destination names; 15-day trip.
- Disabled, pending, error and permission-limited controls.
- Dark mode, reduced motion, touch and keyboard.
- Direct trip detail links while offline; browser forward/back and route-history recovery.
- Compare primary action count and navigation discoverability before vs after.
Acceptance criteria
- Every primary destination is reachable without guessing its hidden category; users can articulate where to find Plan, places, votes, tickets and expenses.
- Desktop and phone screens visibly belong to the same product while using space differently.
- No double Add affordance in the same decision region; no overlapping nav/sheets/floating controls.
- Per-screen primary action and typography hierarchy are obvious in a screenshot without instructional prose.
- All paths and permissions continue to function; no regressions in deep-link navigation.
- No hardcoded arbitrary brand colors in new or changed components; documented shared tokens.
- Relevant Vitest + Playwright flows, typecheck, build, git diff --check, and visual comparisons executed and recorded.
Update .design/pro-redesign/PROGRESS.md and docs/UI_COMPONENTS.md as appropriate. Do NOT modify the public website as part of this phase except for shared primitives where unavoidable; verify those changes against its screenshots.
