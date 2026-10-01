# Trip Hub

A shared trip-planning PWA for a group of 8+ friends. The first trip is spring break 2027 in
Guatemala (Antigua + Lake Atitlán), but nothing may be Guatemala-specific except seed data.
Live at https://trip-hub.alexanderclem12.workers.dev. Repo: github.com/alexanderclem/trip-hub.

## Hard constraints

- **$0, no credit card, no business verification.** Don't propose paid APIs or services that
  need a card. Signups used so far: GitHub, Supabase, Cloudflare, OpenRouteService.
- **Offline-first.** The UI reads only from IndexedDB, and the network is an enhancement.
  Everything must keep working with no signal (rural Guatemala, airports, lanchas).
- **iPhone Safari installed to the Home Screen** is the primary target. Touch targets are at
  least 44 px (`min-h-11`).
- **Access is a secret trip link plus "Who are you?".** There are no passwords. Each device
  signs in anonymously with Supabase; `members.auth_user_id` is the hook for real accounts later.
- **Ratings:** no third-party star ratings. Google, Yelp and TripAdvisor all need a card or
  forbid offline caching. Use group ratings plus keyless deep links (`googleMapsUrl`,
  `tripadvisorUrl` in `src/lib/geo.ts`).
- **Auto-suggest** (flights, hotels, restaurants) is cut from v1. Keep the seam: `places.source = 'suggestion'`.

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
src/features/     trips/ places/ map/ map/offline/ routing/   (one folder per feature)
src/ui/           index.tsx (Button, Field, Input, Card, PageHeader…), collection.tsx (adapted shadcn)
supabase/migrations/          SQL, applied in filename order
supabase/functions/route-legs Edge Function (routing.ts is pure and unit-tested)
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
- **Money** (`src/lib/money.ts`, not wired to the UI yet):
  - Amounts are integer minor units. Each expense stores the FX rate used at entry, and the
    largest-remainder allocator spreads leftover pennies across people.
  - Settle-up uses greedy min-cash-flow.
  - FX rates come from open.er-api.com (keyless, includes GTQ, attribution required).
- **Time** (`src/lib/time.ts`, not wired yet):
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
- **MapLibre 6:**
  - It has named exports only (`Map as MlMap`).
  - The worker must be set via `setWorkerUrl(… ?worker&url)`.
  - Its CSS sets the container to `position: relative`, so size the map from a wrapper.
  - Custom layers are re-added on every `style.load` (the online/offline switch).
  - The offline font set has *Medium*, not *Bold*.
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
| 5 Itinerary + time | ⏳ next | `itinerary_items` (start/end local + tz), `day_notes`; day timeline with overlap lanes and conflicts; time-zone toggle; day route on the map |
| 6 Money | | `expenses` (payers/split as jsonb), `settlements`, `fx_snapshots`; 4 split methods, balances, settle-up, currency toggle |
| 7 Tickets + master download | | `attachments` + private Storage bucket; wallet + pdf.js viewer; one-button offline download of everything; iOS hardening |

If the schedule slips, cut Money and Tickets first. Never cut the map.
