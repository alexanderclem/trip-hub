# Trip Hub

A shared trip-planning PWA for a group of 8+ friends. The first trip is spring break 2027 in
Guatemala (Antigua + Lake Atitlán), but nothing may be Guatemala-specific except seed data.
Live at https://trip-hub.alexanderclem12.workers.dev. Repo: github.com/alexanderclem/trip-hub.

## Hard constraints

- **$0, no credit card, no business verification.** Don't propose paid APIs or services that
  need a card. Signups used so far: GitHub, Supabase, Cloudflare, OpenRouteService.
  **One approved exception (8 Oct 2026):** Google Routes for the on-demand "Check driving
  traffic" button (`docs/TRAFFIC_ROUTING.md`). Low GCP cost is accepted for that button only;
  no background or all-pairs requests, and nothing else paid without asking.
- **Offline-first.** The UI reads only from IndexedDB, and the network is an enhancement.
  Everything must keep working with no signal (rural Guatemala, airports, lanchas).
- **iPhone Safari installed to the Home Screen** is the primary target. Touch targets are at
  least 44 px (`min-h-11`).
- **Access is a secret trip link plus "Who are you?".** No password is ever required. Each device
  signs in anonymously with Supabase. An account is optional (Google, or email with a one-time
  code or a password) and only exists so trips come back on another phone.
- **Ratings:** no third-party star ratings. Google, Yelp and TripAdvisor all need a card or
  forbid offline caching. Use group ratings plus keyless deep links (`googleMapsUrl`,
  `tripadvisorUrl` in `src/lib/geo.ts`).
- **Auto-suggest** is on the phone only: `src/features/suggest` ranks the trip's own idea pool for the
  free parts of a day (no network, no model). Suggesting flights, hotels or places from outside the
  pool is still cut. Keep the seam: `places.source = 'suggestion'`.

## Stack

React 19, Vite 8, TypeScript 7 (strict, `noUncheckedIndexedAccess`), React Router 8, Tailwind v4,
Dexie 4 (`useLiveQuery`), Zustand (device preferences only), Luxon, zod 4, supabase-js 2,
MapLibre GL 6, pmtiles, @protomaps/basemaps, vite-plugin-pwa (Workbox), Vitest 5 + fake-indexeddb
+ fast-check, Playwright (Chromium, iPhone 13 profile).

Windows dev machine. PowerShell 5.1 and Git Bash are both available; Node 24 runs `.ts` scripts
directly (`node scripts/x.ts`).

## Layout

```
src/lib/          pure helpers: money.ts, time.ts, geo.ts, ids.ts, supabase.ts (+ *.test.ts)
src/data/         types.ts (row types), db.ts (Dexie schema), repo.ts (save/saveMany/softDelete),
                  hooks.ts (live queries), device.ts (Zustand: joined trips, my member id, prefs)
src/data/sync/    engine.ts (push/pull), remote.ts (Supabase adapter), controller.ts (timers, realtime)
src/features/     onboarding/ (welcome, travel quiz) trips/ places/ map/ map/offline/ routing/ polls/ ratings/ itinerary/ money/ tickets/ offline/
                  packing/ notifications/ (push) emergency/ scan/ (photo → text) wrapped/ (trip recap)
                  suggest/ (ideas for a free day, from the idea pool) activity/ (what's new, derived on the phone)
                  discovery/ (profiles, drafts, hand editor) stowie/ (the mascot chat over discovery; docs/STOWIE.md)
src/ui/           index.tsx (Button, Field, Input, Card, PageHeader…), collection.tsx (adapted shadcn)
supabase/migrations/          SQL, applied in filename order
supabase/functions/route-legs Edge Function (routing.ts is pure and unit-tested)
supabase/functions/push-dispatch, ticket-cleanup   called by pg_cron (docs/NOTIFICATIONS.md)
scripts/          overpass-seed.ts, basemap-extract.ps1, fetch-map-assets.ts, smoke-test.ts
seed/<trip>/      areas.json (hand-edited), places.json (generated), region.geojson
public/packs/     offline map .pmtiles (shipped with the app; each must be under 25 MiB)
tests/e2e/        Playwright specs + cleanup.sql
docs/             NEW_TRIP.md (new destination runbook), UI_COMPONENTS.md
```

## Sync contract (read before touching data)

- **IDs:** clients generate them (`newId()`), so rows can be created offline. Per-member or
  derived rows use `stableId(tripId, ...parts)` (uuid v5), so two devices converge on one row.
  Examples: route legs `stableId(trip,'leg',from,to,mode)`, imported places `stableId(trip,'osm',osmId)`.
