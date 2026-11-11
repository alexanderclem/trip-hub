PHASE 01 — Real-product baseline, UX architecture, and implementation blueprint
Read 00_MASTER_BRIEF.md in full, then this prompt. This phase is a bounded discovery and design-planning phase, not a reason to stall. Do the evidence collection and produce a concrete executable plan that will govern phases 02–09. Do not modify product source in this phase unless required to make local fixtures/screenshots reproducible; if so keep changes clearly isolated. Do not deploy.
Objective
Determine the current Stowaway experience and the smallest coherent set of design changes that can produce a first-class consumer UX. Separate verified issues from aesthetics and from problems already fixed in previous branches. The end result is a product architecture precise enough that implementation can proceed with no broad ambiguity.
Inspect the existing product in this order
1. Read CLAUDE.md, PRODUCT.md, DESIGN.md, docs/BRAND.md, docs/UI_COMPONENTS.md, docs/PLANNING_FEATURES.md, and the existing design reports under .design/, especially .design/mobile-simplification-review-2026-11-05.md, .design/review-report.md, and .design/website-polish-report.md. Identify changes already implemented as of HEAD; do not treat older screenshots as live evidence.
2. Inspect routing, component structure and shared tokens: src/app/layouts/TripLayout.tsx, src/features/trips/QuickAdd.tsx, src/ui/, src/styles/, public website routes and the trip data hooks. Enumerate actual navigation items on desktop/mobile, all contextual Add controls, back navigation and overlays.
3. Launch the documented local app/preview with its normal test setup. Use the existing Playwright fixtures and test helpers; never connect the browser to a real private trip or copy real traveler information into screenshots. Ensure offline-first behavior is represented realistically in fixtures.
4. Execute a realistic 8-person Paris trip example, March 2027, with two or more days, 8 travelers, several places, an open poll, a closed poll, tentative/confirmed itinerary events, ticket attachments, expenses, a partially prepared offline device, one overdue task, and at least one schedule overlap. Use disposable safe local fixture data. Include an empty trip, a new join, a returning traveler, a longer 14-day trip, a completed trip, and a hosted/restricted-access role.
5. Capture at least the public landing, first-time app entry, create trip, invite/join, trip home (planning/preparing/traveling), plan with selected day, place/map, vote/poll, money, tickets and offline status. Capture 390x844 and 1440x900 for core screens, and 320, 768 and 200% zoom/text for representative surfaces; light/dark where supported. Record screenshot paths in .design/pro-redesign/.
6. Trace these tasks by actually clicking, tapping, tabbing and typing: create a trip; invite a friend; join by link and choose name; save a place; create and cast a four-point vote; hand a group decision into the plan manually; add/edit/reschedule an activity; open a ticket; record an expense; prepare the device for offline use; reopen while offline and recover after reconnect; open trip from a deep link. Record every unnecessary step, duplicate action or misleading status.
7. Inspect current copy for truthfulness, especially the first-join Home Screen prompt vs offline preparation; group-link editing permissions; vote result vs plan insertion; planned vs booked; locally saved vs synced.
Produce an opinionated UX architecture
A. Clear mental model
Draft a one-page explanation of Stowaway in terms of organize together → get ready → travel → settle/remember. Distinguish: an action the group decides, a personal task, an item scheduled in the plan, a booking confirmation, a shared expense, and data available on this particular device.
B. Navigation recommendation with evidence
Evaluate the present stable mobile navigation (Home / Plan / Map / Vote / More) against a candidate Home / Plan / Explore / Money / More, where Explore unifies saved places and map discovery and polls remain prominent contextually on Home and in the group-decision area. This is a candidate, not an instruction to remove Vote unconditionally. Compare discoverability across participant, organizer and actively-traveling tasks. If neither is good, propose a better five-destination model. Keep labels literal and no more than five primary phone destinations; no constantly shuffling tabs by phase. Ticket access should be available contextually from the relevant itinerary event and from a stable global list. Desktop navigation may provide more destinations grouped by role, but avoid an overwhelming list.

Map old URL → new visible entry → deep-link handling for every destination before implementing. Verify group votes remain within two clear steps of arrival during active planning and that money/tickets remain easy to reach. Avoid silently changing existing routes or browser-history behavior.
C. Screen templates
Define exactly four or five app composition patterns, rather than one card layout applied everywhere:
- Action-focused Home: compact trip identity, one important personal/group task, up-next/day preview, quiet access to essentials.
- Time-based Plan: persistent date strip, scanning-first agenda, contextual add, schedule/ticket/conflict detail.
- Explore/Map: direct map/place search, list/map relationship, saved places and decisions without duplicate floating layers.
- Records & balances: legible expense/ticket lists, accurate prominent figures and safe editing.
- Lightweight first-run: create/invite/join with no unnecessary friction.
For each pattern, define a phone hierarchy, desktop hierarchy, empty state, dense state, relevant top-right action, and whether a FAB exists. One primary action per region. No duplicate global+local Add controls.
D. Visual art direction
Specify a cohesive design for the working app: ocean ink + restrained coral on clean thermal-stock surfaces; Barlow family for reading, Antonio for real route codes only, subtle hairlines and controlled elevation; generous first-viewport breathing room but compact rows where travelers scan many records. Specify semantic tokens and roles, not arbitrary hard-coded one-offs. The public website retains its more expressive luggage-tag composition; the app inherits the brand without recreating that printed-sheet concept on every screen.

Include screenshots of both effective and ineffective current UI decisions. Make a keep / refine / remove inventory for important existing patterns, including Stowie, route-code treatment, animated feature demonstrations, welcome card, banners, dialogs, floating actions, and the Money balance.
E. User journeys, success measures and failure states
Create a concrete journey matrix with a main success path and at least one failure path for: first-time organizer, new participant, returning traveler, traveling offline, hosted permission-limited member. Define targets as hypotheses (e.g. task understood within 3 seconds, no more than two obvious taps to next ticket), not invented measurement results. Define 6–8 short moderated usability-test tasks a novice can attempt without coaching.
Deliverables
Write these into .design/pro-redesign/:
- CURRENT_STATE.md: observed visuals, routes/states, severity-ranked problems and confirmed strengths, with code/screenshot evidence.
- TARGET_EXPERIENCE.md: the mental model, IA, explicit navigation recommendation, screen composition specs, visual rules, reference screen anatomy, and flow maps.
- IMPLEMENTATION_PLAN.md: phased, dependency-aware file list with acceptance criteria, risk notes and test coverage; include what MUST NOT change.
- BASELINE_TEST_MATRIX.md: actual screenshot paths, baseline flows, commands, results, gaps.
- PROGRESS.md: initialized with baseline findings and per-phase status.
Use stable issue IDs such as UX-01 and severity HIGH/MEDIUM/LOW, with impact and evidence. Include a deferred/rejected ideas subsection: attractive ideas that would add unnecessary complexity, blur booking status, disrupt navigation, violate offline-first, or already exist.
Exit requirements
- Every recommendation points to a current route/component or witnessed task issue.
- Major information-architecture decisions and preservation constraints are documented so phases 02–09 can implement without another broad research loop.
- Baseline screenshots are actual fresh captures; historical images are clearly labeled.
- Scope is controlled. Do not introduce random new features as "UX improvements."
- The final response concisely summarizes the chosen navigation, the top five friction points and which work is already completed on the current branch, with honest verification gaps.
Begin immediately.
