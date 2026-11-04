# What you need to do: switching on organizer payments and Pro tools

Written 1 Nov 2026, when the "Switch" work (Phases 1A to 2c and the Phase 4 imports) was merged into `main`.
Technical setup can be performed through authorized account connections. Account verification, sender consent and launch decisions still need the owner.

Related documents: `docs/PAYMENTS.md` (the technical runbook), `docs/PLAN_THE_SWITCH.md` (the plan and its status).

## Staging progress — 3 Nov 2026

- Existing free project **stowaway-staging** (`knufofvmqopuvijvtzow`) now has all **34** repository migrations and matching migration history, 54 application tables, and the payment cron jobs.
- Anonymous sign-in and email sign-in are enabled. All six payment functions are deployed with their intended JWT settings. Unauthenticated payment requests and unsigned webhooks are rejected.
- Vault has staging-specific `project_url` and `cron_token` secrets. The hosted staging frontend is https://codex-operator-completion-trip-hub.alexanderclem12.workers.dev. The Edge Function `SITE_URL`, database `site_url` and Auth Site URL point there; Auth permits exactly its callback and `http://localhost:5173/auth/callback`. Email confirmation, eight-digit codes and MFA settings were preserved. The local staging frontend also runs at `http://localhost:5173`, using gitignored `.env.local` in the `stowaway-operator` worktree.
- A real browser test created a test trip and itinerary, then joined from a second browser identity and verified the itinerary synced. Those two test trips were cleaned up afterwards. Production was not changed.
- Stripe **New business sandbox** (`acct_1UL8PQJp9X6ETQDO`, test mode) has two enabled Snapshot webhook endpoints at the staging function URL: platform `we_1UXrnVJp9X6ETQDOghFdRXwe` and connected accounts `we_1UXrnhJp9X6ETQDOdbVPko5F`, API version `2026-10-28.endive`.
- Both webhook signing secrets are installed in staging, with `STRIPE_API_VERSION=2026-10-28.endive`. Remaining: a permanent server Stripe key, creation and authorization of the dedicated Gmail sender, then the payment/refund/email checks in step 7. Created webhook destinations alone do not establish working payments.
- Cloudflare branch builds use the committed public `.env.staging` settings and matching `wrangler.jsonc` Preview bindings. Main builds use `.env.production`. Both built browser bundles were checked to exclude the other database's URL. For a local staging build, run `npm run typecheck` then `npx vite build --mode staging`. The existing keepalive workflow now pings staging as well as production every three days.

The Stripe connector currently returns `Unknown tool`; the official Stripe CLI is authorized for the sandbox as a fallback. Supabase migrations and function deployment used its connector. Edge Function secret writes require the dashboard or authenticated Supabase CLI because that connector does not expose secret management.

---

## 0. What changed on the live site when this was merged

Cloudflare deployed `main` within about 90 seconds of the merge. People can see these now:

- **New pages:** `/operators` (for organizers) and `/pricing` (with the fee calculator). The landing page footer links to them. The pricing page says payments are "coming soon".
- **Trip settings → "Import a plan from a spreadsheet":** works now, entirely on the phone.
- **Money tab, for the creator of a trip with 10+ people (or a big shared expense):** a quiet "Collect payments for this trip" row. Tapping it opens an "early access" sheet. It works now that step 1 is done.

The new tables were applied on 2 Nov. Organizer claiming, hosted-trip controls and Pro screens are available to the appropriate roles. Taking payments still requires the account and function setup below. Existing group trips retain their original permissions.

`tests/e2e/cleanup.sql` also deletes from the new tables, which exist now that step 1 is done.

---

## 1. Apply the 11 database migrations — ✅ done 2 Nov 2026

Claude applied all 11 in filename order, plus a 12th, `20261106000001_organizer_rpcs_signed_in.sql`. That one stops visitors who aren't signed in from calling the organizer-only functions.

**Checked before and after:**
- **Counts unchanged:** 8 trips, 22 phones, 14 people, 7 places, 20 plan items, 2 expenses. The phone-to-trip fingerprint is identical.
- **Access unchanged:** for every phone and every trip (152 pairs), read, plan, money and documents access is exactly as before. Every trip is in group mode and nobody holds organizer rights.
- **Security advisors:** only the expected kinds of warning. People who aren't signed in can call just the six traveler-facing functions (trip page, booking page, held place, waitlist, booking answers, unsubscribe).

