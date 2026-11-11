# Stowaway professional redesign — progress

Updated November 10, 2026. Branch `codex/pro-redesign`, isolated worktree `C:/Users/alexa/Downloads/new/ecoai`, baseline `69ea398`.

## Current state

The 11 supplied prompt files were extracted into `design-briefs/pro-redesign` and assistant references changed from Claude Code/Claude to Codex. The standalone supplied master brief matched the bundled master exactly after conversion. `CLAUDE.md` filenames are retained because that is the actual existing repository guidance; those files were neither renamed nor overwritten.

Phase 01 is the bounded discovery pass requested by the prompt pack's launcher. It produces the implementation architecture and fresh baseline; it does not redesign the application in this phase. Original checkout and other worktrees are preserved. No push, deployment, production writes, schema/service/payment changes or new dependencies.

## Phase ledger

| Phase | Status | Evidence / next action |
| --- | --- | --- |
| 00 Codex brief conversion | Complete | 11 real Markdown prompt files; master comparison matched. |
| 01 Baseline and architecture | Complete, with explicit coverage gaps | CURRENT_STATE, TARGET_EXPERIENCE, IMPLEMENTATION_PLAN, BASELINE_TEST_MATRIX, local screenshots and reproducible fixture. This is discovery completion, not product approval. |
| 02 Shell and system | Not started | First fix UX-01 foreground/surface cascade and UX-08 missing roster destination, then UX-03/06 dimensions. |
| 03 Create/join/invite | Not started | UX-02: install is separate from per-phone preparation. |
| 04 Home/lifecycle | Not started | Preserve existing simplification; refine only current evidence. |
| 05 Itinerary/places/map | Not started | Preserve day/deep-link state; verify map's actual prepared/unprepared behavior. |
| 06 Decisions/voting | Not started | Preserve manual handoff and both form contracts; refine UX-07. |
| 07 Tickets/money/offline | Not started | UX-04 personal hierarchy; truthful file/sync/readiness states. |
| 08 Website/demo | Not started | UX-05 explicit human plan action and accessible actual interaction. |
| 09 Final regression/release review | Not started | Full scorecard and release handoff after implementation; no deployment. |

## Findings ledger

| ID | State | Priority / owner phase |
| --- | --- | --- |
| UX-01 | Open, observed in both themes | HIGH; 02. White-on-white priority title/detail, 1:1 light contrast. |
| UX-02 | Open, source-confirmed preparation claim | HIGH; 03 with 07 wording consistency. |
| UX-03 | Open, runtime measured 40px | MEDIUM; 02. Shared 44px target restoration. |
| UX-04 | Open, eight-person visual evidence | MEDIUM; 07. Personal settlement/history hierarchy. |
| UX-05 | Open, observed scripted illustration | MEDIUM; 08. Interaction/plan handoff clarity. |
| UX-06 | Open, 12px source rule | LOW; 02. Caption floor for tab labels. |
| UX-07 | Open, visual hierarchy judgment | LOW; 06. Next unfinished decision step. |
| UX-08 | Open, clicked and reproduced | HIGH; 02. Home group count opens a missing roster route. |

## Files touched and preservation

- Added the converted prompt folder; no existing guidance replacement.
- Added `tests/e2e/pro-redesign-baseline.spec.ts` for safe, deterministic Paris screenshots and real local interactions.
- Added this report directory, screenshot metadata and contact sheet. Browser fixtures seed local stores; user edits under test still use the actual product save/outbox code.
- Ignored `.env.local` uses a dummy hostname/key; ignored dependency junction reuses existing packages; ignored logs/traces live in `output/pro-redesign`.
- No application source, routes, schemas, financial math, sync engine, master assets or actual traveler records changed.

The current implementation already contains November 5 MS-01–05 changes, sync race/rejection safeguards, immediate money values, duplicate-Add suppression and accessible native modals. They are recorded as strengths, not incorrectly reopened findings.

## Verification

- Typecheck passed, including the new browser fixture.
- Full unit suite: **795 passed in 106 files**.
- Production build passed, with existing chunk/native-config warnings; no measured performance claim.
- Seven existing local/mock Playwright suites: **63 passed**.
- Final Paris suite: **18 passed** in 60 seconds. One evidence-collection scenario deliberately records the broken roster destination; it does not assert the roster works. Known visual/copy failures also remain open despite scenario passes.
- Combined browser checks: **81 passed** (63 existing + 18 new); no skipped checks in these selected runs. Live-service suites were not selected.
- `git diff --check` and staged diff whitespace check passed at handoff.
- Contact sheet generated from **78 actual PNGs**; local browser rendering and filtering checked (10 Money captures after filtering). Prompt ZIP is at ignored `output/Stowaway-Codex-prompt-pack.zip`.
- Fresh captures cover core 390/1440 routes, representative 320/768 adaptation, both themes, lifecycle/permissions, enlarged text, CSS zoom, missing and present tickets and failed preparation. Actual images were inspected; visibility assertions alone missed UX-01.

## Tradeoffs, verdict and next pass

Retain Home / Plan / Map / Vote / More. Promoting Money while replacing Vote/Map would introduce a new navigation and discovery problem without user evidence. Keep contextual access to expenses and tickets. This choice is a design decision supported by route/task inspection, not a measured preference study.

**Phase 01 verdict: Pass for the bounded discovery/evidence scope, with documented coverage gaps. Product verdict: Needs changes; not release-approved.** UX-01, UX-02 and UX-08 remain open because Phase 01 expressly excludes product-source edits. This baseline does not count as completing Phases 02–09. Physical iPhone/Safari/VoiceOver, successful Paris map preparation, live cross-device behavior, toolbar zoom and novice usability remain unverified.

**Next pass:** read this file and `design-briefs/pro-redesign/02_APP_SHELL_AND_DESIGN_SYSTEM.md`; implement UX-01 and UX-08 first, then shared target/type corrections. Do not rerun broad discovery or change the tabs. Keep exact baseline fixture/clock/viewport pairs for before/after comparison.

## Original Phase 01 local handoff

All 102 new prompt/evidence/script/test files are staged for review on the isolated branch. No commit was made: `git var GIT_AUTHOR_IDENT` reports that this repository has no configured author name/email. No author identity was guessed or global Git configuration changed. Nothing was pushed or deployed. The dummy-config preview remains at `http://127.0.0.1:4194`; real backend-dependent features are intentionally unavailable there.

## Deployment authorization — November 10, 2026

The user subsequently requested “deploy all changes,” authorizing publication of the current Phase 01 changes through the existing main → Cloudflare Workers build pipeline. This supersedes the earlier local-only restriction for this release. It does not claim completion of Phases 02–09 or fix the documented product defects.

The connected GitHub account verified the repository author's email, permitting command-scoped commit identity without changing global Git configuration. The release is built in a clean checkout with tracked production configuration. Ignored dummy `.env.local`, build output, dependency junctions, logs and traces are excluded from the commit and deployment source. The deployed product interface is the existing interface because this change contains prompts, reports, synthetic screenshots and test/evidence tooling, not app-source edits. Deployment status and public health checks are reported at handoff.
