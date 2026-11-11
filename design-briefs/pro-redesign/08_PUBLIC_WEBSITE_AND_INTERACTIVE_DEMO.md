PHASE 08 — Product-led public website and a genuinely useful live demonstration
Read master and existing progress. The public site already has a specific, recently refined long luggage-tag design, functional navigation, and branded Stowaway examples. Preserve this identity. This phase is not an excuse to rebuild the site as a typical SaaS hero/cards/testimonials page. Prioritize conversion clarity and faithful representation of the polished app you just built.
Inspect
src/features/website/{LandingScreen,WebsiteFrame,HowItWorksScreen,PricingScreen,OrganizersScreen}.tsx, stage/{HeroDemo,Features}.tsx, stage/kit/, tag.css, website.css, marketing.css, docs/BRAND.md, current sitemap/metadata/prerender and tests/e2e/website*.spec.ts. Compare to Phase 02–07 actual app states. Read existing .design/website-polish-report.md and landing refinement notes before editing.
Brand and conversion direction
- Headline remains "Plan a trip with friends." Supporting copy explains exactly how people save places, vote, build an itinerary, and keep tickets/expenses together. Feature descriptions must not claim Stowaway books travel or moves money.
- Create a trip is the obvious primary path; Join trip is available without friction; Open app/returning-user path remains clear. No account or installation required for first participation.
- Preserve the ocean ink + thermal-stock page, authentic suitcase mark and printed route/tear details. Perforations/route codes are purposeful identity accents, not an excuse for every line to be decorative. Keep text easy to read on phones.
- Use real product artifacts, not invented reviews/stats/awards/customer logos or stock tourism photography that conceals the software.
- Clearly separate group travel planning from organizer payment tools (early access). Do not bring organizer revenue messaging into the primary hero.
The hero demo: fix the 'scripted but looks clickable' problem
Current stage/HeroDemo.tsx plays a scripted Paris voting sequence with Replay; the animation is wrapped as illustrative content and is not the same as a visitor-controlled vote. This is good at storytelling, but misses a chance to convey agency. Implement a genuinely interactive, self-contained sample if it can be accessible and visually clear without undue complexity:
1. Present a clearly labeled Example trip · Paris with the actual Stowaway four-point voting model: choose a response for one example option (e.g. Le Marais); show the immediate update in the sample result; demonstrate the corresponding plan action.
2. Crucially, do not imply that Stowaway automatically books or schedules a winning vote. A label or explicit Put the winner in the example plan control must make the simulated handoff honest. A winning vote is not a booking.
3. Keep this example entirely local/deterministic; it must not write to any real trip, database, analytics or payment service. Show a Reset example affordance.
4. Mouse, touch and keyboard must all work; sample choices use actual button semantics rather than pointer-only visual elements. Respect reduced motion, focus state, live-region announcements and small screens.
5. If the vendored Stage/`role="img"` architecture makes a legitimate accessible interaction brittle, do not force controls into an illustration. Instead preserve the current animation as honestly labeled a noninteractive demonstration and add a clearly separate accessible interactive widget immediately below or beside it. One coherent demo is better than two competing flashy films.
6. Animation should communicate vote feedback and plan placement, not delay real controls or hijack scrolling. If user interaction begins, scripted autoplay must stop rather than overwrite their selection.
7. Maintain a meaningful still representation without JS, under reduced motion, and for screen readers. If the screen is purely illustrative, a short accurate accessible description is better than dozens of exposed fake form elements.
Refine secondary proof, not more noise
- Review stage/Features.tsx for excessive simultaneous staged animations or repeated information. Preserve concrete examples (plan, offline, tickets, group, expenses) but reduce competing motion; a feature grid is not inherently a problem if each tile demonstrates a different capability.
- Ensure How it works describes the actual creator → invitee → group vote → plan → offline process after the app redesign. Avoid copy promising automatically offline-ready maps or tickets from installation alone.
- Consistency across homepage, Help and FAQ: access permissions in normal group mode, optional accounts, offline preparation, financial limitations, pricing/early-access truth.
- Conversion CTAs are plain, specific and consistent. Do not litter every feature with the same coral button. The primary action should remain distinct.
- Keep prerendered public HTML, metadata, canonical URLs, sitemap, manifest /app launch behavior, existing redirects and offline fallback intact. No JS-only empty page on search crawlers.
Test/verify
1. New visitor at 320, 390, 768, 1280, 1440, 1920; laptop fold 900px tall; dark mode, text scaling and reduced motion. First useful viewport clearly shows what Stowaway is and how to start.
2. Interactive example: mouse/touch/keyboard vote; visible state change; explicit plan decision; reset; no fake write/network; screen-reader accessible controls if interactive.
3. All CTA navigation: Create, Join, Open app, How it works, Pricing, Organizers, Help and FAQ links; returning PWA users continue to /app without breaking history.
4. No horizontal overflow, focus traps, autofocus surprises, hydration mismatch or enormous cumulative layout shift from staged animation.
5. Inspect bundle/performance impact; do not add another animation framework or oversized image assets. Compare actual sizes and runtime behavior before claiming improvement.
6. Existing marketing tests and public metadata/pre-render tests pass; run any changed screenshots manually in browser.
Exit bar
A visitor understands why Stowaway replaces several disconnected travel tools from a concrete example and can immediately create or join a trip. The site feels like the same brand as the application but has its own editorial character. No fabricated product capability or decorative bloat. Record the exact checks and screenshot evidence in PROGRESS.md.
