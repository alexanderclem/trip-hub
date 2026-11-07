# Preference-based trip planning

Entry points: Home → **Help me plan**, New trip → **Need a starting point?**, or a trip’s More → **Trip ideas & travel preferences**. The Plan tab also links to ideas.

All of these now open **Stowie**, a chat that collects the brief and shows drafts (`docs/STOWIE.md`). The form described below is its **Edit by hand** view at `/inspire/manual` and `/t/:tripId/more/ideas/manual`; profiles, matching, drafts and the Worker endpoint are shared by both.

## Opening quiz (`src/features/onboarding`)

The public website is at `/`. Trip entry is at `/app`. Creating or joining opens the trip immediately. Home offers the optional quiz at `/quiz?next=<path>`. The quiz is 10 this-or-that scenarios (`quiz.ts`); each answer carries small positive and negative weights on several axes. `scoreQuiz` starts every axis at 50 and moves it towards 100 or 0 in proportion to how far that axis could go across all questions, rounded to 5. Unit tests check that every axis can reach ≥65 and ≤35 and that no question carries more than 40% of an axis.

- **Optional preferences:** `afterEntry(path)` (`profile.ts`) returns the requested destination. It adopts an existing member profile when available. Home offers "Set your travel preferences" until the device has a profile or the person skips the quiz. Shared vote links open the vote directly. No quiz interrupts trip entry, saved tickets, or other deep links. Account restoration also adopts existing profiles.
- **Welcome:** trip entry opens the overview with `?created=1` or `?joined=1`. Stowie offers the next action once, on arrival. Creators can invite friends or save an idea. Joiners can open votes or the plan.
- **Skip:** "Skip for now" sets `quizSeen` on the device; the quiz can be taken later from Trip ideas ("Take / Retake the quiz").
- **Saving:** the result becomes the device profile and, when the quiz came from inside a trip, that trip's `member_preferences` row (description and constraints are kept). `useSeedMyProfile` copies the device profile into any other trip that has no row for this person, but only after a sync has finished, so it never overwrites a profile another phone saved.
- **Tests:** `playwright.config.ts` starts browser contexts with the quiz skipped. `tests/e2e/first-run.spec.ts` tests immediate trip entry, optional preferences, and direct vote links with Supabase stubbed. `tests/e2e/onboarding.spec.ts` tests creation, the optional quiz, and a second phone joining against live Supabase. `profile.test.ts` covers `afterEntry`.

## Profiles and matching

Eight independent, editable scores from 0–100: adventure, nature, culture, food, nightlife, relaxation, comfort, and budget consciousness. High budget consciousness means saving money matters. Unknown interests start at 50. AI infers only interests from the user’s description; users review and save the result. Classification describes the two strongest interests at 65 or above, otherwise “Flexible traveler.” It is not a demographic or personality assessment.

A personal profile stays on the device, and is copied into a member profile in every trip this person is in (see the opening quiz above). Trip profiles use separate `member_preferences` rows with stable IDs, the standard offline outbox, realtime hints and pull sync. Only devices claiming that member can write their profile; joined devices can read the group’s profiles. Constraints are shared with the group.

The group radar shows equal-weight average scores, individual scores and min/max ranges. Missing profiles are excluded. A range of at least 45 flags differing tastes. Travelers can be included or excluded; constraints remain separate text per traveler. Preference matching is `100 − mean absolute difference` across the eight axes. “Find a fit for everyone” weights the weakest individual fit 60% and average fit 40%; “Favor the group average” uses just the mean. These scores measure preference similarity, not verified quality. Selected focus axes must score at least 65; filtering and reranking saved drafts work offline.

## AI and drafts