The rest of this section is kept for reference, in case the migrations ever need applying to another project (for example a staging one).


**Before the 2 Nov migration pass:** the live schema included every migration up to `20261012000004_traveler_profiles.sql`. Some were applied without matching history entries; the pass reconstructed this drift before applying the newer migrations.

**Applied on 2 Nov:** these 11 files, **in this order** (filename order), plus `20261106000001_organizer_rpcs_signed_in.sql`:

| # | File | What it adds |
|---|---|---|
| 1 | `20261030000001_access_roles.sql` | Roles, hosted trips, removing people, private documents. Rewrites every table's access rules. |
| 2 | `20261030000002_product_events.sql` | Anonymous funnel counts, the early-access sign-up |
| 3 | `20261031000001_organizers.sql` | Organizer profiles; claiming a trip |
| 4 | `20261101000001_payments.sql` | Offers, bookings, payments, payouts, disputes, ledger, webhook inbox, email outbox |
| 5 | `20261101000002_payments_cron.sql` | A cron job every minute, plus a daily one at 14:07 UTC. They call the payment functions only when work is waiting. |
| 6 | `20261102000001_pro.sql` | Pro gating (free during beta) |
| 7 | `20261102000002_repeat_business.sql` | Run a trip again, installments, refunds, policy history, reports, invite links |
| 8 | `20261103000001_travelers.sql` | Booking questions, past travelers, waitlist, rooms, rooming board |
| 9 | `20261104000001_campaigns.sql` | Campaigns (sending switched off) |
| 10 | `20261104000002_referrals.sql` | Referral credits |
| 11 | `20261105000001_imports.sql` | Importing past travelers from CSV |

### The easy way
Production is already migrated. For a new staging project, use the Supabase connector to apply the complete repository migration history in filename order, checking each migration and the security advisors. The table above lists the operator additions, not the full history required by a fresh database.

### By hand (Supabase dashboard → SQL Editor)
1. **Before:** take a snapshot so you can confirm nothing changed for real trips.
   ```sql
   select count(*) as trips from public.trips where deleted_at is null;
   select count(*) as phones from public.trip_devices;
   select t.name, count(d.*) as phones from public.trips t left join public.trip_devices d on d.trip_id = t.id
   where t.deleted_at is null group by t.name order by t.name;
   ```
2. Paste each file's whole contents into the SQL Editor and run it, one file at a time, in filename order. If one fails, **stop**. Don't skip it and go on to the next.
3. **After:** run the same three queries. The numbers must be identical. Every existing trip is now in `group` mode, and everyone on it keeps editing exactly as before.
   ```sql
   select access_mode, count(*) from public.trips group by 1;   -- all 'group'
   ```
4. Supabase → Advisors → Security. Two kinds of warning are expected and fine (CLAUDE.md, "Check"):
   - "Security definer" functions. Each one checks access itself.
   - "Anonymous access" policies.

   Anything else is worth a look before you go on.
5. On your phone, open "Guatemala SB 27". Add something, vote, check the map, and open a ticket. Then do the same from a second phone.

**If something looks wrong for a real trip**, say "roll back the access roles migration" in a Claude session. Rollback SQL was tested when 1A was built.

---

## 2. Decide on the timing for payments (no work, just a decision)

None of the payment parts do anything until you finish steps 3–7. Nobody can be charged by accident:

- A trip page only appears after **you** mark its organizer as reviewed (step 8).
- An organizer needs a connected Stripe account.

There are roughly 4–6 hours of your own setup below, plus outside waits: Stripe's review, the lawyer, and the first payout.

---

## 3. Stripe platform account (about 1 hour, then Stripe's review)

Use a separate Stripe **sandbox** and a separate Supabase staging project for steps 4–7. Keep staging connected-account IDs and bookings out of production. Repeat the configuration with live credentials and newly onboarded live connected accounts at step 9.

1. Create a Stripe account at stripe.com:
   - Business type **sole proprietor** (your name and SSN).
   - Business name **Stowaway**, website `https://joinstowaway.app`.
   - Your bank account. No card is needed.
