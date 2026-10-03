-- Push notifications and scheduled jobs.
--
-- Database triggers queue events exactly (a new vote, an expense that includes you, a task
-- assigned to you); pg_cron adds time-based ones every minute (leave-by, task due, vote nudge)
-- and calls the push-dispatch Edge Function only when something is waiting. Nothing here is
-- synced to phones: subscribing needs signal anyway, so phones talk to it through RPCs.
--
-- Out-of-band setup (not in this file, so no secret or project URL is committed); see
-- docs/NOTIFICATIONS.md:
--   select vault.create_secret('<https://<ref>.supabase.co>', 'project_url');
--   select vault.create_secret('<random token>', 'cron_token');
--   select vault.create_secret('<{"publicKey":…,"privateKey":…} JWKs>', 'vapid_keys');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ── Subscriptions: one per (phone, trip) ─────────────────────────────────────────────────────
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  member_id uuid not null references public.members (id),
  auth_user_id uuid not null,
  endpoint text not null check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  prefs jsonb not null default '{"leave": true, "vote": true, "expense": true, "task": true}',
  enabled boolean not null default true,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (endpoint, trip_id)
);
create index push_subscriptions_member_idx on public.push_subscriptions (trip_id, member_id) where enabled;
-- RLS on with no policies: only the SECURITY DEFINER functions below touch it.
alter table public.push_subscriptions enable row level security;

-- ── Queue and device-computed leave-by times ─────────────────────────────────────────────────
create table private.push_queue (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  member_id uuid not null references public.members (id),
  kind text not null check (kind in ('vote', 'vote_nudge', 'expense', 'task', 'task_due', 'leave')),
  data jsonb not null,
  dedupe_key text not null unique,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index push_queue_pending_idx on private.push_queue (send_after) where sent_at is null;

create table private.push_reminders (
  member_id uuid not null references public.members (id),
  item_id uuid not null references public.itinerary_items (id),
  trip_id uuid not null references public.trips (id) on delete cascade,
  leave_at timestamptz not null,
  item_start_at timestamptz not null,
  note text check (note is null or char_length(note) <= 160),
  updated_at timestamptz not null default now(),
  primary key (member_id, item_id)
);

-- Ticket files already removed from Storage (soft-deleted attachments, after a grace period).
create table private.removed_files (
  storage_path text primary key,
  removed_at timestamptz not null default now()
);

-- ── Helpers ──────────────────────────────────────────────────────────────────────────────────
create function private.claims_member(p_trip_id uuid, p_member_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trip_devices
    where trip_id = p_trip_id and user_id = (select auth.uid()) and member_id = p_member_id
  )
$$;
revoke all on function private.claims_member(uuid, uuid) from public;

create function private.member_name(p_member_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select display_name from public.members where id = p_member_id), 'Someone')
$$;
revoke all on function private.member_name(uuid) from public;

-- ── Phone-facing RPCs (signed in, own claimed member only) ───────────────────────────────────
create function public.save_push_subscription(p_trip_id uuid, p_member_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_prefs jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.has_trip_access(p_trip_id)) or not private.claims_member(p_trip_id, p_member_id) then
    raise exception 'Choose who you are in this trip first' using errcode = '42501';
  end if;
  if jsonb_typeof(p_prefs) <> 'object' then
    raise exception 'Bad notification settings' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (trip_id, member_id, auth_user_id, endpoint, p256dh, auth, prefs)
  values (p_trip_id, p_member_id, auth.uid(), p_endpoint, p_p256dh, p_auth, p_prefs)
  on conflict (endpoint, trip_id) do update
    set member_id = excluded.member_id, auth_user_id = excluded.auth_user_id, p256dh = excluded.p256dh,
        auth = excluded.auth, prefs = excluded.prefs, enabled = true, last_error = null, updated_at = now();
end;
$$;