`POST /api/travel-ai` runs in the existing Cloudflare Worker and calls DeepSeek (`worker/deepseek.ts`): the `DEEPSEEK_MODEL` from `wrangler.jsonc` (`deepseek-flash`, V4.1 Flash) in JSON mode, thinking off, with the reply's JSON Schema appended to the system prompt. Approved by the owner on 6 Nov 2026 (it was Workers AI Llama before). `DEEPSEEK_API_KEY` is a Worker secret; without it the endpoint answers 503. An empty balance returns an error, never a fabricated fallback.

The endpoint checks the Supabase session, trip access when applicable, same-origin requests, body size, rate limits and input/output schemas. Profiles, brief, selected travelers, existing places and existing plan are sent to the model. One or up to three ideas are generated, with at most 14 days; longer drafts request one idea to keep responses within output limits. Prices and availability are estimates; no live search or bookings occur.

Every generation has a unique ID and is saved to the local `ai_drafts` table. Draft history survives reload and works offline. Applying a draft writes places, tentative itinerary items, tasks and outbox entries in one transaction. Duplicate application is prevented, cross-trip place IDs are rejected, date bounds and overlaps are checked. Known places retain verified coordinates; new suggestions have no coordinates until a user verifies them. Generated items use the trip timezone. Refinement produces a new draft with the prior idea as context. Refining an applied idea replaces only its unedited, unreferenced additions; confirmed and edited items remain protected. Replacement is atomic: if the new draft conflicts with a protected item, all changes roll back.

Undo removes only unchanged generated additions. Edited, booked, or referenced entries and their linked places are retained. Sticky tombstones mean an undone draft cannot be reapplied; generate a new version. Personal drafts are visible only on the generating device; applied plans use normal trip sync.

## Activation

1. `public.member_preferences` exists on the live project (created outside the migration history, so `list_migrations` does not show `20261007000001`). The sync engine expects the table.
2. Build with `npm run build`, then deploy the existing Worker with `npx wrangler deploy`. `wrangler.jsonc` declares the AI, rate-limiter and static-assets bindings, public Supabase variables, and API routing. Keep the account on Workers Free to retain the $0 constraint.
3. Verify trip generation and cross-device preference sync after activation. Live profile inference was verified after deploying the model repair: the retired Llama 3.1 binding returned Cloudflare error 5028, and the supported Llama 3.3 binding successfully changed all explicitly stated interests and updated the chart. Errors and explanation now appear beside the suggestion button. Structured Worker logs identify the failing stage without logging descriptions or authentication tokens.

For UI development, `npm run dev` works for profiles and saved drafts; generation displays a connection error without the Worker. For a complete local Worker, first build then run `npx wrangler dev`; connecting AI to Cloudflare requires authentication and uses the daily allocation. The browser suite mocks those boundaries and does not write live trips:

```text
npm run typecheck
npm test
npx playwright test tests/e2e/discovery.spec.ts
npx wrangler deploy --dry-run
```

Workers AI references: [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/), [JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/), [rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [static asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).

## Ideas model

Ideas, profile inference and Stowie's chat all use DeepSeek since 6 Nov 2026. On Workers AI the
smaller `@cf/meta/llama-3.1-8b-instruct-fp8-fast` overlapped times, titled activities "Day 1" and
repeated titles as notes. Each request
still asks for one draft with two concise activities per day, and `tidyIdea` repairs overlaps and
echoed text before a draft reaches the phone. No automatic retry consumes additional allowance.

DeepSeek is prepaid: spending stops when the balance runs out, and `AI_RATE_LIMITER` (6 a minute per
person and per IP) caps how fast it can go. Workers AI is now used only by receipt and ticket scans.

**Places and pins.** An activity's `placeName` must be a real venue name. Applying a draft links it to
the trip's same-named place (accents, case and a "Hotel" prefix ignored; `findKnownPlace`), else
creates a planned place that `useAutoLocate` pins from OpenStreetMap once online. Items carry
`details.ai_draft_id`, which the plan shows as a small "AI" flag; the notes no longer repeat the caveat.

Ideas generation does not call Google Routes. Traffic-aware driving remains an
explicit user action in Place detail, with no background or all-pairs requests.