- **Writes** go through `save` / `saveMany` / `softDelete` in `src/data/repo.ts`, never Dexie
  directly. Each one writes the row and queues an outbox entry in a single transaction.
- **Server owns time.** The `private.sync_guard()` trigger sets `updated_at = clock_timestamp()`,
  makes `id`, `trip_id`, `created_at` and `created_by` immutable, and makes `deleted_at`
  impossible to clear (deletes are sticky).
- **Conflicts:** last write to reach the server wins, per row. A pull never overwrites a row
  that still has unpushed local edits (`_dirty`).
- **Pushes that fail:** a 4xx goes to the `_deadletter` table (shown in Settings → Sync); a
  network error or 5xx backs off and retries.
- **Realtime** is only a hint to pull now; the data always comes through `pull()`.
- **Multi-author collections are separate rows**, never arrays on a parent row.
- **Hard deletes:** no table has a delete policy.

### Adding a synced table (checklist)

1. **Migration** `supabase/migrations/<timestamp>_<name>.sql`. Copy the standard columns
   (`id uuid pk, trip_id, created_at, updated_at, deleted_at, created_by, updated_by`). Add:
   - the `sync_guard` trigger
   - a `(trip_id, updated_at)` index
   - RLS with `select` / `insert` / `update` policies `to authenticated` using
     `(select private.has_trip_access(trip_id))`, and no delete policy
   - `alter publication supabase_realtime add table …`

   The `do $$ … foreach t in array[...]` block in `20261001000001_route_legs.sql` is the template.
2. **Apply it** with the Supabase MCP `apply_migration` tool, project `croqjdvzbpcscdcshnet`.
3. **Types:** add the row type to `src/data/types.ts` and to `Tables`.
4. **Dexie:** add a new `this.version(N).stores({...})` in `src/data/db.ts`. Never edit old versions.
5. **Sync:** add the table to `SYNCED_TABLES` in `src/data/sync/engine.ts`, parents before children.
6. **Cleanup:** add a delete line to `tests/e2e/cleanup.sql`.
7. **Check:** run `get_advisors` (security) afterwards. Two kinds of warning are expected:
   - SECURITY DEFINER RPCs (each checks access itself)
   - "Anonymous access policies" on every table. Anonymous sign-in *is* the identity model,
     and every policy still requires `has_trip_access`.

**Never soft-delete per-member rows that people toggle** (votes, ratings). Deletes are sticky,
so that person could never vote again. Store "none" as NULL instead (`poll_votes.score`,
`place_ratings.stars`).

## Domain rules already decided

- **Places:** `status` runs catalog (the "idea pool", hidden on the map by default) → shortlist
  → planned → booked → visited, or rejected. "Picks" means shortlist, planned, booked or visited.
- **Travel times** (`src/features/routing/legs.ts`), in priority order:
  1. a time the group reported (`leg_overrides`, unordered pair)
  2. a typical town-to-town route (`trips.settings.area_routes`: lanchas, shuttles)
  3. a routed time × the trip's `route_factor_low..high` (default 1.4–2.0; Guatemala's roads
     route 40–50% too fast)
  4. a straight-line estimate

  A walk of 25 minutes or less hides driving. Legs are stale if a pin moves.
- **Money** (`src/lib/money.ts` + `src/lib/fx.ts`; UI in `src/features/money`):
  - A server trigger (`private.validate_expense`) rejects expenses whose payers, exact splits or
    percentages don't add up. Client checks are in `features/money/build.ts`.
  - Showing money in the local currency (≈ GTQ) is display-only, converted at the latest snapshot.
    Balances are always computed in the base currency.
  - Rates: one `fx_snapshots` row per day (`stableId(trip,'fx','USD',as_of)`), refreshed when over
    24 h old and online, with `FALLBACK_PER_USD` used offline.
  - Amounts are integer minor units. Each expense stores the FX rate used at entry, and the
    largest-remainder allocator spreads leftover pennies across people.
  - Settle-up uses greedy min-cash-flow.
  - FX rates come from open.er-api.com (keyless, includes GTQ, attribution required).
- **Time** (`src/lib/time.ts`, used by the itinerary):
  - Store wall-clock time plus the IANA zone for each end; derive instants from them.
  - Every function takes the zone as a parameter. The US DST change on 14 Mar 2027 falls
    during spring break.
