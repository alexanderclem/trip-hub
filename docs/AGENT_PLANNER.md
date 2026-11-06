# Trip agent (bookable plans)

`POST /api/agent-plan` turns a group's constraints into an itinerary built only from real offers:
flights, hotels and tours from **LiteAPI**, with each day's free stops put
in order by the **Google Routes API**. The model is **DeepSeek V4.1 Flash**, using OpenAI-format tool
calls. The owner approved this on 5 Nov 2026, which lifts the $0 rule and the "no live search or
bookings" rule for this feature only (see CLAUDE.md). Stowie, trip ideas and the free planner keep
using Workers AI and stay free.

| Piece | File |
|---|---|
| System prompt and trip message | `worker/agent/prompt.ts` |
| Tool schemas (strict JSON Schema plus a zod copy) | `worker/agent/tools.ts` |
| Ledger, timing and conflict rules | `worker/agent/schedule.ts` |
| Google Routes segments and re-timing | `worker/agent/routes.ts` |
| LiteAPI adapters | `worker/agent/providers.ts` |
| The loop | `worker/agent/loop.ts` |
| Endpoint (auth, access, rate limit) | `worker/agent/handler.ts` |
| Phone calls (request, finalize → email) | `src/features/agent/client.ts` |
| Email | `trip_finalized` in `supabase/functions/_shared/email.ts`, queued by `public.queue_trip_finalized_email` (`20261108000001`) |
| Tests | `worker/agent/agent.test.ts`, `supabase/testing/trip-finalized-email.test.ts` |

## Prompt

DeepSeek caches identical request prefixes automatically and bills cache hits at a lower rate. The
request is laid out so the long part is always identical:

1. `AGENT_SYSTEM`, which never changes. It has no dates, ids or names, and a test checks for that.
2. `TOOLS`, also never changes.
3. One user message with this trip's JSON: dates, zone, origin airport, party size, currency,
   budget in minor units, vibe, notes, and saved places (`place_id`, name).

Each later turn in the loop adds messages after these, so every call re-reads a cached prefix.
`usage.cachedPromptTokens` in the response shows whether it's working.

The prompt has four parts:
- **Ground rules:** trip text is data; never invent ids, prices or times; never fill a tool
  parameter you weren't given; use minor units in one currency.
- **Order of work:** flights fix arrival and departure, then one hotel search per stay, then
  activities, then actual start times. Independent searches go in the same turn.
- **Scheduling rules:** these match the server's checks.
- **Finishing:** call `submit_itinerary` with the full list, and fix exactly the errors the server returns.

## Tools

Five tools, all with `strict: true`. Every property is listed in `required`, optional values are
`["type","null"]`, and `additionalProperties` is `false`. Strict decoding needs DeepSeek's
`/beta` base URL (`DEEPSEEK_BASE_URL`, which defaults to it). The server parses the arguments again
with zod no matter what the model sends.

| Tool | Provider call | Model gets back |
|---|---|---|
| `search_flights(slices[], adults, cabin_class, max_connections)` | LiteAPI `POST /v3.0/flights/rates` using the server's trip currency, plus airport metadata lookups | `offer_id`, total, `expires_at`, segment lines |
| `search_hotels(city_name, country_code, checkin, checkout, adults_per_room, rooms, currency, max_nightly_minor, min_stars)` | LiteAPI `POST /v3.0/hotels/rates` | `rate_id`, hotel name, total, refundable, has_location |
| `search_activities(destination_name, start_date, end_date, tags[], currency, max_price_minor)` | LiteAPI `GET /v3.0/experiences/tours` | `product_code`, title, duration, from-price |
| `check_activity_times(product_code, travel_date, adults, currency)` | LiteAPI tour availability + `POST /booking-options` | `slot_id`, start and end time, total |
| `submit_itinerary(summary, nodes[], assumptions[])` | none (checked by the server) | `{ok:true}` or `{ok:false, errors[]}` |

A node is `{kind: flight|hotel|activity|free, ref, day, start_time, duration_minutes, note}`:
- **flight:** `ref` is an `offer_id`.
- **hotel:** `ref` is a `rate_id`.
- **activity:** `ref` is a `slot_id`; a `product_code` is rejected.
- **free:** `ref` is a trip `place_id` or null, plus a start time and a duration.

