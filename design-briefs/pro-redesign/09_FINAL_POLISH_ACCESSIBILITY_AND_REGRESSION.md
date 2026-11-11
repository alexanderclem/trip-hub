PHASE 09 — Professional-grade finish, adversarial UX review, and release readiness
Read master, full .design/pro-redesign/ trail, and this prompt. This is a cross-product finish and release-quality check. Reopen changed implementation critically. Do not say "done" merely because TypeScript compiles or one screenshot looks attractive. Correct real flaws found in this phase. Do not deploy.
First: audit implementation against the target, not original intentions
- For each change promised in phases 02–08, identify the real code path and a screenshot or executable scenario proving it. Close findings only after verification; preserve unresolved issues rather than quietly dropping them.
- Run a consistent before/after visual comparison of phone and desktop. Check whether Home genuinely puts priority ahead of chrome, Plan is scannable, join is effortless, votes are understandable, Ticket and offline statuses are trustworthy, and marketing accurately demonstrates the product.
- Inspect all major routes, not only the hero and three showcase screens. Avoid the classic trap of exceptional Home and broken second-level screens.
Mandatory end-to-end task script
Run with deterministic, privacy-safe local fixtures; test realistic state changes, not static screenshots:

Journey 1 — First-time group organizer
1. Visit public homepage; understand product and locate Create.
2. Create a trip with name, creator, destination and dates (test omitted optional fields too).
3. Invite via Share/Copy with accurate access warning.
4. Add places, create vote, add activity; navigate via phone tabs and back.
5. See the new trip again on returning Home; no duplicate creation or unnecessary onboarding.
Journey 2 — Invited friend
1. Open invite link, recognize the actual trip, choose or add name.
2. View plan, find one open vote, cast and change a score (0/1/2/3/skip), understand pending vs closed state.
3. Follow shared poll deep link and return to correct task.
4. Access ticket and see if available locally; do not require signup, quiz or app install.
Journey 3 — Active traveler with limited network
1. Show next event, correct trip-zone time, actual transfer guidance where available.
2. Open the event's ticket; inspect saved-on-this-phone state.
3. Open relevant map/place; ensure offline map is genuinely present or show truthful failure.
4. Add an expense offline; verify local persistence and explicit queued-sync status.
5. Reconnect and verify accepted vs rejected changes and recovery UI; do not mistake the absence of an alert for success.
Journey 4 — Complicated trip
1. 14+ day multi-city itinerary; overlapping activities, different attendee subsets, incomplete location.
2. Reschedule correctly across time zones/DST; view conflicts; never silently change confirmed booking status.
3. Long trip/member/place names, 20 travelers, 30 tickets and many expenses.
4. Hosted restricted user, permission changes mid-session, removed invitee, cross-device identity variation.
Journey 5 — Completed trip
1. View trip recap, unsettled balances and settlement suggestions.
2. Verify nothing implies that sending money occurred when it did not.
Visual craft checklist
- Page title and primary task obvious at a glance; no empty hero padding pushing tasks off phone.
- Strong typography hierarchy with consistent Barlow weights and controlled decorative Antonio usage.
- Shared alignments, semantic spacing, deliberate grouping and legible subtext.
- Consistent borders, radii, shadows, selected controls and screen headers across the app.
- No unnecessary card-in-card nesting, full-width primary buttons everywhere, purple/gradient blur/glass patterns, arbitrary icon decorations or unrelated illustration.
- Real content holds up to long strings, sparse states, huge lists and dark mode. No truncated critical amounts, times, titles or status.
- Brand recognizable without decorating every operational screen as a luggage tag.
- Motion supports actions, interruptible and unobtrusive; no endless loops or page-scale entrance on frequent navigation.
- Unique active nav state, action visibility, no sheet/FAB collision with bottom tabs/keyboard/safe areas.
Accessibility review
- Keyboard-only full journeys: Tab/Shift+Tab, Enter/Space, Escape, day tab arrow keys, dialog open/close and return focus, search, list-to-detail and back, share and error recovery.
- Programmatic labels, roles, states, helpful descriptions, status/error announcements, stable focus; heading hierarchy; buttons not disguised divs; decorative imagery hidden from accessibility tree.
- WCAG AA contrast checks using computed effective colors for meaningful text and controls; no color-only status.
- Test 320px CSS reflow, 200% browser zoom and 200% text size separately. Input font >=16px and mobile touch controls >=44x44 CSS px where required by current project rules.
- prefers-reduced-motion across website and app; no essential state visible only through animated sequence.
- Accessible non-pointer alternative for maps and gestures. Test iPhone Safari if actual device is available; if not, explicitly leave physical-device and VoiceOver verification as open coverage gaps.
- If an automated audit flags a possible issue, inspect the DOM and actual behavior before accepting or dismissing; automated scores do not prove real accessibility.
Performance and engineering checks
- Measure app entry and main task responsiveness using available devtools/Lighthouse/Playwright traces if supported. Keep baseline and after numbers with context, and don't invent field data or claim Core Web Vitals improvements without measurement.
- Inspect JS/CSS chunk changes, image sizes, duplicate fonts, eager map/PDF loads, layout shift, excessive re-renders and extra fetches. Maintain current offline precache behavior; don't optimize by breaking offline entry.
- Confirm no React hooks order problems, key instability, stale closure, accidental duplicate work, unsafe empty-state assumptions or unnecessary dependencies.
- Test existing security/permissions/sync/money logic as appropriate; any functional changes to them require direct regression coverage. No real email, checkout, booking or schema change as part of this redesign.
- Check failed local writes, delayed sync, permission denial, read-only screens and offline recovery for errors not hidden by polished visuals.
Mandatory verification commands, adapt to actual package.json
- npm run typecheck
- npm test (or documented supported full unit command; report exact invocation and pass/fail counts)
- npm run build
- Relevant Playwright suites, ideally full tests/e2e/ against local production preview; explicitly identify skipped and unsupported suites.
- git diff --check
- Inspect git status to identify unrelated changes; never overwrite them.
Where a test cannot run (e.g. live Supabase, physical Safari, screen reader), be precise about what was not verified. Don't claim deploy-ready if a material flow remains untested.
Research/QA scorecard
Give each dimension a reasoned score from 0–4, not false 9.8/10 precision: product clarity, information hierarchy, task completion, readability, component coherence, mobile usability, desktop layout, accessibility, resilience/offline truth, perceived responsiveness, credibility. Link each score to screenshots or interaction notes and distinguish subjective judgment from measured outcomes.