- **Voting** (Phase 4): score voting per option — 0 No way · 1 Fine · 2 Want · 3 Must-do, or skip.
  - Rank by mean score, then fewer "No way" votes, then more voters.
  - Options with fewer than half the group voting are flagged "needs votes".

## Commands

```
npm run dev | build | preview
npm run typecheck          # app config + tsconfig.node.json (tests, scripts)
npm test                   # Vitest unit tests (src/** and supabase/functions/**)
npx playwright test tests/e2e/            # e2e against a local build + LIVE Supabase
BASE_URL=https://trip-hub.alexanderclem12.workers.dev npx playwright test tests/e2e/
npm run smoke              # two simulated devices against live Supabase
npm run seed:places -- seed/<trip>
```

Pass the path `tests/e2e/` explicitly. A bare filter like `travel` also matches the folder
name "travel app" and runs every spec.

## Deploy and environments

- **Deploys:** pushing to `main` makes Cloudflare (Workers static assets, `wrangler.jsonc`)
  build and deploy within about 90 seconds. `.env.production` holds the public Supabase URL
  and publishable key; they're meant to be public and are protected by RLS.
- **Supabase:**
  - Project `trip-hub` (`croqjdvzbpcscdcshnet`, us-east-1), free tier, managed through the
    Supabase MCP tools.
  - Anonymous sign-ins are on. The `ORS_API_KEY` secret is **not set yet**, so route-legs
    falls back to the public OSRM server.
  - The GitHub Action `keepalive.yml` pings it every 3 days so it doesn't auto-pause.
- **Never commit secrets.** `.mcp.json` holds a GitHub token and is gitignored. No secret
  ever goes in a `VITE_` variable.

## Working rules and gotchas

- **The user also commits from another laptop.** Run `git fetch` before work and before
  pushing, rebase onto `origin/main`, and never force-push. End commit messages with the
  Co-Authored-By line the harness specifies.