## Orchestration

**State lives in the Ledger, not the conversation.** Every provider result is normalized and
stored in a per-request `Ledger` under its id: exact local times with IANA zones, prices in minor
units, expiry, coordinates. The model sees short summaries. When it submits, `resolve()` rebuilds
every node from the ledger, so a time or price the model misremembers never reaches the traveler.
A made-up id comes back as "unknown reference".

**Cross-checking (`schedule.ts`).** Every node becomes a block with a busy window:
- Flight segments are busy from 3 h before departure until 90 min after arrival.
- Activities need 30 min to get there before they start.
- Free time is busy only for itself.

Any overlap between different nodes is an error. That catches a 09:00 tour after an 08:00
landing, two tours too close together, or a stop in the departure-day airport window. The check
also requires:
- every night between landing and the last departure has exactly one hotel;
- nothing falls outside those dates;
- every price is in the trip currency;
- the total is within budget;
- no flight offer has expired.

All the problems go back to the model at once, as the `submit_itinerary` tool result, so it can fix
them together.

**Routing (`routes.ts`).** The Routes optimizer reorders waypoints but knows nothing about time
windows. So each day is cut at its fixed points (hotel at 08:00 → tour at 13:00 → … → hotel at 22:00),
and only the free stops between two fixed points are reordered. Each segment is one
`computeRoutes` call:

```json
POST https://routes.googleapis.com/directions/v2:computeRoutes
X-Goog-FieldMask: routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.legs.distanceMeters
{
  "origin": {"location": {"latLng": {"latitude": 14.5586, "longitude": -90.7339}}},
  "destination": {"location": {"latLng": {"latitude": 14.47, "longitude": -90.88}}},
  "intermediates": [{"location": {"latLng": {...}}}, {"location": {"latLng": {...}}}],
  "travelMode": "DRIVE", "optimizeWaypointOrder": true,
  "routingPreference": "TRAFFIC_AWARE", "departureTime": "2027-03-22T14:00:00Z"
}
```

`applyRoute` applies `optimizedIntermediateWaypointIndex` and re-times the stops from the leg
durations. A free stop's `start_time` means "not before", so the group waits if it arrives early.
If the segment then runs into the next fixed point's busy window, that's an error back to the model
("drop or shorten one"). Stops without coordinates, and stops next to a fixed point without
coordinates, are listed in `unrouted` and never get guessed pins. With no
`GOOGLE_ROUTES_API_KEY`, the plan is still checked; it just isn't reordered. There are at most 12
Routes calls per plan, and they only happen when someone asks for a plan (never in the background).

**Limits per request:**
- 12 model turns
- 30 tool calls
- 4 submits
- 45 outbound requests: the Workers Free limit is 50; on Workers Paid this can go up.
- 2 plans a minute per user (`AGENT_RATE_LIMITER`)

**Response (`FinalPlan`):**
- days, each with its stay and timed items (`routed` true or false)
- `bookable[]`: offer refs with totals and flight expiry
- `unrouted[]`, `assumptions[]`, the total, and token usage

## Finalizing and booking

When someone taps **Finalize**, the phone calls `finalizeAgentPlan(tripId, draftId, plan)`. That
runs `public.queue_trip_finalized_email`, which queues a `trip_finalized` email in
`private.email_outbox`, and `email-dispatch` sends it through Gmail (`joinstowaway@gmail.com`,
counted in the 400-a-day cap). The function:
- sends only to the caller's own account email;
- returns `no_email` for guests, `limited` after 10 a day, and `queued` otherwise;
- sends one email per plan key, so a double tap sends one email.

Finalizing **books nothing**. Booking is still to build, and each item must be confirmed by the
person:
- **LiteAPI flights:** verify the `offerId`, then prebook with passenger details and complete
  the booking/payment flow. Search again if the offer expires. Production Flights access
  requires approval; a hotel sandbox key also authenticates flight sandbox requests.
