# Stowaway: The Switch — implementation plan

## Context

Stowaway (repo `trip-hub`) is a free, offline-first group trip planner: no accounts, an invite link plus "Who are you?". It has 1,400+ visitors a month and $0 revenue. The goal is to make it the operating system for people who run group trips for a living (operators), and later for corporate offsites, without breaking the free planner, which becomes the funnel. The organizer upgrades in place, inside a trip they already built.

Decisions made with you on 29 Oct 2026 (this session):

| Decision | Answer | Consequence for the plan |
|---|---|---|
| Money model | **Facilitator** | Operators connect their own Stripe account (Standard-style). Charges run directly on that account, so the operator is merchant of record. Stowaway never holds funds and earns an application fee. |
| $0 rule in CLAUDE.md | **Lifted for Stripe and email only** | Stripe platform verification and a free email sender (Gmail) are allowed. Supabase stays on Free; Supabase Pro waits until revenue covers it. CLAUDE.md "Hard constraints" must be updated in Phase 1. |
| Agent API | **Spec only, never built** | It's the fallback direction if validation fails. It is not something to "fix". |
| Time budget | **~10 focused h/week** | Estimates below are in focused hours, converted at 10 h = 1 calendar week. |
| Take rate | **Flat 1%** (no minimum, no cap) | Set as `application_fee_amount` = 1% of each charge, rounded to the cent. It's refunded pro rata when the operator refunds. |
| Monetization at launch | **Take rate only; Pro later** | Phase 1 has no subscription billing or entitlement gating. The Pro subscription ships in 2a, alongside the first Pro features; the price is decided then. |
| Launch market | **US operators, USD only** | Connect onboarding is limited to `country=US`, and offers are USD only. The existing multi-currency expense code stays as it is for free trips. |
| Legal entity | **Sole proprietor** | The Stripe platform account is opened as an individual/sole proprietor under your SSN, with "Stowaway" as the business name. You're personally liable; the facilitator model and operator terms keep that exposure low (section 10). |
| Email sender | **Gmail** | Use a **dedicated** Gmail account for Stowaway, not your personal one. It sends through the Gmail API over HTTPS (section 4, "Email"). Personal Gmail allows about 500 recipients a day, which covers Phase 1 but not Phase 2b campaigns. |

Ground truth that changes the brief's assumptions:
- **The agent REST API does not exist.** No branch of the repo has it. The only Worker on the Cloudflare account (`trip-hub`) routes just `/mcp`, `/.well-known/oauth-protected-resource*`, `/api/scan` and `/api/travel-ai` (`worker/index.ts`). What does exist is a read-only MCP connector with 2 tools (`list_trips`, `get_itinerary`), and its live `/mcp` returns 503 until Supabase OAuth is configured (`docs/CHATGPT_CONNECTOR.md`). `/llms.txt` falls through to the SPA's `NotFoundScreen` because `wrangler.jsonc` sets `not_found_handling: "single-page-application"`.
- **The two referenced files** (`stowaway-agent-api-spec.md`, `stowaway-qa-fixes.md`) are not in this environment, and the live site was not reachable from here. The QA ticket list below is rebuilt from commit `6e5873e` and the brief.

---

## 1. Codebase map, from what I read

**Hosting.** One Cloudflare Worker (`wrangler.jsonc`, `worker/index.ts`) serves the Vite SPA from `dist/` with SPA fallback. It handles `/api/travel-ai` (Workers AI), `/api/scan` and the MCP connector. The Worker holds no service-role key. Supabase (free tier, project `croqjdvzbpcscdcshnet`) provides Postgres, RLS, Auth (anonymous + optional Google/email), Storage (`attachments` bucket), Realtime (only a hint to pull), and Edge Functions (`route-legs`, `traffic-route`, `push-dispatch`, `ticket-cleanup`). The `push-dispatch` and `ticket-cleanup` functions run with the service role and are triggered by pg_cron through pg_net with an `x-cron-token` stored in Vault.

**Routes** (`src/router.tsx`):
- Public: `/`, `/privacy`, `/terms`, `/app`, `/new`, `/join`, `/signin`, `/auth/callback`, `/oauth/consent`, `/connections`, `/quiz`, `/inspire`.
- Trip: `/t/:tripId/*` covers overview, plan, map, tickets, money, more/(vote, tasks, packing, emergency, places, settings) and wrapped.
- Everything is lazy-loaded, so new operator routes add no weight to the traveler path.

**Data and sync:**
- 24 `public` tables.
- Client-generated ids.
- Every write goes through `src/data/repo.ts` (row + outbox entry).
- `src/data/sync/engine.ts` pushes the outbox (a 4xx goes to the dead-letter list, a 5xx backs off) and pulls each table where `updated_at > cursor` (`SYNCED_TABLES`, parents first).
- `private.sync_guard()` makes the server own the clock and keeps deletes sticky.
- Dexie schema is at v14 (`src/data/db.ts`).
- The UI reads only IndexedDB.

**Auth and identity:**
- Each device signs in anonymously.
- `trip_devices(trip_id, user_id, member_id)` is the whole access model.
- `create_trip`, `join_trip(token)`, `claim_member` and `create_member_and_claim` are SECURITY DEFINER RPCs (`20260930000001_core.sql`).
- Optional accounts (`src/features/account/account.ts`): a guest gets a link code (`create_link_code`); after Google or email sign-in, `redeem_link_code` moves the guest's `trip_devices` rows to the account user (`20261006000001_account_link.sql`).

**Money today** (`20261003000001_money.sql`, `src/features/money/*`): this is peer expense splitting only. `expenses` store payers and split as jsonb, checked by `private.validate_expense`; there are also `settlements` and `fx_snapshots`. There is no payment processing anywhere.

**Load-bearing and surprising facts** (the plan depends on these):
1. **Access is binary.** `private.has_trip_access(trip)` means "this auth user has a `trip_devices` row". It's referenced 59 times across the migrations and covers every table and Storage. There are no roles.
2. **Revocation doesn't exist.** `rotate_share_token` is callable by any member and leaves every joined device in place. There's no RPC to remove a device.
3. **The client re-joins automatically.** `src/features/trips/actions.ts:116-126` calls `join_trip` with the locally stored `share_token` whenever the server says 42501. Any revocation that leaves the token valid gets silently undone.
4. **`share_token` reaches every device.** Pulls use `select('*')` (`src/data/sync/remote.ts`), so every traveler holds the invite token.
5. **Pull never removes rows.** A row that becomes invisible (role downgrade, revocation) stays in the phone's IndexedDB forever. A permission change needs an explicit local purge.
6. **Documents are trip-wide.** `private.object_trip_access` lets any joined device read any ticket file.
7. **`trips.created_by` stores a member id, not an auth id** (see `create_trip`). "Who created this trip" is a member that a device claims, which is what makes retroactive claiming possible. `members.auth_user_id` exists but is unused ("hook for real accounts later").
8. **Server-only writers belong in Edge Functions.** They already hold the service role and the pg_cron/Vault pattern. The Worker deliberately has no service role.
9. **e2e runs against LIVE Supabase** (CLAUDE.md). Payments testing needs a separate staging project (a second free project).
10. **Test infrastructure to reuse:** PGlite runs real migrations against role/RLS fixtures (`worker/connector-permissions.test.ts`). Vitest already covers `supabase/functions/**`. Playwright uses the iPhone 13 profile, which is 390×844.
11. **Domains:** production is `joinstowaway.app`, but CLAUDE.md and `MCP_RESOURCE_URL` still name `trip-hub.alexanderclem12.workers.dev`. Separately, `origin/polish/website-entry` has an unmerged commit, `204d70f` (destination events, holidays, flight status).