create function public.disable_push_subscription(p_trip_id uuid, p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  update public.push_subscriptions set enabled = false, updated_at = now()
  where trip_id = p_trip_id and endpoint = p_endpoint and auth_user_id = (select auth.uid())
$$;

-- Leave-by times this phone worked out (it knows reported, lancha and routed travel times).
-- Replaces this member's upcoming reminders in the trip.
create function public.set_my_reminders(p_trip_id uuid, p_member_id uuid, p_rows jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.has_trip_access(p_trip_id)) or not private.claims_member(p_trip_id, p_member_id) then
    raise exception 'Choose who you are in this trip first' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 100 then
    raise exception 'Too many reminders' using errcode = '22023';
  end if;
  delete from private.push_reminders where trip_id = p_trip_id and member_id = p_member_id;
  insert into private.push_reminders (member_id, item_id, trip_id, leave_at, item_start_at, note)
  select p_member_id, i.id, p_trip_id, (r ->> 'leave_at')::timestamptz, (r ->> 'item_start_at')::timestamptz, left(r ->> 'note', 160)
  from jsonb_array_elements(p_rows) r
  join public.itinerary_items i on i.id = (r ->> 'item_id')::uuid and i.trip_id = p_trip_id
  on conflict (member_id, item_id) do nothing;
end;
$$;

revoke all on function public.save_push_subscription(uuid, uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.disable_push_subscription(uuid, text) from public, anon;
revoke all on function public.set_my_reminders(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_push_subscription(uuid, uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.disable_push_subscription(uuid, text) to authenticated;
grant execute on function public.set_my_reminders(uuid, uuid, jsonb) to authenticated;

-- ── Event triggers ───────────────────────────────────────────────────────────────────────────
create function private.queue_poll() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is null and new.status = 'open' then
    insert into private.push_queue (trip_id, member_id, kind, data, dedupe_key)
    select new.trip_id, m.id, 'vote',
      jsonb_build_object('poll_id', new.id, 'title', new.title, 'by', private.member_name(new.created_by)),
      'vote:' || new.id || ':' || m.id
    from public.members m
    where m.trip_id = new.trip_id and m.deleted_at is null and m.id is distinct from new.created_by
    on conflict (dedupe_key) do nothing;
  end if;
  return null;
end;
$$;

create function private.queue_expense() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_sum numeric;
begin
  if new.deleted_at is not null then return null; end if;
  select sum((s ->> 'value')::numeric) into v_sum from jsonb_array_elements(new.split) s;
  insert into private.push_queue (trip_id, member_id, kind, data, dedupe_key)
  select new.trip_id, (s ->> 'member_id')::uuid, 'expense',
    jsonb_build_object(
      'expense_id', new.id, 'description', new.description, 'currency', new.currency,
      'amount_minor', new.amount_minor, 'by', private.member_name(new.updated_by),
      'share_minor', round(case new.split_method
        when 'equal' then new.amount_minor::numeric / jsonb_array_length(new.split)
        when 'exact' then (s ->> 'value')::numeric
        when 'percent' then new.amount_minor * (s ->> 'value')::numeric / 10000
        else new.amount_minor * (s ->> 'value')::numeric / nullif(v_sum, 0) end)),
    'expense:' || new.id || ':' || (s ->> 'member_id')
  from jsonb_array_elements(new.split) s
  join public.members m on m.id = (s ->> 'member_id')::uuid and m.trip_id = new.trip_id
  where m.id is distinct from new.updated_by
    and (new.split_method <> 'shares' or (s ->> 'value')::numeric > 0)
  on conflict (dedupe_key) do nothing;
  return null;
end;
$$;

create function private.queue_task() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.assignee_id is not null and new.deleted_at is null and not new.completed
     and new.assignee_id is distinct from new.updated_by
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    insert into private.push_queue (trip_id, member_id, kind, data, dedupe_key)
    values (new.trip_id, new.assignee_id, 'task',
      jsonb_build_object('task_id', new.id, 'title', new.title, 'by', private.member_name(new.updated_by), 'due_date', new.due_date),
      'task:' || new.id || ':' || new.assignee_id || ':' || new.updated_at)
    on conflict (dedupe_key) do nothing;
  end if;
  return null;
end;
$$;

create trigger queue_push after insert on public.polls for each row execute function private.queue_poll();
create trigger queue_push after insert on public.expenses for each row execute function private.queue_expense();
create trigger queue_push after insert or update of assignee_id on public.trip_tasks for each row execute function private.queue_task();

-- ── Time-based events (run every minute by pg_cron) ──────────────────────────────────────────
create function private.push_enqueue_due() returns void
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
    and not exists (select 1 from public.poll_votes v where v.poll_id = p.id and v.member_id = m.id and v.score is not null)
  on conflict (dedupe_key) do nothing;

  delete from private.push_queue where created_at < now() - interval '14 days';
  delete from private.push_reminders where item_start_at < now() - interval '1 day';
end;
$$;

-- Every minute: queue due events, then wake the sender only if someone with notifications on is waiting.
create function private.push_tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.push_enqueue_due();
  if exists (
    select 1 from private.push_queue q
    join public.push_subscriptions s on s.trip_id = q.trip_id and s.member_id = q.member_id and s.enabled
    where q.sent_at is null and q.send_after <= now() and q.created_at > now() - interval '6 hours'
  ) then
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/push-dispatch',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_token')),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000);
  end if;
end;
$$;

-- ── Edge Function RPCs (service role only) ───────────────────────────────────────────────────
create function public.push_check_token(p_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'cron_token' and decrypted_secret = p_token)
$$;

create function public.push_vapid_keys() returns jsonb
language sql stable security definer set search_path = '' as $$
  select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'vapid_keys'
$$;

-- Claims up to 200 waiting events (marks them sent) and returns each with the trip name and the
-- member's enabled subscriptions that want that kind. Stale events (over 6 hours) are dropped.
create function public.push_claim_batch() returns jsonb
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
        and coalesce((s.prefs ->> (case c.kind when 'vote_nudge' then 'vote' when 'task_due' then 'task' else c.kind end))::boolean, true)
    ))), '[]'::jsonb)
  into v
  from claimed c join public.trips t on t.id = c.trip_id
  where c.created_at > now() - interval '6 hours';
  return v;
