# Funnel measurement

How many trip creators reach a money moment and ask for payments, before payments are built
(`docs/PLAN_THE_SWITCH.md`, sections 5 and 9). Migration: `supabase/migrations/20261030000002_product_events.sql`.

**Privacy:** events carry no names, emails, messages, plans or amounts, and no third-party analytics
receives them (the privacy page says so). Early-access emails live in their own table.

## Events

| Stage | Event | Recorded by |
|---|---|---|
| Discovery | `trip_created` | trigger on `trips` (every app version) |
| Discovery | `trip_source` (`?ref=` / `utm_source`, else `direct`) | app, after `createTrip` |
| Activation | `invite_shared` (`copy` / `share`) | app, invite card |
| Activation | `member_joined` | trigger on `members` |
| Aha | engaged trip: ≥3 people and votes from ≥2 people or plans on ≥2 days | view `private.engaged_trips` |
| Money moment | `money_moment_shown` / `_clicked` / `_dismissed` (with `reason`: `size`, `big_expense`, `owed`) | app, Money screen, trip creator only |
| Upgrade intent | `early_access_requested` + a row in `private.early_access_requests` | app, payments sheet |

The money moment rule is `src/features/money/moment.ts`: 10 or more people, a shared cost of at
least 100 (base currency) per person, or the creator owed by 3 or more people. The row appears only
to the trip's creator, at most counted once a day per trip, and "Not now" hides it for good.

App events wait on the phone (`_events` in IndexedDB, at most 200) and go out with the next sync
through `log_events()`, which accepts only the kinds above, only for trips the caller is on, at most
300 a day per person.

## Reading it (Supabase SQL editor)

```sql
-- By day
select * from private.funnel_daily limit 30;

-- Last 30 days, as a funnel
select
  (select count(*) from private.product_events where kind = 'trip_created' and at > now() - interval '30 days') as trips,
  (select count(*) from private.engaged_trips where created_at > now() - interval '30 days') as engaged,
  (select count(distinct trip_id) from private.product_events where kind = 'money_moment_shown' and at > now() - interval '30 days') as money_moment,
  (select count(distinct trip_id) from private.product_events where kind = 'money_moment_clicked' and at > now() - interval '30 days') as clicked,
  (select count(*) from private.early_access_requests where created_at > now() - interval '30 days') as early_access;

-- Where new trips come from
select props ->> 'source' as source, count(*) from private.product_events
where kind = 'trip_source' group by 1 order by 2 desc;

-- The early-access list
select email, travelers, created_at from private.early_access_requests order by created_at desc;
```