---

## 2. Security model: roles, invites, revocation (prerequisite for any business use)

**Principle:** existing trips keep working exactly as today. A trip gets an `access_mode`: `group` (default, the current behavior) or `hosted` (an organizer controls access). The defaults reproduce today's semantics, so no data needs backfilling.

**Schema** (one migration, backward compatible):
- `trips`:
  - `access_mode text not null default 'group'`
  - `access_epoch int not null default 0`
  - `organizer_id uuid null` (Phase 1B)
  - `join_role text not null default 'member'`: the role a new joiner gets. Switching a trip to hosted sets it to `pending` (decided: hosted joiners wait for approval). Travelers who book through `/go/:slug` skip approval and join as `traveler`.
- `trip_devices.role text not null default 'member'`, one of `owner | admin | member | traveler | viewer | pending`. `owner`/`admin` require a non-anonymous user, enforced in the RPC.
- `private.trip_revocations(trip_id, user_id, revoked_at, revoked_by)`.
- `attachments`:
  - `visibility text not null default 'trip'` (`trip | staff | owner`)
  - `owner_member_id uuid`
- `private.can(trip_id, capability) returns boolean`, SECURITY DEFINER, called in policies through `(select …)`:
  - In `group` mode it returns `has_trip_access` for every capability that exists today, so existing behavior is identical.
  - Only `owner`/`admin` get the new capabilities (`members.manage`, `payments.manage`).

**Capability matrix:**

| Capability | group (any member) | hosted owner/admin | hosted traveler | hosted viewer | pending |
|---|---|---|---|---|---|
| Read the plan (places, itinerary, polls, packing, tasks) | ✓ | ✓ | ✓ | ✓ | trip name and dates only |
| Edit the plan | ✓ | ✓ | own packing ticks, own votes and ratings, comments | – | – |
| Documents | all | all | `trip`-visibility files plus their own | `trip`-visibility files | – |
| Expenses and settlements | all | all | rows where they are payer, in the split, or the creator | – | – |
| Bookings and payments | owner only | all | their own | – | – |
| Rotate the invite link | everyone (today); owner/admin once a trip is claimed | ✓ | – | – | – |
| Remove a person | the trip creator (new, free) | ✓ | – | – | – |
| Change roles, mode, payments | – | ✓ | – | – | – |

**RPCs:**
- `remove_from_trip(trip, member_id, rotate_link bool default true)`: deletes that member's `trip_devices` rows (precedent: `redeem_link_code` already deletes device rows), records them in `trip_revocations`, bumps `access_epoch`, and optionally rotates the link.
- `set_role(trip, member_id, role)` and `set_access_mode(trip, mode)`: both bump `access_epoch`.
- `join_trip` now refuses revoked users with a distinct error code, and gives new joiners `trips.join_role`.
- `my_trip_access(trip)` returns `{role, mode, epoch}`.

**Client changes:**
- `my_trip_access` runs at the start of each sync and is cached in `src/data/device.ts`. When the epoch or role changes, the client purges that trip's local rows, resets its cursors and re-pulls. When the error is "revoked", it shows "You were removed from this trip", purges local data, and **does not auto-rejoin** (change `actions.ts:116-126`).
- Edit controls are hidden by capability, so hosted travelers don't fill the dead-letter list.
- The Settings "Travelers & access" screen gets: remove person, change role, switch to hosted (with a plain preview of what travelers will lose), and approve pending joiners.
- The Storage policy checks the attachment row's `visibility` (the attachment id is in the path).
- Add a minimum-client-version check (a public config RPC) so cached old PWAs refresh before they meet hosted trips.

**Honest limits, shown in the UI and on the privacy page:**
- Data already downloaded to a removed phone can't be pulled back.
- A removed person who clears their browser can rejoin with an old link. That's why removal defaults to replacing the link, and hosted trips default to `pending` approval.

**Not in Phase 1:** separate per-role invite links (a `trip_invites` table with expiry and max uses) come in Phase 2. Until then hosted trips use one link plus approval.

---

## 3. Data model additions, by phase

All new tables follow the standard columns plus `sync_guard`, a `(trip_id, updated_at)` index, and RLS with no delete policy (CLAUDE.md checklist). "Server-written" means there are no insert/update policies for `authenticated`: Edge Functions write these with the service role, and clients only read. A server-written table can still be in `SYNCED_TABLES`, so a traveler's payment status works offline.

**Phase 1:**

| Table | Purpose | Written by | Synced to phones |
|---|---|---|---|
| `organizers` (owner_user_id, display_name, slug, support_email, logo_path) | the operator's business profile | owner, through RPC | no (dashboard is online) |
| `stripe_accounts` (organizer_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements jsonb, disabled_reason, payout_schedule jsonb, country, default_currency) | mirror of the Connect account | webhook | no |
| `trip_offers` (trip_id, organizer_id, status draft/published/closed, slug, price_minor, currency, deposit_minor, balance_due_date, capacity, cancellation_policy + policy_version, fee_mode absorb/pass, default absorb) | the public trip page and its pricing | owner/admin, through RPC with validation | yes (read) |
| `bookings` (trip_id, offer_id, member_id, traveler_name, traveler_email, status pending/active/paid/cancelled/refunded, price_minor, manage_token_hash, policy_accepted_at, policy_version, started_by_user) | one traveler's place on a trip | Edge Function | yes; RLS: staff, or the traveler via `claims_member` |
| `booking_payments` (booking_id, kind deposit/balance, amount_minor, application_fee_minor, stripe ids, status, paid_at, refunded_minor) | each charge | webhook | yes (same RLS) |
| `payouts` (organizer_id, stripe_payout_id, amount, arrival_date, status, failure_code) | mirror of the operator's payouts | webhook | no |
| `ledger_entries` (txn_id, organizer_id, trip_id, booking_id, account, amount_minor signed, currency, source_type, source_id, stripe_event_id, occurred_at) | append-only journal, balanced per `txn_id` (deferred constraint trigger) | webhook processor | no |
| `private.stripe_events` (event id pk, account, type, payload, received_at, processed_at, attempts, error) | webhook inbox | webhook | – |
| `private.email_outbox` (dedupe_key unique, to, template, data, send_after, sent_at, error) | transactional email queue | triggers and jobs | – |
| `private.product_events` (at, kind from an allowlist, trip_id, user_id, props jsonb, no PII) | funnel instrumentation | `log_event` RPC and triggers | – |