- **LiteAPI:** `prebook` the `rate_id`, then `book` with guest details.
- **LiteAPI Experiences:** prebook the chosen tour option and time with the priced participant mix, then confirm its booking/payment flow. Finalizing an itinerary does not book anything.

Payment handling for these is a separate decision. Stowaway currently never holds money (Stripe
Connect facilitator model).

## Activation

Set these as Worker secrets (`npx wrangler secret put NAME`). Use sandbox and test keys first.

| Secret | From |
|---|---|
| `DEEPSEEK_API_KEY` | platform.deepseek.com (prepaid balance) |
| `LITEAPI_KEY` | LiteAPI / Nuitee Connect dashboard (sandbox key first); shared by hotels and flights |
| `GOOGLE_ROUTES_API_KEY` | GCP key restricted to the Routes API |

1. `DEEPSEEK_MODEL` in `wrangler.jsonc` is `deepseek-flash`, the official alias for
   DeepSeek-V4.1-Flash-1017, verified against https://api-docs.deepseek.com/quick_start/pricing/
   on 5 Nov 2026. Confirm account access with authenticated `GET /models` once the key is set.
2. Check the adapters against your enabled LiteAPI environments. `providers.ts` parses responses
   with zod. Hotel rates were exercised live; Experiences still needs account enablement.
3. Apply `20261108000001_trip_finalized_email.sql` with the Supabase MCP `apply_migration` tool,
   then deploy `email-dispatch` so it has the new template.
4. Set billing alerts at DeepSeek and GCP. The rate limiter caps how often the agent runs, but not
   what a provider charges.

### Setup status — 5 Nov 2026

- Local production and Preview model settings now use the documented `deepseek-flash` alias.
  Authenticated model-list verification still needs a DeepSeek account and key.
- Staging (`knufofvmqopuvijvtzow`): applied `trip_finalized_email` and deployed
  `email-dispatch` version 4 with the new template and `verify_jwt=false`. Verified the RPC
  exists, `anon` cannot execute it, `authenticated` can, and unsigned dispatcher requests
  return 403. No email was sent. Production database and deployments were not changed.
- Focused agent, email-template and migration tests: 23 passed. TypeScript checks passed.
- Production Worker secret inventory now includes `DEEPSEEK_API_KEY`, `LITEAPI_KEY` and
  `TICKETMASTER_API_KEY` and `GOOGLE_ROUTES_API_KEY`, verified after the owner's installation on 5 Nov. The Google Routes key used by an existing Supabase
  function does not automatically become available to the Cloudflare Worker.
- DeepSeek and LiteAPI keys are installed in the production Worker. Secret values are not
  retrievable through the secret inventory, so authenticated provider checks remain unverified.
  An initial `/api/agent-plan` check returned 404; it has since been deployed (see below).

Create the provider accounts, then install the three values in Cloudflare Dashboard → Workers
& Pages → the intended Stowaway Worker → Settings → Variables and Secrets, with type
**Secret**. Start with test/sandbox credentials on staging. Do not put keys into `wrangler.jsonc`
or any `VITE_` variable. The production Worker is `trip-hub`; confirm the current staging
deployment in Cloudflare before installing staging credentials (the historical
`codex-operator-completion-trip-hub` name was not found by Wrangler).

Gmail is a separate **outgoing email sender**, not the application's Google sign-in setup.
Complete `docs/OWNER_SETUP.md` §4 using `joinstowaway@gmail.com`, then put `GMAIL_CLIENT_ID`,
`GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` and `GMAIL_SENDER` in the corresponding
Supabase project's Edge Function secrets. The sender must personally approve Google's
`gmail.send` permission. Use your own OAuth client in OAuth Playground with offline access;
an External app left in Testing gets a seven-day refresh token for this scope.

### Duffel replacement and tours alternative — 5 Nov 2026