Declare findings HIGH if the primary task is blocked, data loss is possible, controls are inaccessible, critical status is misleading or important information is unreachable. MEDIUM for meaningful effort/confusion, LOW for isolated polish. Don't downgrade confirmed accessibility barriers to "nice-to-have."
Final artifacts
- .design/pro-redesign/FINAL_REVIEW.md: summary of what changed vs preserved, severity-ranked remaining issues, scorecard, observed usability, verification gaps, and scoped verdict Block / Needs changes / Approve.
- .design/pro-redesign/TEST_RESULTS.md: exact commands, pass/fail counts, fixture conditions, screenshots and links to relevant tests.
- .design/pro-redesign/SCREENSHOT_INDEX.md: before/after path pairs for at least Home (4 phases), Plan, Explore/Map, Vote, Money, Tickets, Offline, Join and Landing on phone; key desktop comparisons.
- .design/pro-redesign/PROGRESS.md: all phases complete or transparently open; no concealed failures.
- A release handoff checklist describing what the owner should personally test on physical iPhone/Safari and which steps precede deployment; no automatic deployment.
Definition of done
An unfamiliar friend should be able to get into a trip and participate; an organizer should be able to form a viable plan; a traveler should be able to retrieve essential information under time pressure and without signal. The app should feel coherent, trustworthy and intentionally designed at every important state—not just visually impressive. Provide a candid final verdict and targeted follow-ups. Make repairs now within scope rather than producing a report and walking away.