**Phase 2:**
- `trip_invites`
- `contacts` (organizer-scoped: name, email, phone, dietary, accessibility, emergency contact, tags, marketing_consent)
- `booking_answers` (custom intake questions per offer)
- `waitlist_entries`
- `rooms` and `room_assignments` (occupancy-based price deltas)
- `offer_installments` (more than two payments)
- `campaigns` and `campaign_sends` (plus unsubscribe tokens)
- `referral_codes` and `referral_attributions` (pay out as credit, not cash)
- `organizer_staff` (teams)
- `subscriptions` (Pro billing, platform-side Stripe Billing)
- Templates are a trip flagged `is_template` plus a server `clone_trip(source, start_date)` RPC that shifts day offsets.

**Phase 3:**
- Suppliers: `suppliers`, `rfps`, `rfp_responses` (a tokenized link per hotel), `supplier_payables`, `commissions`.
- Corporate: `organizations`, `org_members` (admin/approver/finance/employee), `budgets`, `approvals`, `travel_policies` (rules jsonb), `checkins` (duty of care, opt-in).

**Existing data:** nothing migrates. Defaults keep every current trip in `group` mode with `member` roles. Claiming sets `trips.organizer_id`, and only for a trip whose creator claims it.

---

## 4. Payments architecture (facilitator model)

