Stowaway professional-grade redesign — Codex prompt pack
Codex adaptation: assistant references use Codex. Existing `CLAUDE.md` paths are preserved because they name the repository's actual guidance; also read any applicable `AGENTS.md`. Do not rename or overwrite either guidance file.
These prompts are designed for separate Codex sessions/passes, in order. They were tailored against the November 10, 2026 alexanderclem/trip-hub codebase; your local checkout may differ. No live product code is modified by this prompt pack.
Quick start
1. Place this folder inside the repository, e.g. design-briefs/pro-redesign/. Do not replace CLAUDE.md or DESIGN.md.
2. Start Codex in the repo. Paste the short launcher at the bottom of this README, changing the folder path if necessary.
3. Let Codex finish each phase and report code changes plus tests. Review the screenshots and the .design/pro-redesign/PROGRESS.md log before sending the next prompt.
4. Run one phase per branch/commit or small vertical slice. Keep a backup/clean git status before beginning. Do not push to live or deploy until separately approved.
5. If Codex has a screenshot/browser tool, require it to use that tool. If unavailable, require explicit static-only limitations, not confident UI claims.
Sequence
Phase	File	Outcome
00	00_MASTER_BRIEF.md	Unchanging quality and safety contract, read every session
01	01_BASELINE_AND_UX_ARCHITECTURE.md	Audit current implementation, task journeys, target navigation, design plan, baseline captures; bounded plan
02	02_APP_SHELL_AND_DESIGN_SYSTEM.md	Unified shell, predictable navigation, clean headers/controls/tokens; working UI
03	03_CREATE_JOIN_AND_INVITE.md	Effortless first trip, invite, joining, role/permission clarity
04	04_TRIP_HOME_AND_LIFECYCLE.md	Phase-aware, task-first trip home; no repeated dashboard noise
05	05_ITINERARY_PLACES_AND_MAP.md	Excellent daily plan, frictionless adding, clear map/place connection
06	06_GROUP_DECISIONS_AND_VOTING.md	Voting genuinely connected to choices and itinerary, with correct semantics
07	07_TICKETS_MONEY_OFFLINE_AND_SYNC.md	Travel-day usability and trust: tickets, correct balances, honest offline status
08	08_PUBLIC_WEBSITE_AND_INTERACTIVE_DEMO.md	Product-led marketing, clear conversion, user-controlled demonstration
09	09_FINAL_POLISH_ACCESSIBILITY_AND_REGRESSION.md	Cross-product testing, screenshot review, polish, release readiness verdict


Visual reference attachment strategy
Do NOT ask for generic AI UI inspiration screenshots. Codex should make fresh Playwright screenshots of the actual local application and analyze its genuine behavior. As additional images, attach (or direct Codex to inspect) these existing, historical repo screenshots, labeling them BEFORE / reference, not the target state:
- .design/screenshots/research-2026-11-03/light-overview-390.png
- .design/screenshots/research-2026-11-03/light-plan-390.png
- .design/screenshots/research-2026-11-03/light-vote-poll-390.png
- .design/screenshots/research-2026-11-03/light-money-390.png
- .design/screenshots/research-2026-11-03/light-map-390.png
- .design/screenshots/research-2026-11-03/light-tickets-390.png
- .design/screenshots/app-consistency/landing-1440.png
- .design/screenshots/travel-experience/overview-phone.png
These may predate November 5 fixes. Codex must prioritize fresh captures and current code. If using separate inspiration imagery, describe the specific principle (e.g. typographic clarity, time-based scanning, consistent navigation) and never recreate another product's exact interface, logos, or proprietary illustrations.

For a visual checkpoint, ask Codex to create a named contact sheet that compares before and after at identical viewport and fixture, and annotate: primary action visibility, scroll depth to next task, duplicates removed, error states, and any regression.
Single-turn launcher (paste into Codex)
We are executing the Stowaway professional-grade UX redesign. Read design-briefs/pro-redesign/00_MASTER_BRIEF.md and then design-briefs/pro-redesign/01_BASELINE_AND_UX_ARCHITECTURE.md in full. Obey local CLAUDE.md and all existing product constraints. This is a real product implementation program, not a visual mockup or generic redesign. Execute Phase 01 end-to-end. Work only on a safe local branch/worktree; no push, deploy, live data, or destructive changes. When finished, give me the actual files, screenshot paths, test results, decisions, and remaining issues. Make the next phase runnable without revisiting already settled questions.
For each following phase, replace the phase file in that launcher with its numbered .md and tell Codex to read .design/pro-redesign/PROGRESS.md first.
Managing scope and quality
- Avoid one huge "redesign all screens" agent run. Split work into vertical slices and inspect screenshots after each.
- The master brief is not a license for visual regressions in unaffected screens. Preserve working behavior and fix verified findings, not hypothetical defects.
- Do not chase a fake 10/10 by drawing beautiful mockups; the goal is real usability and real data preservation.
- If testing reveals the proposed navigation is worse, take evidence seriously and use the better configuration; write down the decision.
- Collect qualitative user-test feedback after Phase 04 and Phase 07 if possible. Screenshots and automated tests cannot substitute for real user comprehension.
