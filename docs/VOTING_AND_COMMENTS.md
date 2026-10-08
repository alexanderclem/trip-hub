# Shareable votes, deadlines, date votes, comments and "what's new"

## Sharing a vote

A vote page has a share button in its header, and a "Send it to the group" card while the vote is
open, has at least two options, and fewer than half the group has voted. Share opens the phone's
share sheet (or copies, where there is none) with one line and a link:

```
Vote: “Where do we stay at the lake?” · 4 options · closes Fri 6:00 PM
https://joinstowaway.app/join?to=vote/<poll id>#t=<trip invite token>
```

- The link is the invite link plus a landing page. Anyone who has it can join and edit the trip,
  exactly like the invite; the card says so. The token stays in the `#` part, which is never sent
  to the server.
- Someone already on the trip lands on the vote straight away, with or without signal
  (`joinedTripForToken`). Someone new joins, picks their name, then lands on the vote.
- `?to=` only accepts `vote/<uuid>` (`parseJoinTarget` in `src/features/trips/actions.ts`); anything
  else is ignored.
- A web app can't post into a chat by itself. The people with notifications on still get the
  existing "New vote" push.

## Deadlines

"Voting closes" on the new-vote form: when someone closes it, tonight at 9 PM, in 24 hours, in
3 days, or a chosen time. Deadlines are set and shown in the phone's own time zone, because people
vote from home; `polls.closes_at` stores the instant.

- `votingEnded(poll, now)` in `src/features/polls/rank.ts` is the one test every screen uses. Once
  the deadline passes, voting is disabled and the leader is shown as decided.
- The first phone to open the vote with signal records `status = 'closed'` and the winner, using
  the same `leader(rankOptions())` as a manual close. There is no ranking in SQL.
- Reopening a vote clears its deadline.
- The server does not reject late votes: a phone that voted offline before the deadline may only
  sync after it.

## "Which dates work" votes

`polls.kind = 'dates'`. Options are a first and last day (`poll_options.starts_on` / `ends_on`,
id `stableId(trip, 'option', poll, 'dates', start, end)` so the same dates from two phones are one
option). The four scores read Can't · If needed · Works · Ideal; ranking is unchanged. Results say
"Everyone can make it" when the whole group voted and nobody chose Can't. The winner offers
"Set as the trip's dates", which writes `trips.start_date` / `end_date` (it asks first if the trip
already has dates; plan items are not moved).

Any winner can now go onto the plan: text and link winners open the plan form with the name filled
in (`/plan/new?title=`), places as before.

## Comments

`comments` (one row each; `subject_type` poll, place or item). Everyone on the trip reads them;
only the device that is that person can write as them (`private.claims_member`), and the author
removes their own with a soft delete. `CommentThread` is on vote, place and plan-item pages, and
the votes list shows a count.

## What's new

No table: `buildFeed` in `src/features/activity/feed.ts` derives it on the phone from rows already
synced (joined, vote started / option added / decided, place added by hand, plan item, expense,
task, ticket, comment). Individual votes and the imported idea pool are left out. The overview shows
the latest five; `/t/<trip>/activity` shows the rest. Each phone remembers when its person last
looked (`activitySeen` in the device store, starting from when they joined); things other people
did since then are marked New and counted next to the trip name (phone) or Overview (desktop).

## Release order

Apply these before deploying the frontend, in this order (the sync engine pushes to `comments`):

1. `20261012000001_poll_upgrades.sql`
2. `20261012000002_comments.sql`
3. `20261012000003_push_votes_comments.sql`, then redeploy the `push-dispatch` function

Then run `get_advisors`; only the two usual kinds of warning are expected.

## Verification

- `npm run typecheck`, `npm test`: includes `src/features/comments/permissions.test.ts`, which
  runs the three migrations in PGlite and checks comment read/write rules, who is notified, and
  the date-option constraint.
- `npx playwright test tests/e2e/votes-share-comments.spec.ts`: local fixtures only, network
  blocked.
- Not covered: the real share sheet into a chat app, real push delivery, and two live devices.
