-- Votes: a deadline, and a "which dates work" kind.
--
-- All additive, so phones still running the previous app keep syncing: they send rows without
-- these columns and the defaults apply.
--
-- A deadline closes voting on the phone as soon as it passes (votingEnded in
-- src/features/polls/rank.ts). The first phone to open the vote with signal then records
-- status = 'closed' and the winner, using the same ranking as a manual close, so the ranking
-- rules live in one place. Late votes are not rejected here: a phone that voted offline before
-- the deadline may only reach the server after it.

alter table public.polls
  add column kind text not null default 'options' check (kind in ('options', 'dates')),
  add column closes_at timestamptz;

-- Date votes: the first and last day an option covers (the same day twice for a single day).
alter table public.poll_options
  add column starts_on date,
  add column ends_on date,
  add constraint poll_options_dates_check check (
    (starts_on is null and ends_on is null) or (starts_on is not null and ends_on is not null and ends_on >= starts_on)
  );

create index polls_closes_idx on public.polls (closes_at) where closes_at is not null and status = 'open' and deleted_at is null;