**Account model:**
- Stripe Connect with controller properties equivalent to Standard: `losses.payments=stripe`, `fees.payer=account`, `requirement_collection=stripe`, full Stripe Dashboard.
- Onboarding uses Stripe-hosted Account Links.
- The operator is merchant of record. Their name is on the card statement, Stripe vets them, and disputes and negative balances are theirs and Stripe's, not ours.
- **Direct charges** on the connected account carry an `application_fee_amount` (Stowaway's ~1%).
- The platform pays no Connect fees in this configuration.

**Payout schedule (this is the answer to Gap 1):**
- Stowaway holds nothing, so there is nothing to release. Every deposit goes to the operator's Stripe balance at once and pays out on the schedule the operator picks in Stripe (daily, weekly, monthly or manual).
- The dashboard shows that schedule (`account.settings.payouts.schedule`), the next payout's `arrival_date`, and the payout history.
- The first payout is honest about timing: Stripe usually holds a new account's first payout about 7 days, up to 14 in some industries.
- "Partial payouts so I can pay suppliers before the trip" is what this model does by default.

**Why WeTravel holds funds, and how we handle the risk differently.** A merchant of record or payment facilitator that collects for travel delivered months later carries the loss if an operator fails and travelers charge back. Holding until after the trip is its loss control. We don't carry that loss, because Stripe underwrites each operator and applies reserves only where its risk models call for them. Holds can therefore still happen, but they're Stripe's, per operator, and we show them plainly. Our own controls:
- Founder review before a new operator's first public page goes live (during the beta, capped at 10 operators).
- A soft cap on volume collected by new operators before that review, enforced in `checkout-create`.
- A "Report this trip" link on public pages.
- Checkout through Stripe (Radar) plus per-IP rate limits on `checkout-create`.
- Operator terms: delivery and refunds are the operator's responsibility, and Stripe's restricted categories (travel clubs, timeshares) are prohibited.

**Flows:**
1. **Connect:** Edge Function `stripe-connect` creates the account and an Account Link. The `account.updated` webhook mirrors status into `stripe_accounts`.
2. **Publish:**
   - The owner fills in the offer: price, deposit, balance due date, capacity, cancellation policy, and fee mode.
   - The form shows a live "you keep $X" from `src/lib/fees.ts`.
   - Publishing creates `/go/:slug`, served from an anon-callable RPC `get_public_offer(slug)` that returns only published fields.
3. **Book:**
   - The traveler enters name and email and ticks the policy (versioned, timestamped).
   - The app ensures an anonymous session (existing behavior), then Edge Function `checkout-create` locks the offer row, checks capacity, inserts a `pending` booking, and creates a Checkout Session on the connected account (`Stripe-Account` header, idempotency key = booking id + kind, metadata with booking and trip ids).
   - Payment methods are card, plus ACH (0.8%, capped at $5) when the operator turns it on. ACH is the cheapest way to take $1,000+ balances.
4. **Confirm:**
   - The webhook (below) marks the payment `succeeded`. For ACH that happens on `checkout.session.async_payment_succeeded`.
   - It then activates the booking, creates the traveler's `members` row and a `trip_devices` row (role `traveler`) for the user who started checkout, posts ledger entries, and queues a confirmation email with the trip link and a manage-booking link (`/b/:token`, no account needed).
   - The success page waits for the booking with an honest "Payment received, finishing up…" message.
5. **Balance:** `/b/:token` shows paid and due amounts and a "Pay balance" button (a new Checkout Session). A daily pg_cron job queues reminder emails at 7 days before, 1 day before, and 3 days after the due date, plus push messages for travelers who turned notifications on. Due dates are evaluated in the trip's zone using `src/lib/time.ts`.
6. **Refunds (Phase 1):**
   - The operator refunds from their Stripe Dashboard.
   - On `charge.refunded`, we mirror the refund to the booking and ledger and **automatically refund our application fee on the refunded amount** through the Application Fee Refunds API. That's part of the transparency pitch.
   - In-app refunds with a cancellation-tier calculator come in Phase 2.
7. **Disputes:** we mirror `charge.dispute.*`, show an alert with Stripe's `due_by` deadline, and link to the Stripe Dashboard. Stripe also emails Standard account holders. An evidence pack built from trip data (policy acceptance, the traveler joined, itinerary delivered) comes in Phase 2.
8. **Payouts:** we mirror `payout.created/updated/paid/failed` from connected accounts.

**Ledger** (`supabase/functions/_shared/ledger.ts`, a pure function unit-tested in Vitest with fast-check):
- Booking created: Dr `traveler_receivable` / Cr `trip_revenue`.
- Charge succeeded: Dr `operator_stripe_balance` (net), Dr `stripe_fees`, Dr `stowaway_fees` / Cr `traveler_receivable`.
- Payout paid: Dr `operator_bank` / Cr `operator_stripe_balance`.
- Refunds and disputes post the reverse entries. Fees come from the charge's `balance_transaction`.
- Every transaction sums to 0, enforced by a DB constraint trigger.
- The ledger is a projection: **Stripe is the system of record**, so on Supabase Free (no backups) the ledger can be rebuilt from Stripe.

**Webhooks and failure modes:**
- Edge Function `stripe-webhook` (`verify_jwt: false`) checks the signature with `constructEventAsync` plus the SubtleCrypto provider. There are two secrets: the platform endpoint and the Connect endpoint.
- It `insert … on conflict do nothing` into `private.stripe_events`, returns 200 at once, and then tries to process the event.
- pg_cron (the `push_tick` pattern) retries anything unprocessed every minute.
- Processing **re-fetches the object from Stripe** instead of trusting the payload or the arrival order. Status changes only move forward, and every Stripe object id is an upsert key, so duplicates are no-ops.
- A nightly reconciliation job lists the last 3 days of Checkout Sessions, charges, refunds and payouts per connected account and compares them with our tables. It repairs mismatches and emails the founder.
- `account.application.deauthorized` turns off new checkouts for that operator. Their money is already theirs.
- If Stripe is down, `checkout-create` returns a friendly error and nothing is half-written.
- If we're down, Stripe retries for 3 days, and reconciliation covers anything later.

**Fees and pricing mechanics:**
- Stowaway's fee is a flat 1% of every charge, card or ACH, with no minimum and no cap. It's the same number on the pricing page, in the calculator and in the offer form.
- `fee_mode=absorb` (the default): the operator pays Stripe's fee plus ours, and the traveler sees one price.
- `fee_mode=pass`: a separate "booking fee" line that applies to every payment method, which keeps it a service fee, not a card surcharge. **Legal review needed** before launch (US surcharging rules).
- Card fees are never surcharged per card.

**Compliance checklist:**
- PCI: hosted Checkout means SAQ A.
- Seller-of-travel registration is the operator's obligation; we sell no travel.
- No money transmission: Stripe moves all funds, and we never hold traveler money in our own accounts.
- Stripe issues 1099-Ks to connected accounts.
- New operator terms, plus privacy page updates (bookings, emails, intake data).
- CAN-SPAM for Phase 2 campaigns.
- The Stripe platform account is opened as a sole proprietor: your identity (SSN), "Stowaway" as the business name, and a bank account. Check whether your state or county requires a DBA filing to trade under "Stowaway". The 1% income goes on your personal return.
- Connect onboarding only offers `country=US`, and offers only accept USD.

**Email (Gmail):**
- **Sending account:** a dedicated Gmail account for Stowaway (for example a new "Stowaway" address), with 2-Step Verification on and recovery details in your password manager. Keep it separate from your personal Gmail, so a suspension or a leaked credential can't touch your own mail.
- **Auth email codes:** Supabase Auth's custom SMTP points at `smtp.gmail.com` with an app password. This runs on Supabase's servers, so the Edge Function port block doesn't apply. It also fixes the existing CLAUDE.md gap (the built-in mailer sends only a few emails an hour).
- **Transactional email** (booking confirmations, balance reminders, hold alerts): Edge Function `email-dispatch` sends through the **Gmail API over HTTPS** (`users.messages.send`). Supabase Edge Functions can't open SMTP on ports 25 or 587.
  - Use the existing Google Cloud project (the one already used for Routes) for an OAuth client with the `gmail.send` scope.
  - Set the consent screen to **In production**: in Testing status, Google expires refresh tokens after 7 days. It will show an "unverified app" warning on the one-time consent, which is fine because only you consent.
  - Store the refresh token as a Supabase function secret.
  - Do a 1-hour spike at the start of 1C to prove the send path. If it fails, fall back to SMTP on port 465 from the function, or from the Worker's TCP `connect()`.
- **Headers:** the sender shows as "Stowaway for {Operator} <…@gmail.com>", with Reply-To set to the operator's support email so travelers' replies reach the operator. Every link in the email points to `joinstowaway.app`, never a shortener, so payment emails don't look like phishing.
- **Volume guard:** personal Gmail allows about 500 recipients a day. `email-dispatch` stops at 400 a day; the rest wait for the next day (balance reminders aren't urgent within a day), and you get an alert. Confirmations always go out first.
- **Phase 2b campaigns can't run on Gmail.** Personal-account limits and Google's bulk-sender rules make it unsuitable. Before campaigns ship, move to a sender on the `joinstowaway.app` domain (cost flagged in 2b).

**Stripe test strategy:**
- **Unit:** `fees.ts` quotes (property: kept + fees = collected), ledger postings (always balanced), the booking state machine, and reminder scheduling across DST.
- **DB:** PGlite runs all migrations and checks RLS in both modes. This includes a group-mode equivalence test (old vs new policies return the same rows on randomized fixtures), checks that server-written tables reject client writes, and the ledger balance trigger.
- **Webhook:** fixtures signed with `stripe.webhooks.generateTestHeaderString`, replayed with duplicates and out of order.
- **Integration:** a **staging Supabase project** (second free project) plus Stripe test mode, test connected accounts created through the API, and `stripe listen --forward-to … --forward-connect-to …`.
- **E2E (Playwright, iPhone 13 at 390×844 and desktop):** card 4242, decline 4000 0000 0000 0002, 3DS 4000 0025 0000 3155, ACH test account. Screenshots go to `SHOTS_DIR`.
- **Live check:** a real $1 booking on your own operator account, then a refund. Check the ledger, the fee refund, and that the payout lands on the date we showed.
- **Secrets:** Stripe keys live only in Supabase function secrets, never in `VITE_*`. Hosted Checkout needs no publishable key.

---

## 5. The internal funnel: UI and instrumentation for each stage

Events are queued on the phone in a local-only Dexie table and flushed through `log_event(kind, trip_id, props)` when online, the same offline-first approach as `weather`. Kinds are allowlisted and props carry no PII. Stages the server can see are recorded by triggers or a daily rollup view. There's no third-party analytics, and the privacy page gets updated.

| Stage | UI | Events (where captured) |
|---|---|---|
| 1 Discovery | existing landing page; `?ref=`/utm kept through `/new` | `trip_created{source}` (trigger; `create_trip` gains an optional `p_source`) |
| 2 Activation | existing create and invite; no account required | `invite_shared` (client), `member_joined` (trigger) |
| 3 Aha | none | `trip_engaged` once a trip has ≥3 members, ≥3 votes and items on ≥2 days (daily rollup) |
| 4 Money moment | contextual and secondary-styled, never a banner or modal; one filled button per screen (`docs/UI_COMPONENTS.md`). Shown **only to the trip creator**, dismissible per trip:<br>a) Money tab row "Collect payments for this trip" when there are ≥10 travelers or a shared expense ≥ $100 per person<br>b) after saving a large lodging/transport expense, an inline link<br>c) in Settle up, when the creator is owed by ≥3 people<br>d) when the creator starts a second trip, "Reuse a trip" (Phase 2) | `money_moment_shown{trigger}`, `money_moment_clicked` (client) |
| 5 Upgrade in place | one sheet, inside the trip: sign in (existing Google/email, guest trips carried over) → `claim_trip` → organizer profile (name, support email) → Connect Stripe (Stripe-hosted) → price, deposit and due date → publish and share | `upgrade_started`, `trip_claimed`, `stripe_onboarding_started`, `stripe_connected` (webhook), `offer_published` |
| 6 Paying operator | `/organize` dashboard | `first_payment_collected` (webhook), `reminder_sent` |
| 7 Expansion | templates, past travelers (Phase 2) | `second_trip_run` (≥2 trips with payments), `template_used`, `operator_referred` |