2. **Connect → Get started.** Platform type: you let **organizers** (who sell group trips) accept payments. Charges are **direct charges** on their accounts. You earn an **application fee** (1%).
3. **Settings → Connect → Onboarding options:**
   - Country: **United States** only.
   - Make sure organizers get the **full Stripe Dashboard**. Our code creates accounts where they handle their own refunds and disputes, and Stripe carries the losses.
4. **Settings → Connect → Branding:** name "Stowaway", the suitcase icon, and the brand color `#245b69` (the app's action color).
5. **Developers → API keys:** create a dedicated **restricted sandbox key** (`rk_test_…`) with the permissions required by the payment functions. You'll put it in step 5, never in the app or in Git. Do not use the CLI's expiring authorization as the deployed application's key.
6. **Workbench → Webhooks → Create an event destination**: use **Snapshot** payloads, which the current handler expects. Add **two** endpoints, both to `https://<staging-project-ref>.supabase.co/functions/v1/stripe-webhook` during testing. Use `croqjdvzbpcscdcshnet` only when configuring production:
   - **"Listen to events on your account"** with events `account.updated` and `account.application.deauthorized`. Copy its signing secret: that's `STRIPE_WEBHOOK_SECRET`.
   - **"Listen to events on Connected accounts"** with these events. Copy its signing secret: that's `STRIPE_CONNECT_WEBHOOK_SECRET`.
     - `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`
     - `charge.refunded`, `charge.refund.updated`
     - `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`
     - `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, `payout.canceled`
     - `account.updated`
     - `account.application.deauthorized` (connected-account disconnections)

If Stripe asks what you sell, the honest answer is: software for organizers of group trips, who are the merchants of record. Stowaway never holds traveler money.

---

## 4. The Stowaway Gmail sender (about 45 minutes)

Booking confirmations, payment receipts, balance reminders and waitlist offers go out from a **dedicated** Gmail account. That way a problem with it can never touch your personal email.

1. Create a new Gmail account for Stowaway (for example `stowaway.trips@gmail.com`). Turn on **2-Step Verification**. Put the recovery details in your password manager.
2. In **Google Cloud Console**, using the project you already use for the Routes traffic button:
   1. APIs & Services → Library → enable the **Gmail API**.
   2. OAuth consent screen:
      - User type **External**.
      - App name "Stowaway".
      - Add the scope `https://www.googleapis.com/auth/gmail.send`.
      - Then **Publish app** (status **In production**). In "Testing" status Google kills the token after 7 days and emails stop. You'll see an "unverified app" warning once, when you approve it yourself; that's expected.
   3. Credentials → Create credentials → **OAuth client ID** → Web application. Authorized redirect URI: `https://developers.google.com/oauthplayground`. Copy the **client ID** and **client secret**.
3. Go to https://developers.google.com/oauthplayground:
   1. Gear icon → tick **Use your own OAuth credentials** → paste the client ID and secret.
   2. In "Input your own scopes", enter `https://www.googleapis.com/auth/gmail.send` → **Authorize APIs**. Sign in as the **Stowaway** Gmail account, not your own.
   3. **Exchange authorization code for tokens** → copy the **refresh token**.
4. Optional, but it fixes sign-in emails that only arrive a few times an hour:
   - Generate an **app password** for the Stowaway account (Google Account → Security → App passwords).
   - Then in Supabase → Authentication → **SMTP Settings**: host `smtp.gmail.com`, port `465`, user is the Stowaway address, password is the app password, sender name "Stowaway".

Gmail allows about 500 recipients a day. The code stops at 400 a day; anything over waits for the next day.

---

## 5. Secrets in Supabase (10 minutes)

Supabase dashboard → **Edge Functions → Secrets** (Manage secrets). Add:

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | Dedicated restricted sandbox key now; a separate live key at step 9 |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the "your account" endpoint |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | `whsec_…` from the "connected accounts" endpoint |
| `SITE_URL` | Staging frontend URL for staging; `https://joinstowaway.app` for production |
| `GMAIL_CLIENT_ID` | from step 4.2 |
| `GMAIL_CLIENT_SECRET` | from step 4.2 |
| `GMAIL_REFRESH_TOKEN` | from step 4.3 |
| `GMAIL_SENDER` | the Stowaway Gmail address |

Never put any of these in a `VITE_` variable, in `.env.production`, or in Git.

The production cron jobs reuse the Vault secrets that push notifications already use (`project_url`, `cron_token`), reported set in the earlier setup. A new staging project needs its own `project_url` and randomly generated `cron_token` in Vault. Also change both its Edge Function `SITE_URL` secret and `private.app_settings.site_url` to the staging frontend URL.

The database value is JSONB; set a URL as a JSON string:

```sql
update private.app_settings
set value = to_jsonb('http://localhost:5173'::text)
where key = 'site_url';
```

---

## 6. Deploy the six payment functions (20 minutes)

**The easy way:** in a Claude session with the Supabase connector, say **"deploy the payment functions"**.

**By hand**, from the repo folder on your laptop (PowerShell or Git Bash):

```bash
npx supabase login
```

```bash
npx supabase functions deploy stripe-connect --project-ref croqjdvzbpcscdcshnet
```

```bash
npx supabase functions deploy checkout-create --project-ref croqjdvzbpcscdcshnet
```

```bash
npx supabase functions deploy refund-create --project-ref croqjdvzbpcscdcshnet
```

```bash
npx supabase functions deploy stripe-webhook --project-ref croqjdvzbpcscdcshnet --no-verify-jwt
```

```bash
npx supabase functions deploy stripe-process --project-ref croqjdvzbpcscdcshnet --no-verify-jwt
```

```bash
npx supabase functions deploy email-dispatch --project-ref croqjdvzbpcscdcshnet --no-verify-jwt
```

The last three **must** have "Verify JWT" off. Stripe and the cron job can't send a login token; those functions check the Stripe signature or the cron token instead. In the dashboard, Edge Functions should now list them next to `route-legs`, `push-dispatch`, `ticket-cleanup` and `traffic-route`.

---

## 7. Test the whole flow in test mode (1–2 hours)

Run this section against the staging frontend and staging Supabase, using the Stripe sandbox. Every `--project-ref` in the function deployment commands must name staging for this test.

1. **Become an organizer:**
   1. On the staging frontend, sign in with Google or email (Settings → account).
   2. Create a test trip named `E2E TEST my operator trip`.
   3. Trip settings → People → **Organize this trip**: enter your name and support email.
   4. More → **Payments** → **Connect Stripe**. Stripe's test onboarding accepts fake data: phone `000-000-0000`, SMS code `000000`, SSN `000-00-0000`, and test bank routing `110000000`, account `000123456789`.
2. **Mark yourself reviewed** (SQL Editor):
   ```sql
   update public.organizers set reviewed_at = now() where support_email = '<your support email>';
   ```
3. In Payments, set:
   - a price, a deposit and a balance date;
   - a cancellation policy;
   - optionally a payment plan, refund steps, booking questions and room types.

   Then **Publish trip page**.
4. Open the trip page (`/go/<slug>`) in a **private window** (a traveler with no account) and book:
   - `4242 4242 4242 4242`, any future date, any CVC. You should land on "You're in". Two emails arrive: a receipt to the traveler address and a notice to you.
   - Try `4000 0000 0000 0002` (declined), and `4000 0025 0000 3155` (3-D Secure).
5. From the booking link (`/b#t=…` in the receipt email), pay the next installment.
6. In Payments, tap the traveler → **Refund**. Check that Stripe shows the refund, and that our 1% fee was returned automatically: Stripe → Connect → Collected fees.
7. Check the ledger always balances. This must return 0:
   ```sql
   select sum(amount_minor) from private.ledger_entries;
   ```
8. Check that the cron jobs are working:
   ```sql
   select jobname, schedule from cron.job;   -- push jobs + payments-tick + payments-daily
   select type, attempts, last_error from private.stripe_events where processed_at is null;   -- should be empty
   select to_email, template, last_error from private.email_outbox where sent_at is null;    -- should be empty after a minute
   ```
9. Clean up the test data afterwards with `tests/e2e/cleanup.sql` (it deletes only trips named `E2E TEST %`).

If anything fails, paste the error into a Claude session. The webhook inbox keeps every event, so nothing is lost while you fix it.

---

## 8. One lawyer review before taking real money (an outside wait)

Agreed when the plan was made. Ask a US lawyer who knows payments or consumer law to read:

- **Operator terms.** There are none yet; the lawyer can draft them from `docs/PLAN_THE_SWITCH.md` section 4. They should say the organizer is the seller and merchant of record and is responsible for delivering the trip and for refunds. They should also cap your liability as a sole proprietor and ban Stripe's restricted businesses.
- **The "booking fee" wording.** When an organizer passes fees on, travelers see a "Booking fee" line, charged the same for card and bank. Ask whether that's fine under US surcharge rules in the states you care about.
- **The privacy page** (`/privacy`, new section "Booking a trip with an organizer"). Booking answers can include health information (dietary and accessibility needs).
- **Comparison claims about WeTravel.** Not built, on purpose. Only publish them dated, sourced, and after this review.

Also check whether your state or county needs a **DBA** filing to trade as "Stowaway". The 1% income goes on your personal tax return.

---

## 9. Go live (about 1 hour)

1. Activate your Stripe account (finish its verification), then switch the dashboard to **Live mode**.
2. Repeat step 3.5 and step 3.6 in live mode: a live secret key and two live webhook endpoints, each with its own signing secret.
3. Replace the three Stripe secrets in Supabase with the live values (step 5). No redeploy is needed.
4. **First real booking:** after the launch review and sandbox verification, onboard a live pilot operator and monitor a legitimate traveler booking: receipt, booking, fees and the payout date Stripe reports. Exercise payment/refund scenarios with test cards in the sandbox; handle real refunds when a customer actually needs one. Do not create a live self-payment to test the integration: [Stripe prohibits live-mode testing with real payment details](https://docs.stripe.com/testing).
5. Change the pricing page's "coming soon" once you're ready for organizers. Ask Claude to do it.

---

## 10. Letting real organizers in

New organizers' trip pages stay hidden until you've checked them: talk to them, and look at their website or socials. Then:

```sql
update public.organizers set reviewed_at = now() where slug = '<their-slug>';
-- After a second check, you can raise the default $25,000 total they can collect:
update public.organizers set collect_limit_minor = 10000000 where slug = '<their-slug>';
```

The plan caps the beta at 10 organizers. Stripe vets each one again during their own onboarding.

---

## Switches you control

All of these live in `private.app_settings`. Change them in the SQL Editor:

| Setting | Now | What it does |
|---|---|---|
| `pro_free_beta` | `true` | Every organizer gets the Pro tools free: run a trip again, reports, past travelers, waitlist, rooms, campaigns, referral credits, importing travelers. When you decide on a price, set it to `false`. Then only organizers with `plan = 'pro'` (and `pro_until` unset or in the future) keep them. There's no billing yet; that's a later decision. |
| `campaign_sending` | `false` | Campaign emails wait in the queue. **Leave it off** until Stowaway has a sender on its own domain (for example a transactional email service with `joinstowaway.app` verified). Gmail mustn't send bulk email. Turning it on also needs a small code change in `email-dispatch` to send that channel through the new sender; ask Claude when you have one. |
| `site_url` | `https://joinstowaway.app` | The address used in waitlist and campaign emails |

```sql
update private.app_settings set value = 'false' where key = 'pro_free_beta';   -- example
```

---

## Still open from before this work

- **The real-iPhone check:** airplane mode with the offline map, and push notifications on a Home Screen install.
- **Routing provider verification:** `ORS_API_KEY` and `GOOGLE_ROUTES_API_KEY` are present in production's secret-name inventory as of 3 Nov; their current provider authorization was not exercised during operator setup.
- **Phase 0 of the plan:** the 10 organizer interviews and the concierge trip. These decide whether payments are worth pushing hard (`docs/PLAN_THE_SWITCH.md` section 8).
- **Staging payment and email verification:** the separate free project is now initialized; payment credentials, sender authorization and the full external integration checks remain.

## Quick health checks (any time)

```sql
-- Webhooks that haven't finished
select id, type, attempts, last_error from private.stripe_events where processed_at is null order by received_at;
-- Emails that failed
select to_email, template, attempts, last_error from private.email_outbox where sent_at is null and attempts > 0;
-- Emails sent in the last day (limit 400)
select count(*) from private.email_outbox where sent_at > now() - interval '1 day';
-- Funnel: what people did each day
select * from private.funnel_daily order by day desc limit 14;
-- Early-access requests from organizers
select * from private.early_access_requests order by created_at desc;
```