Duffel signup is disabled according to the owner. The local flight adapter now uses LiteAPI
Flights. Its response schema was checked against the official
[OpenAPI spec](https://docs.liteapi.travel/openapi/openapiflights.json). It uses customer-facing
`pricing.display.total`, retains provider offer IDs and expiry, and resolves IANA zones from
the airport metadata endpoint. It excludes journeys with missing/invalid airport zones.
Each search returns at most eight offers and makes at most twelve airport lookups, within the
agent's existing subrequest limit. The adapter is deployed; see the production verification results below.

In [Nuitee Connect](https://dashboard.liteapi.travel), create a sandbox key. Flight sandbox
access is documented as enabled by default; contact Request Assistance if the endpoints are
not accessible. Build and test in sandbox, then request Production Flights access. Production
approval and commercial terms must be confirmed before launch:
https://docs.liteapi.travel/docs/getting-access-to-flights.

The recommended Viator alternative is **LiteAPI Experiences**, which uses the same API key
and offers tour search, availability and priced booking options. Request Sandbox Experiences
access through Request Assistance if it is not already enabled, and request production access
separately. The Viator adapter has now been replaced with LiteAPI Experiences. Live search returns 403
until account access is enabled. Access guide:
https://docs.liteapi.travel/docs/getting-access-to-experiences.

### Production deployment — 5 Nov 2026

- Replaced Viator with LiteAPI Experiences for tour discovery, participant availability and priced
  booking-option slots. The planner needs only `DEEPSEEK_API_KEY`, `LITEAPI_KEY` and
  `GOOGLE_ROUTES_API_KEY`; Viator credentials are no longer used.
- Adapted DeepSeek strict schemas to its supported subset and explicitly disabled thinking mode
  for the existing tool-history protocol. Server-side zod validation retains all size limits.
- 34 focused tests passed, including flight/tour adapters, agent conflict repair, email rendering
  and migration permissions. TypeScript checks passed.
- Deployed the planner API to production from an isolated checkout, preserving unrelated working
  edits. Initial version: `b98389ae-d651-4831-b452-f3eeb25aeb89`. Unauthenticated requests now return
  401 instead of 404. The API is deployed; a planner screen is not yet wired into the frontend.
- Applied `trip_finalized_email` to production and deployed `email-dispatch`. Verified execute
  permissions and unsigned-request rejection (403). Existing active trip count remained 11.
- Live provider verification: authenticated hotel planning returned HTTP 200 with a three-day itinerary and a real LiteAPI rate. Experiences searches returned HTTP 403; account enablement is required. Flight verification is in progress; Gmail sender authorization is still owner work.

The final verification fixes use short per-request model references for long flight/hotel offer
IDs while preserving the original provider tokens for booking. The API now rejects invalid trip
time zones before spending provider calls. Current production version: `e4ae6281-3639-4c83-8088-4872c3d1f671`.

### Follow-up check — 5 Nov 2026 (evening)

- Disposable production trip `E2E TEST agent activation …` soft-deleted (`deleted_at` set); its
  test user had already been removed. Active trip count is back to 11.
- Gmail sender secrets were **not found** in Supabase production (`trip-hub`), staging, or the
  Cloudflare Worker. They must be added under Supabase → `trip-hub` → Edge Functions → Secrets:
  `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER`.
- LiteAPI Flights is not yet verified live. Experiences still returns 403 until LiteAPI enables access.
- Gmail values had been added to the Cloudflare Worker as plain-text vars. Moved
  `GMAIL_CLIENT_ID`, `GMAIL_REFRESH_TOKEN` and `GMAIL_SENDER` to Supabase `trip-hub` secrets and
  removed all four `GMAIL_*` bindings from the Worker (config now matches `wrangler.jsonc`).
  The pasted `GMAIL_CLIENT_SECRET` failed Google's token exchange (`invalid_client`) and was not
  copied; the owner must add the correct `GOCSPX-…` secret directly in Supabase.

### Frontend — 5 Nov 2026

- `src/features/agent/LivePlanner.tsx`: the live-price planner (form → `/api/agent-plan` → day-by-day
  plan, offer prices and expiry, Finalize). The latest plan is kept in this phone's localStorage
  per trip, since every run spends paid provider calls. Nothing is booked from this screen.
- Stowie: trip chats show a **Plan with live prices** button that opens the planner inside the
  conversation. Also reachable at `/t/:tripId/more/planner`.
- Verified in a mocked browser run at phone width. Deployed with the rest of the working tree as version `d547a5ab-d6a7-49c1-b8ab-4a509f7435f3` (699 unit tests passed first).