- **Real trips exist** ("Guatemala SB 27", with the group's devices). Only ever delete test
  data named `E2E TEST %` or `SMOKE TEST %` (`tests/e2e/cleanup.sql`), and clean up after
  every e2e or smoke run.
- **Sign-in rate limit:** Supabase allows about 30 anonymous sign-ins per hour per IP, and
  each e2e spec uses 1–3. Many runs in an hour fail with "Request rate limit reached"; space
  them out. This doesn't affect real users.
- **Playwright and navigation:**
  - After actions that save, wait for the navigation that follows (`waitForURL`). Navigating
    away immediately cancels the RPC or IndexedDB write.
  - After clicking a link, `waitForURL(pattern)` before reading `page.url()`; client-side
    navigation is async.

  Both have caused flaky failures.
- **Travel-time assertions:** don't take "Walk" as a sign that legs have arrived, because
  straight-line estimates also say "Walk". Wait for the "~" to disappear instead.
- **Sync latency in tests:** a realtime poke usually arrives in seconds. A phone that's busy
  uploading the 1,301-place import may only see other people's edits at the 60 s periodic
  pull, so give cross-device assertions about 75 s.
- **String replacement:** when editing files with JS `String.replace`, a replacement text
  containing `$'` or `` $` `` is corrupted. Use the Edit tool, or `split/join`.
- **Regexes:** anything containing a regex backslash (`\s`, `\d`, `\.`) must go through the Edit
  tool, never a bash heredoc running node. The backslashes get stripped silently (`\s` becomes `s`),
  and this has happened three times.
- **Fixed-width inputs:** `Input`/`Select`/`Textarea` in `src/ui` are full width unless the
  `className` has its own `w-…`. Don't wrap them to resize them; pass the width.
- **MapLibre 6:**
  - It has named exports only (`Map as MlMap`).
  - The worker must be set via `setWorkerUrl(… ?worker&url)`.
  - Its CSS sets the container to `position: relative`, so size the map from a wrapper.
  - Custom layers are re-added on every `style.load` (the online/offline switch).
  - The offline font set has *Medium*, not *Bold*.
- **Forms must fill themselves only once** (a `loaded` ref). Background sync keeps refreshing
  live-query rows, so re-applying them silently undoes what the person is typing. Notes and text
  areas that save on blur also ignore incoming updates while focused. When a form is prefilled
  from another table (`?place=`), wait for that table to load before initialising.
- **MapLibre expressions:** `['zoom']` may only be the input of a *top-level* `step` or
  `interpolate`. Nesting it inside `case` silently drops the whole layer.
- **Map camera:** never auto-trigger `GeolocateControl`, because it flies to the user and undoes
  framing (for example "frame this day"). Location is tracked quietly (`watchPosition` and our
  own `me-dot` layer); the control is only for an explicit tap.
- **Cloudflare** redirects `@` to `%40` (sprites `light@2x`). The service worker copes, and
  the offline e2e test covers it.
- **UI conventions** (from the user's redesign):
  - Use `src/ui` primitives and the `src/ui/collection.tsx` shadcn adaptations; don't add
    component libraries.
  - Icons get `aria-hidden`; sheets are labelled `role="dialog"`; external links get an
    sr-only "(opens in a new tab)".
  - Use the existing brand (teal) and stone tokens in `src/styles/index.css`.
- **Verify UI with Playwright screenshots** (`SHOTS_DIR=<scratchpad>`), not just assertions.
  A blank map once passed every assertion.

## Status and remaining plan

The full plan is in `C:\Users\alexa\.claude\plans\plan-out-a-travel-giggly-falcon.md`.

| Phase | Status | Contents |
|---|---|---|
| 0 Tooling | ✅ | Vite PWA shell, CI, keepalive |
| 1 Foundation | ✅ | Schema/RLS, sync engine, join + who-are-you, places, OSM seed (1,301 places) |
| 2 Live map | ✅ | MapLibre + OpenFreeMap, pins/clusters/filters, place sheet, long-press add, location |
| 3 Travel times + offline map | ✅ | route-legs function, ranges, lancha/shuttle routes, reported times, measure mode; PMTiles offline packs (15.6 MB) with auto-switch. **Still pending: the user's real-iPhone airplane-mode check.** |
| 4 Voting + group ratings | ✅ | Votes (More → Votes): score voting, ranked results showing who voted what, and closing a vote → winner → "Add to the plan" (sets the place to *planned*; in Phase 5 it should create an itinerary item). Group ratings (1–5 stars + note) on place pages, stars on the map card and in the list, a "Best rated" sort, a "Group vote" card on place pages, and an empty RatingProvider seam (`src/features/ratings/providers`). |
| 5 Itinerary + time | ✅ | Plan tab: day strip, an hour-slot timeline with overlap lanes and conflict warnings, a "Staying at" banner, all-day items and day notes. Items store a local time plus a zone for each end, and the server trigger derives `start_at`/`end_at` (an ambiguous DST time resolves to the later instant, matching Postgres). A Guatemala-time / phone-time toggle. Item form (cross-zone flights, attendees, confirmation code, estimated cost) and item detail (both local ends, travel time from the previous stop). Map `?day=` shows numbered stops plus a route. "Add to plan" from places and from vote winners; saving marks the place planned or booked. |
| 6 Money | ✅ | Money tab: your balance, settle-up with the fewest payments and one-tap "Record" (pay in USD or GTQ), balance bars, history by day. Expense form: 4 split methods with live shares and a left-to-assign counter, several payers, a rate pre-filled from the daily snapshot (editable), and "Log what it cost" from plan items. USD / ≈GTQ toggle. Narrow currency symbols (Q, $). |
| 7 Tickets + master download | ✅ | `attachments` table plus a private Storage bucket (`<trip>/<id>/<file>`, folder-level RLS via `private.object_trip_access`). Tickets tab: wallet grouped by plan day, with on-phone/upload status. Add from camera, photos or files (big photos downscaled to 2400 px; PDFs untouched), linked to plan items. A full-screen viewer (pdf.js draws the PDF, pinch-zoom). Every phone uploads its own files and downloads everyone else's automatically. "Ready for offline" master download (data, tickets, map pack, rates, app, persist) in Settings, with a compact version on the Tickets tab, plus iPhone Home Screen guidance. |
| 8 Up next, tasks, travel buffers | ✅ | Plan: an "Up next" card (leave-by time, attendees, map and ticket shortcuts) and travel buffer warnings per person (`src/features/itinerary/travel.ts`). More → Tasks: shared tasks with an owner, due date, notes, complete/reopen (`trip_tasks`; completion is a boolean, not a tombstone). Details and verification in `docs/PLANNING_FEATURES.md`. |
| 9 Calendar, sign-in, self-serve setup | ✅ code, ⏳ setup | **Calendar export:** `.ics` built on the phone (`src/lib/ics.ts`, `features/itinerary/calendar.ts`). **Sign-in** (`src/features/account`): optional, with Google or with email (`/signin`: a 6-digit code by default, or a password; the same address is the same account either way). A one-time code moves a guest's trip memberships to the account (`create_link_code` / `redeem_link_code`), so `20261006000001_account_link.sql` must be applied. The card shows whichever providers Supabase reports as on (`/auth/v1/settings`) and hides itself when none are. Email codes need `{{ .Token }}` in the Magic Link and Confirm signup templates and a custom SMTP sender (the built-in mailer sends only a few an hour). **Self-serve setup** (`src/features/destinations`, `map/offline/savedArea.ts`): town search, places from Overpass, and an offline map saved from the online tiles; see `docs/NEW_TRIP.md`. |

| Opening sequence | ✅ code | `/` shows a welcome screen until the phone has a trip (create, join by link, Google). Right after joining or creating (`afterEntry` in `onboarding/profile.ts`, not a `TripLayout` gate, so later deep links are never interrupted), people go to Stowie's 10-question this-or-that travel quiz (`/quiz?next=`, skippable, online only) that fills their radar, then land on the overview with a short Stowie welcome; it's taken once per person and copied into every trip. Details in `docs/AI_PLANNING.md`. e2e contexts start with the quiz skipped (`playwright.config.ts` storageState); `first-run.spec.ts` (stubbed) and `onboarding.spec.ts` (live) opt back in. |
| Weather, packing, push | ✅ | **Weather** on the Plan tab (`src/lib/weather.ts`, `features/itinerary/weather.ts`): Open-Meteo (keyless, CC BY) forecast for 16 days, "Typical" (previous 3 years averaged) beyond; per day at where the group sleeps; a local-only Dexie table (`weather`, never synced), refreshed when online and in the master download; °F/°C per phone. **Packing** (More → Packing list, `features/packing`): `packing_items` (everyone / group / personal) + `packing_checks` (per-person ticks, null = not yet, never deleted); starter suggestions with stable ids and weather extras. **Push** (`features/notifications`, Settings card): triggers + pg_cron queue events, `push-dispatch` sends Web Push; leave-by times come from the phone (`set_my_reminders`). **Ticket clean-up:** daily `ticket-cleanup` deletes Storage files 7 days after a ticket is removed; phones drop their copy at once. See `docs/NOTIFICATIONS.md`. |
| Cost, emergency, scan, recap | ✅ | **What this trip costs you** (Money tab, `money/forecast.ts`): spent share + share of plan estimates not yet logged. **Emergency info** (More): tap-to-call numbers, hospital and embassy in `trips.settings.emergency`; `member_safety` cards readable by the trip, writable only by their owner (RLS via `private.claims_member`); full-screen "Show the driver" and medical card. **Scan** (`features/scan`): text read on the phone (pdf.js text layer, else Tesseract with the worker and core shipped as app assets; language data from jsDelivr, cached in `ocr-assets`), stored in `attachments.text`; "Pull out details" calls `/api/scan` (Workers AI Llama 3.2 Vision; the image and instructions must share one user message, else it only transcribes; gaps filled by the text model). Money → Scan a receipt prefills an expense and links the photo. **Trip Wrapped** (`/t/:trip/wrapped`, `features/wrapped`): story slides from local data, shareable as 1080×1920 PNGs. |

| Shareable votes, comments, what's new | ✅ code, ⏳ migrations | Vote share links (`/join?to=vote/<id>#t=`), deadlines, date votes, `comments`, and a derived activity feed. See `docs/VOTING_AND_COMMENTS.md`; three `20261012…` migrations must be applied before the frontend deploys. |

| Ideas for a day, fuller what's new | ✅ | **Ideas for this day** (Plan tab, `features/suggest`): places from the idea pool for free meals and free time, ranked by distance from where the group sleeps, the group's travel styles, group ratings, the shortlist and rain. **What's new** also reports tasks completed, payments, ratings and plan items confirmed or cancelled, with filter chips. Neither adds a table. See `docs/PLANNING_FEATURES.md`. |

Possible next steps: setting the `ORS_API_KEY` secret, the real-iPhone airplane-mode and push check, and offering the day's ideas from Stowie's chat (a `suggest` effect over `features/suggest/rank.ts`).

- **Map style switches:** effects that touch pin or line layers must check `layersLive` in
  `MapScreen.tsx`. Between `setStyle` and the next `style.load` those sources don't exist, and
  touching them crashes the route.
- **Overpass returns big features by overlap:** a reserve or route that only touches the box
  comes back with a centre far away. `toSeedPlaces(..., within)` drops those.
