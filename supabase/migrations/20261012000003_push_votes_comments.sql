-- Notifications for vote deadlines, vote results and comments.
--
-- New kinds: vote_closing (3 hours before a deadline, to people who haven't voted), vote_closed
-- (the result, when a vote is closed by hand or by its deadline) and comment. The first two follow
-- the phone's "Votes" switch; comments have their own, on unless turned off.

alter table private.push_queue drop constraint push_queue_kind_check;
alter table private.push_queue add constraint push_queue_kind_check
  check (kind in ('vote', 'vote_nudge', 'vote_closing', 'vote_closed', 'expense', 'task', 'task_due', 'leave', 'comment'));

-- ── A vote was decided ───────────────────────────────────────────────────────────────────────
-- Everyone but whoever closed it. One notice per closing: reopening and closing again tells
-- people again, because the answer may have changed.
create function private.queue_poll_closed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is null and new.status = 'closed' and old.status = 'open' then
    insert into private.push_queue (trip_id, member_id, kind, data, dedupe_key)
    select new.trip_id, m.id, 'vote_closed',
      jsonb_build_object('poll_id', new.id, 'title', new.title,
        'winner', (select o.label from public.poll_options o where o.id = new.winner_option_id and o.deleted_at is null)),
      'vote_closed:' || new.id || ':' || m.id || ':' || new.updated_at
    from public.members m
    where m.trip_id = new.trip_id and m.deleted_at is null and m.id is distinct from new.updated_by
    on conflict (dedupe_key) do nothing;
  end if;
  return null;
end;
$$;
revoke all on function private.queue_poll_closed() from public;
create trigger queue_push_closed after update of status on public.polls
  for each row execute function private.queue_poll_closed();

-- ── A comment ────────────────────────────────────────────────────────────────────────────────
-- Goes to people already in that conversation (earlier commenters) and, on a vote, to everyone
-- who has voted in it or started it. Never to the author.
create function private.queue_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_subject text;
begin
  if new.deleted_at is not null then return null; end if;
  case new.subject_type
    when 'poll' then select title into v_subject from public.polls where id = new.subject_id;
    when 'place' then select name into v_subject from public.places where id = new.subject_id;
    else select title into v_subject from public.itinerary_items where id = new.subject_id;
  end case;
  insert into private.push_queue (trip_id, member_id, kind, data, dedupe_key)
  select new.trip_id, r.member_id, 'comment',
    jsonb_build_object('comment_id', new.id, 'subject_type', new.subject_type, 'subject_id', new.subject_id,
      'subject', coalesce(v_subject, ''), 'by', private.member_name(new.member_id), 'body', left(new.body, 140)),
    'comment:' || new.id || ':' || r.member_id
  from (
    select c.member_id from public.comments c
    where c.subject_type = new.subject_type and c.subject_id = new.subject_id and c.deleted_at is null
    union
    select v.member_id from public.poll_votes v
    where new.subject_type = 'poll' and v.poll_id = new.subject_id and v.score is not null
    union
    select p.created_by from public.polls p
    where new.subject_type = 'poll' and p.id = new.subject_id
  ) r
  join public.members m on m.id = r.member_id and m.trip_id = new.trip_id and m.deleted_at is null
  where r.member_id is distinct from new.member_id
  on conflict (dedupe_key) do nothing;
  return null;
end;
$$;
revoke all on function private.queue_comment() from public;
create trigger queue_push after insert on public.comments
  for each row execute function private.queue_comment();

-- ── Time-based events: as before, plus "closing soon"; the day-later nudge skips deadline votes ──
create or replace function private.push_enqueue_due() returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Leave-by: the phone's time if it still matches the item, else 45 minutes before the start.
  -- Sent 10 minutes before leaving; skipped if more than 15 minutes late (e.g. cron was down).
  insert into private.push_queue (trip_id, member_id, kind, data, dedupe_key, send_after)
  select i.trip_id, m.id, 'leave',
    jsonb_build_object(
      'item_id', i.id, 'title', i.title,
      'start', to_char(i.start_at at time zone t.timezone, 'HH24:MI'),
      'leave', case when r.item_start_at = i.start_at then to_char(r.leave_at at time zone t.timezone, 'HH24:MI') end,
      'note', case when r.item_start_at = i.start_at then r.note end),
    'leave:' || i.id || ':' || m.id || ':' || i.start_at,
    x.fire_at
  from public.itinerary_items i
  join public.trips t on t.id = i.trip_id
  join public.members m on m.trip_id = i.trip_id and m.deleted_at is null
    and (i.attendee_ids is null or m.id = any (i.attendee_ids))
  left join private.push_reminders r on r.item_id = i.id and r.member_id = m.id
  cross join lateral (
    select (case when r.item_start_at = i.start_at then r.leave_at else i.start_at - interval '45 minutes' end) - interval '10 minutes' as fire_at
  ) x
  where i.deleted_at is null and not i.all_day and i.status <> 'cancelled' and i.kind not in ('lodging', 'free')
    and i.start_at between now() and now() + interval '6 hours'
    and x.fire_at <= now() and x.fire_at > now() - interval '15 minutes'
    and exists (select 1 from public.push_subscriptions s where s.trip_id = i.trip_id and s.member_id = m.id and s.enabled)
  on conflict (dedupe_key) do nothing;

  -- Tasks due today, from 08:00 in the trip's time zone.
  insert into private.push_queue (trip_id, member_id, kind, data, dedupe_key)
  select k.trip_id, k.assignee_id, 'task_due', jsonb_build_object('task_id', k.id, 'title', k.title),
    'task_due:' || k.id || ':' || k.due_date
  from public.trip_tasks k
  join public.trips t on t.id = k.trip_id
  where k.deleted_at is null and not k.completed and k.assignee_id is not null
    and k.due_date = (now() at time zone t.timezone)::date
    and (now() at time zone t.timezone)::time >= time '08:00'
  on conflict (dedupe_key) do nothing;

  -- Votes open for a day that you haven't voted on.
  insert into private.push_queue (trip_id, member_id, kind, data, dedupe_key)
  select p.trip_id, m.id, 'vote_nudge', jsonb_build_object('poll_id', p.id, 'title', p.title),
    'vote_nudge:' || p.id || ':' || m.id
  from public.polls p
  join public.members m on m.trip_id = p.trip_id and m.deleted_at is null
  where p.deleted_at is null and p.status = 'open'
    and p.created_at between now() - interval '48 hours' and now() - interval '24 hours'
    and p.closes_at is null -- a vote with a deadline gets "closing soon" instead
    and not exists (select 1 from public.poll_votes v where v.poll_id = p.id and v.member_id = m.id and v.score is not null)
  on conflict (dedupe_key) do nothing;

  -- Votes closing within 3 hours that you haven't voted on. A vote created with a shorter
  -- deadline than that already sent "new vote", so it is skipped for its first 30 minutes.
  insert into private.push_queue (trip_id, member_id, kind, data, dedupe_key)
  select p.trip_id, m.id, 'vote_closing',
    jsonb_build_object('poll_id', p.id, 'title', p.title, 'closes_at', p.closes_at),
    'vote_closing:' || p.id || ':' || m.id || ':' || p.closes_at
  from public.polls p
  join public.members m on m.trip_id = p.trip_id and m.deleted_at is null
  where p.deleted_at is null and p.status = 'open'
    and p.closes_at > now() and p.closes_at <= now() + interval '3 hours'
    and p.created_at < now() - interval '30 minutes'
    and not exists (select 1 from public.poll_votes v where v.poll_id = p.id and v.member_id = m.id and v.score is not null)
  on conflict (dedupe_key) do nothing;

  delete from private.push_queue where created_at < now() - interval '14 days';
  delete from private.push_reminders where item_start_at < now() - interval '1 day';
end;
$$;

-- ── Which switch each kind follows ───────────────────────────────────────────────────────────
create or replace function public.push_claim_batch() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  with claimed as (
    update private.push_queue q set sent_at = now()
    where q.id in (
      select id from private.push_queue
      where sent_at is null and send_after <= now()
      order by id limit 200 for update skip locked
    )
    returning q.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'trip_id', c.trip_id, 'trip_name', t.name, 'kind', c.kind, 'data', c.data,
    'subscriptions', (
      select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
      from public.push_subscriptions s
      where s.trip_id = c.trip_id and s.member_id = c.member_id and s.enabled
        and coalesce((s.prefs ->> (case c.kind when 'vote_nudge' then 'vote' when 'vote_closing' then 'vote' when 'vote_closed' then 'vote' when 'task_due' then 'task' else c.kind end))::boolean, true)
    ))), '[]'::jsonb)
  into v
  from claimed c join public.trips t on t.id = c.trip_id
  where c.created_at > now() - interval '6 hours';
  return v;
end;
$$;
