# What you need to do: switching on organizer payments and Pro tools

Written 1 Nov 2026, when the "Switch" work (Phases 1A to 2c and the Phase 4 imports) was merged into `main`.
Everything in this list needs your accounts, your approval or your judgment, so no one else can do it.
Work through it in order. Steps 1 and 2 matter this week; the rest can follow at your own pace.

Related documents: `docs/PAYMENTS.md` (the technical runbook), `docs/PLAN_THE_SWITCH.md` (the plan and its status).

---

## 0. What changed on the live site when this was merged

Cloudflare deployed `main` within about 90 seconds of the merge. People can see these now:

- **New pages:** `/operators` (for organizers) and `/pricing` (with the fee calculator). The landing page footer links to them. The pricing page says payments are "coming soon".
- **Trip settings → "Import a plan from a spreadsheet":** works now, entirely on the phone.
- **Money tab, for the creator of a trip with 10+ people (or a big shared expense):** a quiet "Collect payments for this trip" row. Tapping it opens an "early access" sheet. **Until step 1 is done, submitting that sheet shows an error**, because the server function it calls doesn't exist yet.

Everything else stays hidden until the database has the new tables: roles and hosted trips, organizer claiming, the payments screens, trip pages, bookings, and every Pro tool. The app was built to cope with a server that doesn't have them yet. Existing group trips behave exactly as before.

**One test-only caveat:** `tests/e2e/cleanup.sql` now deletes from the new tables. It fails until step 1 is done. Until then, use `git show 187e23c:tests/e2e/cleanup.sql`, the version from before the merge.

---

## 1. Apply the 11 database migrations (this week, about 30 minutes)

**What's live today:** every migration up to and including `20261012000004_traveler_profiles.sql`. Some of them were applied without a history entry, so `list_migrations` shows other names and dates. That's fine.

**What's missing:** these 11 files, applied **in this order** (filename order):

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
Open a Claude Code session on this repo with the Supabase connector, and say **"apply the migrations"**. Claude applies them one at a time with `apply_migration`, checks each one, and runs the security advisors afterwards. It hasn't done this yet only because it needs your explicit go-ahead to change the live database.

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

Work in **test mode** first for everything here and in steps 4–7. Repeat it in live mode at step 9.

1. Create a Stripe account at stripe.com:
   - Business type **sole proprietor** (your name and SSN).
   - Business name **Stowaway**, website `https://joinstowaway.app`.
   - Your bank account. No card is needed.
2. **Connect → Get started.** Platform type: you let **organizers** (who sell group trips) accept payments. Charges are **direct charges** on their accounts. You earn an **application fee** (1%).
3. **Settings → Connect → Onboarding options:**
   - Country: **United States** only.
   - Make sure organizers get the **full Stripe Dashboard**. Our code creates accounts where they handle their own refunds and disputes, and Stripe carries the losses.
4. **Settings → Connect → Branding:** name "Stowaway", the suitcase icon, and the brand color `#245b69` (the app's action color).
5. **Developers → API keys:** copy the **test secret key** (`sk_test_…`). You'll put it in step 5, never in the app or in Git.
6. **Developers → Webhooks**: add **two** endpoints, both to `https://croqjdvzbpcscdcshnet.supabase.co/functions/v1/stripe-webhook`:
   - **"Listen to events on your account"** with events `account.updated` and `account.application.deauthorized`. Copy its signing secret: that's `STRIPE_WEBHOOK_SECRET`.
   - **"Listen to events on Connected accounts"** with these events. Copy its signing secret: that's `STRIPE_CONNECT_WEBHOOK_SECRET`.
     - `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`
     - `charge.refunded`, `charge.refund.updated`
     - `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`
     - `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, `payout.canceled`
     - `account.updated`

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
| `STRIPE_SECRET_KEY` | `sk_test_…` now; the live key at step 9 |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the "your account" endpoint |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | `whsec_…` from the "connected accounts" endpoint |
| `SITE_URL` | `https://joinstowaway.app` |
| `GMAIL_CLIENT_ID` | from step 4.2 |
| `GMAIL_CLIENT_SECRET` | from step 4.2 |
| `GMAIL_REFRESH_TOKEN` | from step 4.3 |
| `GMAIL_SENDER` | the Stowaway Gmail address |

Never put any of these in a `VITE_` variable, in `.env.production`, or in Git.

The cron jobs reuse the Vault secrets that push notifications already use (`project_url`, `cron_token`). They're already set, so there's nothing to do there.

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

1. **Become an organizer:**
   1. On joinstowaway.app, sign in with Google or email (Settings → account).
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
4. **The $1 test:**
   1. Publish a real trip page on your own organizer account with a $1 price.
   2. Pay it with your own card.
   3. Check the receipt email and the booking in Payments.
   4. Refund it from the app.
   5. Confirm Stripe returns our fee.
   6. Watch for the payout on the date Stripe shows. A new Stripe account's first payout usually takes about 7 days.
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
- **The `ORS_API_KEY` secret**, so travel times use OpenRouteService instead of the public OSRM server.
- **Phase 0 of the plan:** the 10 organizer interviews and the concierge trip. These decide whether payments are worth pushing hard (`docs/PLAN_THE_SWITCH.md` section 8).
- **A staging Supabase project** (second free project) for testing payments away from the live database. Recommended in the plan; optional if you're careful with test mode.

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
