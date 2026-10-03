# Push notifications and scheduled jobs

Free, with no third-party push service: Web Push (VAPID) from a Supabase Edge Function, scheduled by `pg_cron`.

## What gets sent

| Kind | When | Who | Pref |
|---|---|---|---|
| `vote` | A vote is created | Everyone but its author | Votes |
| `vote_nudge` | 24 h after a vote opened, if you haven't voted | Members without a vote | Votes |
| `expense` | An expense is created | Everyone in its split except whoever logged it, with their share | Expenses |
| `task` | A task is assigned to you (new, or reassigned) by someone else | The assignee | Tasks |
| `task_due` | 08:00 trip time on the due date, if not done | The assignee | Tasks |
| `leave` | 10 min before your leave-by time, else 55 min before the start | Attendees with notifications on | Time to leave |

Lodging and free-time items never get leave-by reminders. Each event has a unique `dedupe_key`, so nothing is sent twice. Events more than 6 hours old are dropped, not sent late.

## How it flows

1. **Event triggers** on `polls`, `expenses` and `trip_tasks` (`private.queue_*`) insert into `private.push_queue`.
2. **pg_cron `push-dispatch`** runs `private.push_tick()` every minute. It first queues the time-based events (`private.push_enqueue_due()`). It then calls the Edge Function through `pg_net` only if a waiting event belongs to someone with notifications on, so a quiet trip costs nothing.
3. **Edge Function `push-dispatch`** (`supabase/functions/push-dispatch`) checks the `x-cron-token` header against Vault and calls `push_claim_batch()`, which marks events sent and returns the matching subscriptions. It then encrypts and sends each message (`jsr:@negrel/webpush`). If a push service answers 404 or 410, the subscription is disabled; other errors go to `push_subscriptions.last_error`. The message text comes from `dispatch.ts` and is unit-tested.
4. **The service worker** (`public/push-sw.js`, imported by Workbox) shows the notification. Tapping it opens or focuses the app at the event's page.

**Leave-by times** come from the phone, because only the phone knows reported, lancha and routed travel times (`planTransfers`). After each successful sync, a phone with "Time to leave" on sends its member's next 48 hours through `set_my_reminders` (`src/features/notifications/reminders.ts`). The server uses a phone's time only while the item's start time still matches.

## Phone side

`Settings → Notifications` (`src/features/notifications/NotificationsCard.tsx`):
- **iPhone:** needs the Home Screen app (iOS 16.4+). In Safari the card explains how to add it.
- **Permission:** asked from the "Turn on" tap.
- **Server records:** one row per phone and trip (`save_push_subscription` / `disable_push_subscription`).
- **On the phone:** the device store (`push` in `src/data/device.ts`) remembers which trips are on.

Turning notifications on or off needs signal.

## Ticket file clean-up

The pg_cron job `ticket-cleanup` runs daily at 03:00 UTC and calls the `ticket-cleanup` Edge Function. That function deletes the Storage files of tickets removed more than 7 days ago, through the Storage API: deleting `storage.objects` rows in SQL would leave the files behind. Removed paths are recorded in `private.removed_files`. Phones delete their own copy of a removed ticket straight away, offline too (`pruneRemoved` in `src/features/tickets/files.ts`).

## Setup (already done on the live project)

The migration is `supabase/migrations/20261009000002_push.sql`. It also creates the `pg_cron` and `pg_net` extensions.

Vault secrets are set out of band, so nothing secret or project-specific is committed:

```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<random 32-byte base64url>', 'cron_token');
select vault.create_secret('{"publicKey":<JWK>,"privateKey":<JWK>}', 'vapid_keys');  -- ECDSA P-256
```

The public half of the VAPID pair (raw, base64url) is `VITE_VAPID_PUBLIC_KEY` in `.env.production`. Both functions are deployed with `verify_jwt: false`, because they check the cron token themselves.

**Rotating the VAPID keys:**
1. Generate a new pair.
2. Run `vault.update_secret` with the new keys.
3. Change `VITE_VAPID_PUBLIC_KEY` and deploy.

Every phone then has to turn notifications on again.

## Checking it

- **Queue:** `select kind, data, sent_at from private.push_queue order by id desc limit 20;`
- **Last function result:** `select status_code, content from net._http_response order by created desc limit 5;`
- **Failing phones:** `select endpoint, enabled, last_error from public.push_subscriptions where last_error is not null;`
- **Tests:**
  - unit tests in `supabase/functions/push-dispatch/dispatch.test.ts` and `src/features/notifications/reminders.test.ts`
  - Settings card states in `tests/e2e/push.spec.ts`

  Real delivery can only be checked on a phone.