- **Claim rule:** only a device that claims the trip's `created_by` member may claim the trip. Otherwise the transfer goes through support. Every member sees "X is now organizing this trip" in What's new. Claiming doesn't change permissions; switching to hosted is a separate, explicit step.
- **Paywall:** creating trips, inviting, voting, planning, expenses, tickets, offline, and the new roles/removal safety features all stay free. Payment collection (take rate), and later templates, reminders, CRM, campaigns, branded pages, supplier tools and corporate features, are paid.

---

## 6. Phases, acceptance criteria, effort

Every sub-phase can ship and be demoed on its own.

**How to read the effort numbers.** The hours in each phase heading and table are *build effort*: what the work would take a solo developer writing it by hand. Claude writes the implementation (as it has for most of this repo), so your own hours are much lower. What stays with you can't be handed off: interviews, account setup, reviewing security and money code, real-device and live-money checks, and decisions. The calendar is set by outside waits, not by typing.

| Phase | Build effort | **Your hours** | What sets the calendar | Calendar at 10 h/week |
|---|---|---|---|---|
| 0 | 16 h | **30–35** (interviews ≈25, concierge, Stripe application) | Scheduling 10 conversations; the concierge trip's deposit deadline | 4–6 weeks |
| 1A Trust | 32 h | **6–10** (review the role and RLS changes, test on your phone) | Your review; e2e sign-in limits (≈30 anonymous sign-ins per hour per IP) | 1–2 weeks |
| 1B Organizer | 16 h | **3–5** (review the copy, pricing page and claim flow) | – | 1 week |
| 1C Payments | 62 h | **12–20** (Stripe platform and Connect settings, Google Cloud/Gmail setup, Supabase staging, reviewing money code, live $1 booking and refund, the lawyer) | Stripe platform approval; the lawyer review; the first real payout (≈7 days for a new Stripe account) | 3–4 weeks |
| 2 | 170 h | **20–30** | Real operator feedback between slices | 2–3 months |
| 3 | 240 h | **40+** (sales, supplier and corporate contracts) | Signed pilots | When funded |
| 4 | 35 h | Ongoing sales time | Outbound replies | Ongoing |

So Phases 0–1 take about **60–75 of your hours, or 6–8 calendar weeks**, with Phase 0's interviews running alongside 1A and 1B. The build-effort hours are still worth keeping: they show where a bug would be expensive, and they're the honest estimate if you ever hire help.

### Phase 0: Validation and hygiene (about 16 h dev + 25 h founder; 5–6 calendar weeks, interviews set the pace)

**Hygiene (8 h)**
- **Re-verify the Oct 8 QA tickets** against production at 390×844 and desktop:
  - P0: half-typed activity end time gives an inline error, focus, and no write (claimed fixed in `6e5873e`).
  - P1: destination sets the timezone, including offline (`tz-lookup`).
  - P1: switching identity keeps the device store and `trip_devices.member_id` in agreement, and votes are attributed correctly afterwards.
  - P2: FAQ isn't duplicated in the accessibility tree. **`6e5873e` doesn't mention this ticket.** Check with a Playwright `ariaSnapshot` of `/`.
  - P2: dates can be typed and pasted on desktop; the native wheel still appears on the iPhone profile.
- **Mobile sweep:** screenshot every route at 390×844. Assert no horizontal scroll (`scrollWidth ≤ 390`) and touch targets ≥ 44 px.
- **Console and network sweep:** Playwright listeners for `console` errors and warnings, `pageerror`, `requestfailed`, and responses ≥ 400, on public routes plus an `E2E TEST` trip. Log the results in `docs/RELEASE_<date>.md`, then fix them or document why not.
- **Agent truth:**
  - Write `docs/AGENT_API_STATUS.md` (what exists: a read-only MCP connector, not activated).
  - Make the Worker return a real 404 for unknown paths that have file extensions, so `/llms.txt` stops getting the app's page with a 200.
  - Either finish the connector's OAuth setup (about 2 h of dashboard work) or hide it.
  - Publish no `llms.txt` that claims capabilities we don't have.

**Painted door plus instrumentation (8 h):** ship section 5's events and the money-moment affordances. Tapping one opens an honest "Payments for organizers are coming. Get early access" sheet that collects an email.

**Validation (founder):** 10 interviews and a concierge test (section 8). Apply for the Stripe platform account now, so Stripe's view of the business is known early.

**Go/no-go for Phase 1C** (1A and 1B are worth doing either way: they make the free product safer and measure demand):
- **GO** if all of these hold:
  - ≥6 of 10 interviewees collect money by hand today and can name its cost in hours or fees.
  - ≥3 commit to something that costs them (concierge, a pre-payment, an introduction).
  - The concierge operator gets ≥70% of travelers paying deposits by the due date, rates it better than their previous method, and schedules trip two through Stowaway on the 1% shape.
- **NO-GO** if <3 interviewees feel the pain strongly, or no operator agrees to the concierge, or the concierge operator won't commit to trip two. Then switch to the **agent-protocol fallback**: build the spec'd agent API (trip-scoped tokens, REST, webhooks, MCP write tools) as the product's story, keep the free planner, and keep 1A.
- **Pivot within:** if the ops-manager interview is clearly stronger than the operator interviews, re-aim Phase 1C at offsites (approvals, budgets) before operators.

### Phase 1: Operator MVP (build effort about 110 h; about 20–35 of your hours; 5–7 calendar weeks, in three shippable slices)

With Claude writing the code, Phase 1 fits in about 5–7 calendar weeks; the cut list below only matters if outside waits (Stripe, the lawyer) or review time run long. Spring break 2027 deposits are being collected now, so Phase 1 serves the **summer and fall 2027** booking season, and the concierge serves this one.

