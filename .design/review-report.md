# Stowaway polish and motion review

Reviewed November 3, 2026. Research and recommendations only.

This records the pre-implementation review. The subsequent changes and verification are recorded in [the implementation report](interaction-polish-2026-11-03.md).

## Recommendation

Keep Stowaway's ocean ink, coral accent, travel artwork, suitcase character, and plainspoken voice. The next investment should make its frequent actions feel immediate and its screens easier to scan. Use the existing Motion for React and CSS foundation. Add a specialist dependency only after a specific interaction needs it.

The proposed direction is **a calm, capable travel companion**: clear information, understated movement, useful personality at occasional moments, and accurate feedback about what is saved on this phone versus shared with the group. This is a design recommendation, not a finding from user testing.

## Scope and evidence

- Inspected `trip-hub` main at `c7cee8c`, the most recent main checkout among five linked worktrees. Sibling worktrees have older visual versions. The existing untracked `docs/IMPLEMENTATION_PLAN_2026-11-02.md` was read for context and left unchanged.
- Read the brand/component guidance, current appearance report, shared UI/motion code, public trip preview, itinerary, voting, money, trip overview, quick-add, and sync presentation.
- Built current source and ran the existing local-fixture screenshot suite at 390×844 and 1440×900. Each run traversed 19 populated trip screens and asserted no horizontal document overflow or page exceptions. The fixture intentionally simulates offline use.
- Visually inspected representative fresh overview, vote, and money captures, plus retained November 2 public-page and Plan captures. Rendering every screen is separate from personally inspecting every capture.
- Ran three focused existing browser regressions for the public preview, reduced-motion preference changes/reflow, and failed vote/retry behavior.
- Researched official library documentation, platform guidance, published UX research summaries, and first-person design engineering accounts. Sources are linked beside the relevant recommendations and indexed below.
- No product source was edited. No backend fixtures or real trips were created. The browser connector was unavailable; local automated Chromium tests supplied fresh runtime evidence. These checks do not establish live production behavior, physical-phone behavior, Safari compatibility, field performance, or formal accessibility conformance.

Screenshots: [`screenshots/research-2026-11-03`](screenshots/research-2026-11-03).

## First impression and task walkthrough

**Public introduction:** The existing homepage makes the product understandable and includes a working, labeled example. That is stronger evidence than another set of feature tiles. Keep the interactive preview as the main demonstration. The visual system is coherent, though the current screen treatment is more utilitarian than the expressive suitcase mark. The illustration and small brand details can carry more character without adding decoration to every control.

**Planning:** The overview already adapts to planning, preparing, traveling, and completed phases. Preserve this behavior. In the tested planning state, the phone puts a large trip heading, date information, cover, and three navigation tiles before the next-step card. Bring the work higher for returning visitors, while retaining the cover as a meaningful first-visit detail.

**Voting:** Clear four-point choices, visible selection, local-save wording, retry behavior, and duplicate-action protection already exist. The share block and share header action currently compete with the voting task. Once a traveler is inside a poll, scoring options should dominate.

**Using the plan:** A readable agenda, distinct days, time-zone choices, and linked tickets are already present. Day changes are a useful place for restrained continuity. They do not need a full-screen page transition. A timed itinerary is not an arbitrary sortable list: changing order may mean changing times and needs explicit rules.

**Checking money:** The prominent balance is easy to find, but its entrance count-up makes users wait for the final number. Show the real amount immediately on entry. If a saved expense later changes it, a brief old-to-new transition can communicate that change.

**Traveling offline:** The existing distinction between local saving, pending uploads, refreshing, rejection, and offline use is a valuable trust foundation. Preserve it when simplifying the presentation. A polished green check must represent the relevant completed operation.

## Quality scorecard

These are reviewer judgments against explicit criteria, not measured user satisfaction scores.

