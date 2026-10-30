# Collecting payments: runbook

How organizers collect deposits and balances (`docs/PLAN_THE_SWITCH.md`, sections 4 and 7).

**Facilitator model.** Each organizer connects their own Stripe account. Every payment is a direct charge on it, so the organizer is the merchant of record and Stripe pays them out on their own schedule. Stowaway takes a flat 1% application fee, gives it back pro rata when the organizer refunds, and never holds money. Stripe is the system of record; the tables here mirror it.

## How it fits together

| Piece | Where | What it does |
|---|---|---|
| Schema and state changes | `supabase/migrations/20261101000001_payments.sql` | Offers, bookings, payments, payouts, disputes, ledger, webhook inbox, email outbox. All writes go through `pay_*` functions that only the service role can call. |
| Cron | `20261101000002_payments_cron.sql` | Every minute, wakes `stripe-process` and `email-dispatch` only when work is waiting. Daily at 14:07 UTC: reminders and reconciliation. |
| Shared logic (tested) | `supabase/functions/_shared/` | `stripe.ts` (client, webhook signatures), `checkout.ts`, `process.ts` (events → database), `email.ts` (templates, Gmail), `fees.ts` (also used by `/pricing`) |
| `stripe-connect` | Edge Function, signed-in account | Creates the organizer's Stripe account (controller properties equivalent to Standard) and returns the Stripe onboarding link, or refreshes its status. |
| `checkout-create` | Edge Function, any signed-in phone (guests too) | Holds a place and returns the Stripe Checkout URL for the first payment, or for the balance from a booking's private link. |
| `stripe-webhook` | Edge Function, `verify_jwt` off | Checks the signature, stores the event once, answers 200, then processes it. |
| `stripe-process` | Edge Function, `verify_jwt` off, cron token | Retries unfinished events; daily: balance reminders and reconciliation. |
| `email-dispatch` | Edge Function, `verify_jwt` off, cron token | Sends queued email through Gmail, at most 400 a day. |

**Events handled:** `checkout.session.completed`, `.async_payment_succeeded`, `.async_payment_failed`, `.expired`; `charge.refunded`, `charge.refund.updated`; `charge.dispute.created`, `.updated`, `.closed`; `payout.created`, `.updated`, `.paid`, `.failed`, `.canceled`; `account.updated`; `account.application.deauthorized`. Each handler fetches the object again from Stripe, so duplicate, late or out-of-order deliveries end in the same state.

## One-time setup (yours)

Do everything in **test mode** first, end to end, then repeat it in live mode.

### 1. Stripe platform account
1. Create a Stripe account as a sole proprietor, with business name "Stowaway" and your bank account. No card is needed.
2. In Connect, complete the platform profile: you're a platform for organizers who sell group trips, charges are direct, and you take an application fee.
3. Settings → Connect → Branding: name "Stowaway", icon, and brand color.

### 2. Webhook endpoints
The URL for both is `https://croqjdvzbpcscdcshnet.supabase.co/functions/v1/stripe-webhook`.

- **Your account** endpoint, with events `account.updated` and `account.application.deauthorized`. Its signing secret becomes `STRIPE_WEBHOOK_SECRET`.
- **Connected accounts** endpoint, with the checkout, charge, dispute, payout and `account.updated` events listed above. Its signing secret becomes `STRIPE_CONNECT_WEBHOOK_SECRET`.

### 3. Gmail sender
1. Create a dedicated Gmail account for Stowaway (not your personal one). Turn on 2-Step Verification.
2. In the Google Cloud project you already use for Routes:
   - Enable the **Gmail API**.
   - Create an OAuth client of type "Web application", with redirect URI `https://developers.google.com/oauthplayground`.
   - On the consent screen, add the `https://www.googleapis.com/auth/gmail.send` scope and set publishing status to **In production**. In Testing, the refresh token stops working after 7 days. The "unverified app" warning only appears when you consent, once.
3. In the OAuth Playground (gear icon → "Use your own OAuth credentials"):
   - Authorize the `gmail.send` scope while signed in as the Stowaway Gmail account.
   - Exchange the code for tokens and copy the **refresh token**.
4. Optional, for sign-in codes: Supabase → Authentication → SMTP. Use host `smtp.gmail.com`, port 465, the Stowaway address, and an app password from that account.

### 4. Secrets
Supabase → Edge Functions → Secrets:

| Secret | Value |
|---|---|
| `STRIPE_SECRET_KEY` | Restricted or secret key (test, then live) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the "Your account" endpoint |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Signing secret of the "Connected accounts" endpoint |
| `STRIPE_API_VERSION` | Optional; otherwise the account's default version applies |
| `SITE_URL` | `https://joinstowaway.app` |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | From step 3 |
| `GMAIL_SENDER` | The Stowaway Gmail address |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase.

### 5. Database and functions
1. Apply the migrations in filename order (the access, funnel and organizer migrations come first).
2. Deploy the five functions. Turn **off** "Verify JWT" for `stripe-webhook`, `stripe-process` and `email-dispatch`; they check the Stripe signature or the cron token themselves.
3. Run `get_advisors` (security) and expect only the known warnings (CLAUDE.md).

### 6. Letting an organizer go live
New organizers' trip pages stay hidden until you check them: look at their website or socials, and talk to them. Then:

```sql
update public.organizers set reviewed_at = now() where slug = '<their-slug>';
-- Optional: raise the default $25,000 collection limit after a second check.
update public.organizers set collect_limit_minor = 10000000 where slug = '<their-slug>';
```

## Checking it in test mode
Use your own organizer account with Stripe test data (onboarding accepts test values).

1. **Card payments:**
   - `4242 4242 4242 4242` pays the deposit. The booking becomes active, the traveler joins the trip, and two emails are queued.
   - `4000 0000 0000 0002` is declined. Nothing changes and the place frees after 35 minutes.
   - `4000 0025 0000 3155` triggers 3D Secure.
2. **Bank payments:** a test bank account. The payment shows as processing, then succeeds or fails.
3. **Balance:** pay it from the booking link (`/b/<token>`). The booking becomes paid.
4. **Refunds:** refund part of the payment in the organizer's Stripe Dashboard. `booking_payments.refunded_minor` updates, and our application fee is refunded pro rata, once.
5. **Disputes:** use the dispute test card `4000 0000 0000 0259`. A `disputes` row appears and the organizer gets an email.
6. **Payouts:** a payout appears in `payouts`.
7. **Ledger:** `select sum(amount_minor) from private.ledger_entries` is 0.
8. **Live check:** a real $1 booking on your own account, then refund it. Check that the payout arrives on the date Stripe shows.

## Day to day

```sql
-- Webhooks that haven't finished
select id, type, attempts, last_error from private.stripe_events where processed_at is null order by received_at;
-- Emails that failed
select to_email, template, attempts, last_error from private.email_outbox where sent_at is null and attempts > 0;
-- What an organizer has collected, refunded and kept (from the ledger)
select account, sum(amount_minor) from private.ledger_entries where organizer_id = '<id>' group by 1;
```

- **Refunds and disputes** are handled in the organizer's own Stripe Dashboard (they have the full dashboard). Stowaway mirrors them and returns its fee on refunds automatically.
- **Payout schedule** belongs to the organizer, in their Stripe settings. Stowaway shows it but can't change it.
- **If the database were lost**, the ledger can be rebuilt from Stripe. Replay each connected account's Checkout Sessions with `reconcileAccount` and its payouts through `processEvent`.