| Slice | Contents | Hours | Acceptance criteria |
|---|---|---|---|
| **1A Trust** | section 2 in full: migration, `can()`, policy rewrite, removal/revocation, epoch purge, no auto-rejoin after revocation, document visibility, Travelers & access screen, min-version check, PGlite equivalence and role tests | 32 | Every existing e2e spec passes unchanged in group mode. In hosted mode, a traveler can't read another traveler's documents or expenses (checked in PGlite and e2e). A removed phone loses the trip within one sync and can't rejoin through the old link. Works at 390×844 and with keyboard/VoiceOver labels. |
| **1B Organizer** | claim flow (reusing account sign-in), `organizers`, `/operators` landing, `/pricing` with the fee calculator (`src/lib/fees.ts`: price, headcount, deposit/balance, card or ACH, international share, absorb/pass → per-traveler charges, Stripe fee, Stowaway fee, what you keep; Stripe rates as dated constants with a source link); update CLAUDE.md's hard constraints | 16 | A guest trip creator signs in, claims an existing trip retroactively with no data loss and no re-invite, and other members see who organizes it. Calculator property tests pass. Pricing page is checked at 390×844. |
| **1C Payments** | sections 3–4 for Phase 1: Connect onboarding, offers and `/go/:slug`, `checkout-create`, webhook inbox, processor, reconciliation, ledger, booking → traveler join, `/b/:token` balance payment, payout and hold display (section 7 copy), application-fee refunds, dispute alerts, email outbox and reminders (dedicated Gmail account through the Gmail API, plus Gmail SMTP for Supabase Auth email codes), minimal `/organize` dashboard (trips, bookings, collected and due, payouts, CSV export), staging project, test-mode e2e, live $1 check | 62 | **End to end on mobile and desktop:** an operator onboards, publishes a trip page, and a real traveler pays a deposit. The traveler lands in the trip with no account. The operator sees the payout at the arrival date Stripe gave, on their chosen schedule. Ledger reconciliation shows zero mismatches. A refund reverses our fee automatically. |

**Cut first if time runs short**, in this order (each saves about 2–6 h):
1. ACH (card only)
2. payouts history mirror (show the schedule plus a Stripe Dashboard link)
3. dispute alerts (Stripe emails the operator anyway)
4. CSV export
5. automated reminders → a "Send reminder" button (mailto or share sheet)

**Never cut:** 1A, the webhook inbox with idempotency, reconciliation, the ledger balance constraint, the staging project, and the hold/delay copy.

### Phase 2: Repeat-business tooling (about 170 h; ~20 weeks; two slices)
- **2a (≈70 h):** template and clone trip; installment schedules (more than two); in-app refunds with cancellation tiers; financial reporting (per-trip P&L from the ledger, payouts reconciliation, CSV/QuickBooks export); dispute evidence pack; Pro subscription billing and entitlements (the first paid plan; launch is take rate only, and the price is decided here); `trip_invites` (viewer links, expiry).
  - *Accept:* clone last year's trip in under 2 minutes; ≥85% of balances paid by the due date with automated reminders; a Pro charge succeeds and gates templates.
- **2b (≈100 h):** CRM (contacts and past trips, dietary and accessibility intake, tags); waitlists with auto-offer; rooming tied to pricing; email campaigns (consent, unsubscribe, sending limits); referral links paid as credit toward the next trip; organizer staff.
  - *Accept:* send a campaign to past travelers with working unsubscribe; a referral booking credits the referrer; a waitlist spot is offered automatically after a cancellation.
  - *Cost flag:* campaigns need a domain email sender before they ship, because Gmail can't send them (section 4, "Email").

### Phase 3: Supplier layer and corporate tier (about 240 h; **needs a second person, or near full-time**; start only when revenue or a signed corporate pilot funds it)
- **3a Supplier (≈90 h):** supplier directory, one-click hotel RFP (a tokenized response form emailed to hotels), payables tracking, commission tracking, and a season catalog view across trips.
  - Paying suppliers *through* Stowaway would mean moving money between accounts, which reopens the merchant-of-record decision. Under the facilitator model, Phase 3 tracks payables and doesn't move supplier money.
  - Hotel commissions are a business-development and contract question (agent-of-record status), not code.
- **3b Corporate (≈150 h):** organizations and roles, budgets per team, approvals, policy rules checked on plan items and expenses, spend reporting for finance, and duty of care (opt-in check-ins plus "who is where" derived from lodging and itinerary; needs a privacy design and a DPA).
  - **SSO:** Supabase SAML requires a paid plan, so it comes after the first signed contract.
  - **Future fork** (separate app or deployment): only if white-labeling, data residency or a separate compliance posture is demanded. Nothing gets built for it in advance.

### Phase 4: "Switch from WeTravel" (about 35 h dev plus ongoing founder sales time; can start after 2a, it doesn't depend on Phase 3)
- Comparison page built around payout timing and fee transparency. Every competitor claim is dated and sourced; get a legal check on comparative claims.
- **Migration tooling:** CSV import of travelers into contacts/bookings with column mapping and preview, plus an itinerary import from CSV.
- **Migration offer:** we import the traveler list and next trip ourselves within 2 business days; a named human contact answers within 1 business day during migration; the first migrated trip's take rate is waived.
- Outbound aimed at small retreat and wellness operators who depend on deposits.
- *Accept:* 5 operators migrated, each with ≥1 trip collecting through Stowaway.

---

## 7. Hold and delay messages operators see (exact copy, in the dashboard and by email)

- **Onboarding incomplete:** "Finish connecting Stripe to take payments. Stripe needs a few details to verify you. It usually takes about 5 minutes. [Continue with Stripe]"
- **Information due:** "Stripe needs more information by {date}: {plain list}. If it isn't provided, Stripe will pause {payments/payouts} on {date}. This is Stripe's identity check, which every payment provider must do; Stowaway can't waive it. [Provide it in Stripe]"
- **First payout:** "Your first payout is scheduled for {arrival_date}. Stripe holds a new account's first payout for about 7 days (up to 14 in some industries). After that, payouts follow your schedule: {schedule}."
- **Payouts paused:** "Stripe has paused payouts to your bank. Reason Stripe gave: {reason}. {If charges are enabled: Travelers can still pay you; their money is safe in your Stripe balance and pays out once this is resolved.} To fix it: {action}. We'll email you when Stripe lifts the pause. [Open Stripe]"
- **Reserve:** "Stripe is holding {amount} of your balance as a reserve until {date}. Stripe does this for some businesses paid long before the trip happens. Stowaway never holds or receives this money. To ask Stripe to change it, contact Stripe support from your dashboard."
- **Payout failed:** "Your {amount} payout on {date} didn't reach your bank: {reason}. Stripe returned it to your balance. Update your bank details in Stripe and it will retry on your next payout date."
- **Dispute:** "{Traveler} disputed a {amount} payment with their card issuer. Stripe has taken {amount} plus its dispute fee from your balance until it's decided. Respond by {due_by}; after that you can't. [Respond in Stripe]"
- **Traveler, ACH pending:** "Your bank payment is processing (usually about 4 business days). Your spot is held."

---

## 8. Phase 0 validation plan