| Dimension | Assessment | Evidence and limit |
| --- | --- | --- |
| Identity and intentionality | Strong | Original mark, semantic palette, travel art, literal product copy, labeled demonstration. |
| Readability | Strong with refinements | Shared type roles and readable record layouts; similar weights and repeated framing still flatten hierarchy in some views. |
| Task hierarchy | Partial | Main actions are visible, but cover/navigation and poll sharing take prominent space before the immediate task. |
| Responsive layout | Strong within tested widths | 38 populated screen/viewport combinations passed overflow and page-error checks; untested widths and real devices remain. |
| Accessible interaction | Partial evidence | Reduced-motion/reflow regression passed; existing native controls and dialog semantics are strengths. No screen-reader or complete keyboard audit this turn. |
| Motion system | Partial | Shared tokens and live reduced-motion handling exist; exits, layout continuity, and initial number behavior need targeted work. |
| Performance feel | Not fully assessed | Successful production build and code/bundle inspection; no frame profiling, production throttling, or field measurements. |
| Product credibility | Strong foundation | Specific travel data and honest save/offline copy; collaboration behavior was not verified against live devices. |

## Findings

LOW denotes a polish improvement, not a release blocker. Proposed visual priorities need validation with returning travelers. MEDIUM denotes a confirmed implementation inconsistency that merits focused correction. No HIGH defect was established by this bounded review.

| ID | Severity | Area | Location / evidence | Current behavior | Proposed correction | User impact |
| --- | --- | --- | --- | --- | --- | --- |
| ST-01 | LOW | Phone overview priority | `src/features/trips/TripOverviewScreen.tsx:118`; fresh `light-overview-390.png`, planning fixture | Cover, metadata, and three links precede the next-step card; that card starts roughly 460 CSS px down an 844px viewport. Its action is still visible. | Test a compact returning-visitor header and shorter cover, keeping the next decision higher. Retain first-visit warmth and existing phase logic. | Less repeated scanning before acting. |
| ST-02 | LOW | Poll task priority | `src/features/polls/PollScreen.tsx:104`; fresh `light-vote-poll-390.png` | A header share control and large sharing panel precede scoring options. | Keep one compact share affordance; put the poll options and progress first. Preserve the access warning when sharing. | More emphasis on casting the vote the traveler came to make. |
| ST-03 | LOW | Competing add affordances | `src/app/layouts/TripLayout.tsx:159`, `src/features/trips/QuickAdd.tsx:34`, `src/features/itinerary/PlanScreen.tsx:184` | Global Add and contextual floating Add coexist on populated screens. They are different scopes, but both appear as a plus on phones. | Choose a clear primary placement per screen. Prefer contextual Add for the current task; retain global Add where it adds useful cross-feature access. | Fewer ambiguous controls and less chrome. |
| ST-04 | LOW | Balance entrance | `src/ui/effects.tsx:41`, `src/features/money/MoneyScreen.tsx:87` | `NumberTicker` initializes to zero and animates for 700ms when mounted and visible. | Render the final balance on entry. Animate only actual later changes, keep an accurate accessible value, and announce at most the completed change. | Immediate reading of a consequential value. Code-confirmed behavior; not a measured error rate. |
| ST-05 | MEDIUM | Interrupted number updates | `src/ui/effects.tsx:50` | The ticker cleanup stops animation and sets its next origin to the previous target, rather than the last displayed sample. | Keep the current displayed value in a ref or motion value; retarget from it. Prefer rendering the true value immediately if animation would delay clarity. | Avoids discontinuity if another update arrives before the current transition finishes. Code-confirmed; rapid-update runtime reproduction remains outstanding. |
| ST-06 | LOW | Overlay completion | `src/ui/Dialog.tsx:16` | Dialog content enters over 280ms; closing calls native `close()` immediately. | Add a short coordinated exit if useful. Keep the native modal open until the visual exit completes, handle reopen/cancel, and preserve focus restoration. | Entry and dismissal feel like the same interaction. Native behavior must remain reliable. |
| ST-07 | LOW | Motion consistency | `src/ui/motion.ts:3`, `src/styles/tokens.css:2`, `src/styles/index.css:151` | Shared JS timing exists alongside independent CSS timings and a separate measured-highlight implementation. | Define a small semantic timing/easing vocabulary and make exceptions intentional. Keep immediate text/selection feedback even when a decorative highlight moves. | Consistent behavior across screens without making every animation identical. |