end;
$$;

create function public.push_mark_failed(p_endpoint text, p_error text, p_gone boolean) returns void
language sql security definer set search_path = '' as $$
  update public.push_subscriptions set last_error = left(p_error, 300), enabled = enabled and not p_gone, updated_at = now()
  where endpoint = p_endpoint
$$;

-- Ticket files to delete from Storage: removed more than 7 days ago (time for any phone that
-- was offline to stop needing them), not yet removed, and not shared with a live ticket.
create function public.tickets_to_remove() returns setof text
language sql stable security definer set search_path = '' as $$
  select a.storage_path from public.attachments a
  where a.deleted_at < now() - interval '7 days'
    and not exists (select 1 from private.removed_files f where f.storage_path = a.storage_path)
    and not exists (select 1 from public.attachments b where b.storage_path = a.storage_path and b.deleted_at is null)
  limit 100
$$;

create function public.mark_files_removed(p_paths text[]) returns void
language sql security definer set search_path = '' as $$
  insert into private.removed_files (storage_path) select unnest(p_paths) on conflict do nothing
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.push_check_token(text)', 'public.push_vapid_keys()', 'public.push_claim_batch()',
    'public.push_mark_failed(text, text, boolean)', 'public.tickets_to_remove()', 'public.mark_files_removed(text[])'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
revoke all on function private.push_enqueue_due() from public;
revoke all on function private.push_tick() from public;

-- ── Schedules ────────────────────────────────────────────────────────────────────────────────
select cron.schedule('push-dispatch', '* * * * *', 'select private.push_tick()');
select cron.schedule('ticket-cleanup', '0 3 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ticket-cleanup',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_token')),
    body := '{}'::jsonb, timeout_milliseconds := 60000)
$$);