**Who (10):** 3 student or Greek-life trip leads, 3 retreat or wellness leaders, 2 club or affinity-group leads (ski, church), 1 youth-sports coordinator, and 1 ops manager or chief of staff who runs offsites.

**Where to find them:** Stowaway organizers with accounts, your own network and alumni chapters, retreat-leader communities, LinkedIn for the ops role, and operators who publicly review payment tools.

**Interview script** (ask about past behavior, not hypotheticals; ~45 min; ask to *see* the spreadsheet, Venmo history or payment links):
1. Walk me through the last trip you ran, from idea to everyone home.
2. How did you collect money? Show me.
3. When did you have to pay suppliers, and what did you do when travelers hadn't paid yet?
4. How long from a traveler paying until you could use the money? Has a platform ever held funds? What happened?
5. What did fees cost you last trip? How do you know?
6. Who chased late payers, how, and how many hours did it take?
7. What happened when someone cancelled? Have you had disputes or chargebacks?
8. How did travelers get the itinerary and changes? How many group chats?
9. Did travelers have a say in activities? How did you decide?
10. Do you run the same trip again? What do you reuse? Where do past travelers' details live?
11. What tools have you tried, and why did you stay or leave?
12. If [their top pain] were fixed, what would you stop using? What is that worth per trip?
13. Ask: "Can we run your next trip's deposits this way?" and "Who else should I talk to?"

The **corporate variant** swaps questions 2–7 for: who approves, budgets, how bookings are made, reporting to finance, and duty of care.

**Concierge protocol:**
- **Recruit:** 1–2 operators with a trip leaving in 6–16 weeks and 8–40 travelers.
- **Setup:**
  - We build the trip in Stowaway, disclosing today's privacy model (everyone with the link sees documents, so no sensitive uploads until 1A ships).
  - Payments run through **the operator's own Stripe Payment Links** (deposit and balance). That's zero Stowaway payment code, and they are already the merchant of record.
  - We track who paid and send reminders by hand.
  - Charge a token fee (for example 1% of collected, invoiced afterwards) to test willingness to pay.
- **Measure:**
  - Hours spent chasing payments compared with their previous trip.
  - Share of travelers paid by the due date.
  - Days from payment to usable funds.
  - Traveler engagement (joined, voted).
  - Support requests.
  - Operator NPS.
  - Whether they schedule trip two in Stowaway.
- **Duration:** through the deposit deadline (4–8 weeks), not the trip itself. Retention on trip two is confirmed later.

---

## 9. What to measure, and the numbers that prove it

- **Phase 0:** interview pain count, commitments, concierge results, and painted-door click-through and early-access signups. Signups are supporting evidence only, since traffic is about 1,400 visitors a month.
- **Phase 1 (first 90 days after 1C ships):**
  - Activation: ≥5 operators publish a trip page, and ≥50% of claimers connect Stripe.
  - Revenue: ≥$100k collected (about $1k in take).
  - Checkout success: ≥95%.
  - **Payout reliability:** ≥99% of payouts arrive on or before the arrival date first shown.
  - Webhook processing p95 under 1 minute.
  - 0 unresolved reconciliation mismatches.
- **Phase 2:** **retention**, meaning ≥40% of operators run a second paid trip within 6 months; ≥85% of balances paid on time; template reuse on ≥50% of second trips.
- **Phase 3:** 2 paid corporate offsites; RFP response rate ≥50%.
- **Phase 4:** 5 migrated operators; founder hours per conversion.
- **The switch is working at 12 months if:**
  - ≥10 operators have each collected ≥$10k.
  - ≥40% run a second trip.
  - Take rate plus Pro revenue covers running costs (Supabase Pro, email) by month 6 after 1C.
  - At least one corporate offsite has been paid.

---

## 10. Risk register

| Risk | Mitigation |
|---|---|
| **Stripe declines the platform or reserves operators** (travel is paid long before delivery) | Apply in Phase 0. Choose the facilitator model so holds are per operator and Stripe's call. Show holds plainly (section 7). Never promise payout speed, only "we never hold". |
| **Payments compliance** (surcharging, seller of travel, PCI, privacy) | Hosted Checkout (SAQ A). Booking fee applies to all payment methods. Operator terms make them the seller. A one-off lawyer review of operator terms and fee wording before 1C launches (not $0; flagged). |
| **Scam operator uses Stowaway to take deposits** | Founder review before the first public page, volume cap for new operators, report link, beta capped at 10 operators, Stripe KYC. |
| **Card testing on public checkout** | Stripe Radar, per-IP rate limits in `checkout-create`, capacity locks. |
| **Breaking free trips** | Group-mode defaults, a PGlite equivalence test, the full existing e2e suite as a gate, the min-version check, and migrations that are additive and backward compatible. |
| **Data on Supabase Free (no backups)** | Stripe is the system of record and the ledger can be rebuilt. Move to Pro once revenue covers $25/month. |
| **WeTravel copies voting or planning** | The moat is the combination: a free collaborative workspace that feeds the paid tier, offline, travelers without accounts, and a public fee calculator. Stay narrow (small retreat, student and club operators), move fast, and own the "we never hold your money" claim, which a merchant of record can't copy cheaply. |
| **Sales-motion change** (demos, onboarding, support eat a 10 h week) | Beta capped at 10 operators, weekly office hours instead of ad-hoc demos, written onboarding, support time-boxed to 2 h/week, and Stripe's Dashboard does refunds and disputes. |
| **Seasonality** (spring break deposits happen Sep–Jan; retreats book in winter) | Concierge serves the current season; Phase 1 targets the summer and fall 2027 season. Instrument now so funnel data exists before launch. |
| **Bus factor (one developer)** | Facilitator model: operators' money never depends on Stowaway being up. Runbooks in `docs/` (webhooks, reconciliation, incidents), Stripe as system of record, credentials in a password manager with emergency access, and an incident email template for operators. |
| **Personal liability as a sole proprietor** | The facilitator model keeps payment losses with Stripe and operators, not you. Operator terms include a limitation of liability. Revisit forming an LLC once take-rate revenue is steady or the first corporate contract arrives. |
| **Gmail as the sender** (Google suspends the account, the 500/day cap, or emails land in spam) | A dedicated account limits the blast radius. A daily cap of 400 with an alert. Push notifications back up reminders for travelers who turned them on. Stripe sends its own payment receipts, so a sending outage never hides that a payment went through. Plan the move to a domain sender before 2b, or sooner if suspended. |
| **Friend groups won't pay 1% plus card fees when Venmo is free** | Expected. The funnel's job is to surface the organizers who are really operators. Paywall rules keep the free loop intact. |

---

## 11. Decisions and open questions

**Nothing blocks Phase 1.** Every question that did is decided (29 Oct 2026):