`ST-05` does not establish that all balance updates visibly jump; it identifies the interrupted-animation origin in source and specifies the next reproduction needed.

## What the research supports

Visual appeal affects perceived ease of use, although serious usability problems overwhelm that benefit. It is reasonable to invest in visual craft and still measure task completion separately. [NN/g: aesthetic usability](https://www.nngroup.com/articles/aesthetic-usability-effect/).

Motion can explain changes, provide feedback, and preserve orientation. Irrelevant movement competes for attention. For Stowaway, animate the changed vote or inserted plan item rather than replaying an entrance for all content. [NN/g: purposes of animation](https://www.nngroup.com/articles/animation-purpose-ux/).

Frequency changes the appropriate treatment: repeated task interactions deserve shorter and quieter effects than occasional introductions. Emil Kowalski's examples are a practitioner's guidance, not a controlled study of Stowaway users. [Frequency and perceived speed](https://emilkowal.ski/ui/you-dont-need-animations).

Linear's March 2026 refresh describes reducing navigation prominence, excessive icons, and unnecessary boundaries. My application to Stowaway is to let trip content dominate its chrome; it is not a proposal to copy Linear's appearance. [Linear's design account](https://linear.app/now/behind-the-latest-design-refresh).

Airbnb explicitly described dimensional imagery and animation as part of its redesigned system. Its public announcement does not establish which web animation package it uses. For Stowaway, consistent illustration and a few authored moments are the transferable idea. [Airbnb's release](https://news.airbnb.com/en-uk/2025-summer-release-now-you-can-airbnb-more-than-an-airbnb).

## Proposed motion vocabulary

These values are starting points for Stowaway, not universal scientific thresholds. Prefer a quick start, controlled settling, short distances, and responses that can be interrupted. Keep the actual state readable before decorative motion completes. Timing guidance should consider frequency, distance, and purpose. [NN/g: execution and timing](https://www.nngroup.com/articles/animation-duration/).

| Role | Starting point | Stowaway application |
| --- | --- | --- |
| Direct press | Immediate state response; 80–120ms visual return | Keep the existing 1px button press, or test a subtle 0.98 scale. Pick one treatment. |
| Small state change | 120–180ms | Selected vote, checkbox, saved icon, small label crossfade. |
| Local continuity | 180–240ms | Day selection marker, inserted list item, compact disclosure. |
| Overlay entrance | 220–300ms | Quick Add or place details. Small movement; no scaling from zero. |
| Overlay exit | 120–180ms | Close the sheet/dialog in its established direction. |
| Rare brand moment | 300–500ms, one time | A small Stowie acknowledgment after a real completed action. Never hold navigation to finish it. |

Use the existing `cubic-bezier(.16, 1, .3, 1)` for controlled entrances. A spring is useful for a gesture that must respond to a changing target; start with the existing stiffness 450/damping 30 and tune on-device. A spring does not need visible bouncing. Origin-aware popovers and restrained initial scales are practical refinements. [Animation engineering tips](https://emilkowal.ski/ui/7-practical-animation-tips).

### Highest-value motions

1. **Vote:** immediate pressed state → local save completes → small check/label confirmation. Keep the four choices reachable, prevent duplicate saves, and leave failed choices recoverable. Quietly animate changed totals; do not reshuffle options under a finger as remote votes arrive.
2. **Add to Plan:** once the local save succeeds, show the inserted row in its correct time position and move nearby rows just enough to explain the insertion. Do not imply a reservation or automatic group decision occurred.
3. **Change day:** update the selected state immediately, keep the calendar strip and shell stable, and transition the content over a short distance. Rapid repeated taps must end on the latest day without a queue of effects.
4. **Open a place or ticket preview:** retain the surrounding context in a sheet where appropriate. Return focus to the opener. Keep an explicit Close action even if swipe dismissal exists.
5. **Download a ticket:** use real progress if available, then a stable downloaded-on-this-phone state. On failure, keep the ticket and retry action visible. Never manufacture percentage progress.
6. **Shared update:** a brief emphasis on a changed record can identify what happened. Include the real author and event when available. Preserve scroll position and avoid background updates moving the active control.

### Brand personality

Use Stowie to acknowledge creating/joining a trip, finishing an offline preparation step, or completing a packing checklist. A tiny eye movement or brief settle can establish personality. Continuous mascot movement next to itinerary times would draw attention away from travel information. The existing looping `LoadingLogo` is an actual loading indicator; evaluate its prominence separately from decorative loops.

## Tools: what belongs in this project

| Tool | Useful capability | Recommendation for Stowaway |
| --- | --- | --- |
| CSS transitions/keyframes and WAAPI | Press, focus/hover color, small entrances | Default for simple component feedback. No new dependency. Profile costly properties rather than assuming all CSS is cheap. [Performance guide](https://web.dev/articles/animations-guide). |
| Motion for React, formerly Framer Motion | Enter/exit orchestration, springs, shared elements, layout changes | Main React motion engine; already installed. `AnimatePresence` handles conditional exits; `layout`/`layoutId` can preserve spatial continuity. [Layout documentation](https://motion.dev/docs/react-layout-animations). |
| React 19.3 `ViewTransition` | Component/route transitions using the browser's view transition mechanism | Worth a small prototype for trip-card → trip or place → details. Current installed React exports it. Let one system own each transition; browser fallback and rapid navigation need testing. [React reference](https://react.dev/reference/react/ViewTransition). |
| Base UI Drawer, or an equivalent focused drawer primitive | Swipe/snap behavior for a genuine mobile sheet | Evaluate only if the current native dialog cannot meet the sheet's interaction requirements. Do not migrate every existing control. [Drawer documentation](https://base-ui.com/react/components/drawer). |
| NumberFlow | Formatted digits transition between values | Optional for vote counts or actual balance changes. It is not a reason to replay a zero-to-total count-up. Existing code can be refined first. [Official docs](https://number-flow.barvian.me/). |
| dnd kit | Sortable interactions and input sensors | Add only when users need direct manipulation. For itinerary time changes, design conflict, persistence, and undo rules first. [Official docs](https://dndkit.com/). |
| GSAP with `useGSAP` / ScrollTrigger | Authored sequences and scroll-linked storytelling | Optional for a future marketing story. Existing Motion/CSS can already polish the current homepage. Keep it out of ordinary app controls unless a specific need emerges. [React integration](https://gsap.com/resources/React/), [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/). |
| Rive | Authored interactive vector characters and state machines | Consider if Stowie needs a coherent set of interactive character states. Keep functional buttons/text in the DOM and load the character runtime only where needed. SVG plus Motion is sufficient for simpler poses. [React runtime](https://rive.app/docs/runtimes/react/react). |
| dotLottie | Playback of authored vector animation assets, with additional interactive features | An alternative for designer-delivered animations. Choose the asset workflow needed; do not add it alongside Rive by default. [Official runtimes](https://docs.lottiefiles.com/en/runtimes). |
| React Spring | Spring-based animation | A credible alternative in a new project, but Stowaway already has springs in Motion. No demonstrated reason to add both. [Official project](https://www.react-spring.dev/). |
| AutoAnimate | Automatic add/remove/move transitions | Useful for a quick retrofit elsewhere. Avoid overlapping its DOM layout ownership with Motion on Stowaway's same list. [Official project](https://auto-animate.formkit.com/). |
| Sonner | Toast presentation with action/promise variants | Optional if an app-wide toast requirement emerges. Existing inline statuses better explain many local saves; essential errors must remain near the affected content. [Official project](https://sonner.emilkowal.ski/). |

**One important implementation detail:** `MotionProvider.tsx:22` currently loads `domAnimation`, and local export inspection confirmed that bundle does not include `layout`, `pan`, or `drag`. Those features are in `domMax`. A recommendation to add `layoutId` everywhere without updating feature loading would be incomplete. Scope or lazy-load the richer feature bundle where needed, preserve strict mode, and measure the result. [Feature bundle documentation](https://motion.dev/docs/react-reduce-bundle-size).

Current React Router documentation also deprecates its older `Link viewTransition` prop in favor of React's built-in component. Avoid copying an older tutorial uncritically. The installed router version and selected integration still need an implementation check. [Current Link reference](https://reactrouter.com/api/components/Link).

## Visual refinement beyond motion

- **Hierarchy:** reserve the largest type and strongest contrast for the trip, next decision, relevant time, or personal balance. Let navigation, helper labels, and global tools recede.
- **Typography:** keep system fonts unless a tested display face materially improves brand recognition. Tune weight, line length, optical alignment, and line breaks first. Use tabular figures for times, money, and changing counts.
- **Surfaces:** use quiet groups and rules for related records, cards for distinct objects, and elevation for elements that actually float. Reduce repeated outlines without reducing required control contrast.
- **Images:** retain consistent crops, palette, and illustration style. Custom trip photos and the existing travel artwork are more useful than adding generic gradients or unrelated stock imagery.
- **Density:** on phones, reduce repeated metadata and large permanent sharing/help blocks before shrinking text or touch targets.
- **Copy:** use the existing organized-friend voice. Keep navigation literal. Distinguish “saved here,” “waiting to sync,” “shared,” and “downloaded.” The existing code already covers much of this; polish presentation rather than rebuilding the sync model.
- **Complete states:** review a long trip title, an empty trip, a failed upload, a partially downloaded trip, a pending/rejected edit, a 20-person group, and a long localized currency amount. These are follow-up states, not states all verified this turn.

## Accessibility and performance requirements

Honor the live reduced-motion preference already implemented in `MotionProvider`. Remove large travel/scale/parallax motion when requested, while retaining readable state changes. `MotionConfig` is not a substitute for handling CSS animations, canvas characters, or video separately. [Motion accessibility](https://motion.dev/docs/react-accessibility).

Drag must have both keyboard access and an equivalent click/tap path, such as Move earlier/later or Move to day. Keyboard support alone does not satisfy the separate dragging-alternative requirement. [W3C explanation](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements).

Profile transform and opacity first; large blur, shadows, and geometry changes can be expensive. Avoid per-frame React state updates across whole lists. Keep maps and PDF viewers mounted when navigation semantics permit; the current PageTransition explicitly avoids remounting them. [Browser animation guidance](https://web.dev/articles/animations-guide).

Use field Core Web Vitals as one release signal: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at the 75th percentile, segmented by device class. These are published general thresholds, not measurements of this project. They also do not measure whether a particular animation feels good. [Google's definitions](https://web.dev/articles/vitals).

The current build reports a 179.47kB minified MotionProvider chunk (60.55kB gzip), 229 precache entries totaling 8928.64KiB, and larger map/PDF-related chunks. Chunk names do not establish single-library attribution or initial execution cost. Public visits already defer offline registration. Measure first app entry on a constrained network before adding character/video/animation runtimes or changing offline coverage.

## Implementation order

1. **Refine hierarchy and remove friction:** compact returning-trip header; poll scoring before sharing; clarify add placement; show balances immediately. Reuse shared tokens and controls.
2. **Finish frequent interactions:** vote feedback, plan insertion, day selection, overlay dismissal, accurate ticket download feedback. Share one timing vocabulary and preserve recovery behavior.
3. **Author one memorable moment:** a short Stowie acknowledgment after a meaningful completion, or an improved user-controlled homepage preview. Judge whether it helps recognition or understanding.
4. **Evaluate direct manipulation later:** itinerary rescheduling or cross-day dragging is a product interaction with data rules, not a cosmetic animation task.

Do these as separate reviewable slices. A broad theme/primitive-library replacement is not justified by this audit.

## Acceptance checks for a polish implementation

- A frequent action responds immediately and does not wait for its animation to finish.
- A rapid second click/tap reverses or retargets the current motion; it does not queue stale transitions.
- Switching days repeatedly finishes with the correct selected day, content, focus, and URL.
- A modal can open, close, reopen during dismissal, receive focus, and restore focus correctly. Touch scrolling and the on-screen keyboard work on a physical iPhone.
- Entering Money shows the exact balance immediately. Live updates, negative values, currency changes, and reduced motion never leave a misleading intermediate value as the only accessible amount.
- Failed saving retains input and allows retry; pending and shared success remain distinct.
- Background group updates preserve the active field, pointer target, and scroll position.
- Phone, tablet, desktop, 200% zoom, dark mode, reduced motion, keyboard, and representative assistive-technology checks cover the changed interaction.
- Profile an older phone or realistic CPU throttle while the map and local sync are active. Record frame behavior rather than promising “60fps” from the choice of library.
- Compare with a static alternative in a small task study. Ask travelers to find the next event, cast a vote, add an item, locate a ticket, and understand their balance. Record completion, hesitation, and mistakes separately from visual preference.

## Verification executed

| Check | Outcome |
| --- | --- |
| `npm run build` | Passed; existing large-chunk advisory remains. |
| `BASE_URL=http://127.0.0.1:4193 SHOTS_DIR=.design/screenshots/research-2026-11-03 npx playwright test tests/e2e/screens.spec.ts --grep 'light mode'` | 2 tests passed; 19 screens at each of 390px and 1440px, with document-overflow and page-error assertions. Captures use reduced motion. |
| `BASE_URL=http://127.0.0.1:4193 npx playwright test tests/e2e/polish.spec.ts --grep 'example days update\|preview reflows\|vote failure'` | 3 tests passed: interactive preview changes without layout shifts/lost focus; long-content reflow and live reduced-motion changes; failed voting and rapid retry with one saved revision. |
| Local exports | React 19.3.0 exports `ViewTransition`; Motion `domAnimation` omits layout/drag while `domMax` includes them. |
| Conversation motion comparison | Script syntax checked; sample selection, rapid retargeting, and feedback passed automated Chromium checks. At 320px with dark appearance and reduced motion: 288px iframe content width, 288px scroll width, zero running animations, and no page exceptions. Desktop/light and phone/dark captures visually inspected. This is an illustrative CSS/WAAPI specimen, not a product change or a benchmark of the proposed React implementation. |

Animation frame rate, interrupted ticker behavior, dialog exit sequencing, live multi-device sync, production network behavior, physical iOS gestures, and full accessibility were not verified.

## Rejected or deferred candidates

- Do not report the previous missing-destination handoff or unhandled vote save as new findings: main already includes destination propagation and local-save/retry feedback.
- Do not treat the illustrative homepage map as a real geographic basemap; it is explicitly labeled as illustrative.
- Do not replace every native dialog solely to obtain an entrance animation. It already has useful modal behavior.
- Do not introduce GSAP, React Spring, AutoAnimate, and Motion together for the same interaction.
- Do not delay itinerary reading with scroll reveals, stagger every row, replace native scrolling, or add cursor effects to the travel workspace. These proposals add movement without an established travel task benefit.
- Do not interpret these preferences as evidence that a full redesign is required.

**Verdict: Needs changes for the proposed polish standard, within the inspected surfaces.** The existing system is a sound base; targeted hierarchy and interaction work is justified. No whole-product release, security, accessibility, or performance approval is implied.
