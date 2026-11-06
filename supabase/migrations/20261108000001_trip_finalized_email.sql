-- "Your itinerary is ready" email, sent when someone finalizes a plan from the trip agent
-- (docs/AGENT_PLANNER.md). It goes through the existing outbox and email-dispatch (Gmail API).
--
-- The phone calls this with the plan it just finalized. To keep it from being used to send mail to
-- anyone else, the recipient is always the caller's own account address: anonymous devices have
-- none and get 'no_email'. One email per plan (dedupe key) and at most 10 a day per person.

create function public.queue_trip_finalized_email(p_trip uuid, p_plan_key text, p_plan jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_trip text;
  v_name text;
begin
  if v_uid is null or not private.has_trip_access(p_trip) then
    raise exception 'Join this trip first' using errcode = '42501';
  end if;
  if p_plan_key !~ '^[A-Za-z0-9_-]{1,64}$' or octet_length(p_plan::text) > 20000 or jsonb_typeof(p_plan -> 'days') <> 'array' then
    raise exception 'Invalid plan' using errcode = '22023';
  end if;
  select email into v_email from auth.users where id = v_uid and not coalesce(is_anonymous, false) and email is not null;
  if v_email is null then return 'no_email'; end if;
  if (select count(*) from private.email_outbox where to_email = v_email and template = 'trip_finalized' and created_at > now() - interval '1 day') >= 10 then
    return 'limited';
  end if;
  select name into v_trip from public.trips where id = p_trip and deleted_at is null;
  select m.display_name into v_name from public.members m
    join public.trip_devices d on d.trip_id = m.trip_id and d.member_id = m.id
    where m.trip_id = p_trip and d.user_id = v_uid limit 1;
  perform private.enqueue_email(
    'trip_finalized:' || p_trip || ':' || v_uid || ':' || p_plan_key, v_email, null, 'trip_finalized',
    jsonb_build_object(
      'trip_name', v_trip, 'traveler_name', v_name,
      'trip_url', 'https://joinstowaway.app/t/' || p_trip || '/plan',
      'summary', left(coalesce(p_plan ->> 'summary', ''), 600),
      'currency', p_plan ->> 'currency', 'total_minor', p_plan -> 'totalMinor',
      'days', p_plan -> 'days'));
  return 'queued';
end $$;
revoke all on function public.queue_trip_finalized_email(uuid, text, jsonb) from public, anon;
grant execute on function public.queue_trip_finalized_email(uuid, text, jsonb) to authenticated;