| Question | Decision |
|---|---|
| Money model | Facilitator: operators' own Stripe accounts, direct charges |
| Take rate | Flat 1% of every charge, no minimum, no cap |
| Monetization at launch | Take rate only; Pro subscription in 2a |
| Launch market | US operators, USD only |
| Legal entity | Sole proprietor; one lawyer review (operator terms, fee wording, limitation of liability) before 1C launches |
| Email | A dedicated Stowaway Gmail account (Gmail API; Gmail SMTP for Supabase Auth codes) |
| Default fee mode | The operator absorbs Stripe's fee and our 1%. Operators can switch an offer to a traveler-paid booking fee. |
| Hosted-mode defaults | Travelers vote, rate and comment; they don't edit the plan. New joiners wait for approval (`join_role = 'pending'`). |
| Staging | A second free Supabase project for payments testing; e2e for payments never runs against live |
| Claim rule | Only a device that claims the trip creator's member can claim the trip; any other case goes through support |
| Payout copy | Onboarding recommends daily automatic payouts; the operator sets the schedule in Stripe |
| Referral rewards | Credit toward the next trip, not cash |
| Corporate SSO | After the first signed corporate contract (needs paid Supabase) |
| Phase 4 timing | Starts after 2a; it doesn't wait for Phase 3 |

**Still open, none blocking:**
- Pro price point ($79 or $99 a month): decide when 2a starts.
- Agent API story: a public "agent-ready" story for free planning, versus API and webhooks as a Pro feature for operators. Decide after Phase 0 (it's also the fallback).
- Whether to ever offer a platform-held "traveler protection" option. That would revisit the merchant-of-record decision.

---

## 12. Files the work touches (representative)

- **Migrations:** `supabase/migrations/2026110…_access_roles.sql` (1A), `…_organizers.sql` (1B), `…_payments.sql` and `…_ledger.sql` (1C), `…_product_events.sql` (Phase 0). Copy the `do $$ foreach` template from `20261001000001_route_legs.sql`, and follow the `push_tick` and Vault pattern from `20261009000002_push.sql` for cron jobs.
- **Edge Functions:** `supabase/functions/{stripe-connect,checkout-create,stripe-webhook,stripe-process,email-dispatch}`, plus `_shared/{ledger,stripe}.ts`, modelled on `push-dispatch`.
- **Client:**
  - `src/data/sync/engine.ts`: `SYNCED_TABLES` adds `trip_offers`, `bookings`, `booking_payments`; epoch purge.
  - `src/data/db.ts`: v15+.
  - `src/data/types.ts`.
  - `src/data/device.ts`: role cache.
  - `src/features/trips/actions.ts`: no rejoin after revocation.
  - `src/features/trips/SettingsScreen.tsx`: Travelers & access.
  - `src/features/money/MoneyScreen.tsx` and `ExpenseFormScreen.tsx`: money moment.
  - `src/features/account/account.ts`: reused for claim.
  - New: `src/features/organize/*` (dashboard, offer form, claim sheet), `src/features/booking/*` (`/go/:slug`, `/b/:token`), `src/lib/fees.ts`, and `src/features/website/{OperatorsScreen,PricingScreen}.tsx`.
- **Worker:** `worker/index.ts` (real 404 for unknown file paths).
- **Tests:** PGlite suites beside the migrations' consumers (following `worker/connector-permissions.test.ts`); `tests/e2e/{access-roles,claim,payments}.spec.ts` (payments against staging only); `tests/e2e/cleanup.sql`.
- **Docs:** `CLAUDE.md` (hard constraints, layout), `docs/PAYMENTS.md` (runbook), `docs/AGENT_API_STATUS.md`, privacy and terms (`src/features/legal/LegalScreen.tsx`).

## 13. Verification (for every slice)

`npm run typecheck`, `npm test` (unit, plus PGlite RLS/ledger), and `npm run build` must pass. Then:
- Run the existing Playwright suite unchanged (the group-mode regression gate).
- Run the new specs at 390×844 and desktop, with screenshots inspected.
- Run a keyboard pass, and check accessible names with `ariaSnapshot`.
- Run the console and network listener sweep.
- After applying migrations, run `get_advisors`.
- For 1C: run the full Stripe test-mode flow on staging, then the live $1 booking and refund check.
- Clean up `E2E TEST %` data after each run.

---

## One-page summary (2 minutes)

**What we build first**
- **Phase 0 (5–6 weeks):**
  - Re-verify the Oct 8 QA fixes. The FAQ accessibility ticket was never addressed in the fix commit.
  - Sweep mobile layout and console/network.
  - Record the truth about the agent API. It was never built; only a 2-tool read-only connector exists, and it's switched off.
  - Ship funnel instrumentation and an honest "payments coming" door at the money moment.
  - Run 10 operator interviews and one concierge trip on the operator's own Stripe Payment Links.
  - Apply for the Stripe platform account.
- **Phase 1 (three shippable slices; about 20–35 of your hours with Claude writing the code):**
  - **1A Trust:** roles, hosted mode, removal and revocation, private documents. Required, because today anyone with the link sees everything, and a removed phone would silently rejoin.
  - **1B Organizer:** claim a trip in place, plus the pricing page and fee calculator.
  - **1C Payments:** Stripe Connect as a facilitator, deposits and balance by link, webhook inbox, ledger, reminders, minimal dashboard.

**The pitch this makes true:** "We never hold your money. It goes straight to your own Stripe account on your own payout schedule. Here is exactly what you'll pay." When Stripe holds something, we say so, why, and when it ends.

**What it costs:** about 60–75 of your hours through Phase 1, or 6–8 calendar weeks at 10 h/week, set by Stripe approval, interviews and the lawyer rather than by coding. Build effort is about 125 h, written by Claude. Phase 2 is 20–30 of your hours. Phase 3 needs sales and contracts more than code, and starts when a pilot funds it. Cash costs: Stripe fees are paid by operators; email goes through a dedicated Gmail account for free (a paid domain sender before Phase 2b campaigns); a one-off legal review; Supabase Pro ($25/month) once revenue covers it. Revenue at launch is a flat 1% of what operators collect, with Pro added in Phase 2.

**What could kill it**
- Operators don't feel the payment pain strongly enough (Phase 0 tests this).
- Stripe declines the platform or reserves heavily on travel operators.
- A 10 h week drowns in support.
- We miss the summer and fall 2027 booking season.
- A permissions bug exposes one traveler's documents to another (that's why 1A ships first, with equivalence tests).

**Already decided:** flat 1% take, take rate only at launch, US/USD only, sole proprietor, Gmail.

**Also decided:** the operator absorbs fees by default; hosted travelers vote but don't edit, and new joiners need approval; one lawyer review before 1C; a staging Supabase project; only the trip creator can claim; a dedicated Stowaway Gmail account.

**Nothing blocks the start.** Begin with Phase 0 (hygiene, instrumentation, interviews, the Stripe platform application) and 1A in parallel.
