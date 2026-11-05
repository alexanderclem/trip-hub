# Landing page refinement — November 4, 2026

Scope: simplify first-visit reading of the luggage-tag homepage while preserving its visual direction and interactive trip. Applied Design Partner's refine workflow, with React and verification guidance for the implementation checks.

## Findings and changes

- The original sections often explained their preview, then repeated the explanation or example qualification beneath it. Shortened each to a benefit heading and one supporting sentence. Consolidated demonstration context into the accessible, visible “Example trip · Guatemala” field above the route.
- Shortened the introduction and tear-stub subtitles. Kept the headline, route lettering, passenger manifest, perforations, barcodes, colors, and example interactions.
- Mobile navigation previously combined destination codes and feature labels, pushing later sections outside the viewport. Below 1100px it now shows the feature labels; desktop retains the routing rail. All seven labels fit at 390px in Chromium and WebKit.
- Reduced the organizers section to a heading and destination link. Removed the FAQ introduction and shortened its answers. Offline preparation, separate map downloads, invite-link privacy, and money-movement limits remain in the FAQ.
- Join feedback appears after a name is selected instead of an instruction repeating the invitation above it. Retained the live status region and space for feedback.
- Removed the unused Stop leg prop/import and styles tied to deleted notes. Updated DESIGN.md with the copy and navigation rules.

Existing reports describe earlier homepage versions; their specific layout prescriptions were not applied to the new luggage-tag composition. Their relevant principles—specific product evidence, readable copy, clear primary actions, accessible controls—remain intact.

## Verification

- `npm run build` and `npm run typecheck`: passed. Build reports existing large map-related chunks.
- `git diff --check`: passed.
- `website.spec.ts`: all 13 existing Chromium checks passed. Covers create/join entry, interactive example, FAQ, keyboard use, 320–1920px reflow, 200% text scaling, reduced motion, contrast, and laptop action visibility.
- Two existing homepage tests in `polish.spec.ts`: passed, including vote-to-plan feedback without network requests, layout shift or lost focus, and long-text reflow.
- Two focused `ux-patterns.spec.ts` checks: passed for prerendered public HTML/metadata and dark mode/reduced motion/enlarged text. An initial concurrent run collided over Playwright's shared artifact directory; rerunning the affected check in its own output directory passed.
- Additional browser walkthroughs in Chromium and WebKit at 390px light and 1440px dark: passed route navigation, voting, airplane-mode toggle, and name selection without page exceptions or document overflow.
- Visually compared the original and refined desktop/mobile homepage. Inspected dark-mode rendering. Local after captures are in ignored `test-results-design-pass/`.

Verdict: the requested refinement is implemented and checked locally. These browser checks do not establish physical iPhone/Safari behavior, screen-reader conformance, or live production behavior. No deployment or server-side trip creation was performed.
