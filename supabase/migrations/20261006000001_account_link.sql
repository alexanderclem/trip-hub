-- Signing in with Google gives a phone a different auth user from the guest (anonymous) one it
-- had. These two functions carry the guest's trips over: while still a guest the phone asks for
-- a one-time code, and after signing in it redeems the code, which moves the guest's trip
-- memberships to the account. Rows record member ids, not auth ids, so no trip data changes.

create table private.link_codes (
  code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);
create index link_codes_user_idx on private.link_codes (user_id);
-- Only the security definer functions below touch this table.
alter table private.link_codes enable row level security;

create function public.create_link_code() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_code text := translate(rtrim(encode(extensions.gen_random_bytes(24), 'base64'), '='), '+/', '-_');
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from private.link_codes where user_id = v_uid or expires_at < now();
  insert into private.link_codes (code, user_id, expires_at) values (v_code, v_uid, now() + interval '15 minutes');
  return v_code;
end $$;

-- Returns how many trips were carried over.
create function public.redeem_link_code(p_code text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_from uuid;
  v_moved integer := 0;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  -- Trips only ever move onto a real account, never between guests.
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in before linking this phone' using errcode = '42501';
  end if;
  delete from private.link_codes where code = p_code and expires_at > now() returning user_id into v_from;
  if v_from is null then
    raise exception 'This link code is invalid or has expired' using errcode = 'P0002';
  end if;
  if v_from = v_uid then
    return 0;
  end if;
  insert into public.trip_devices (trip_id, user_id, member_id, device_label, joined_at)
  select trip_id, v_uid, member_id, device_label, joined_at from public.trip_devices where user_id = v_from
  on conflict (trip_id, user_id) do update
    set member_id = coalesce(public.trip_devices.member_id, excluded.member_id), last_seen_at = now();
  get diagnostics v_moved = row_count;
  delete from public.trip_devices where user_id = v_from;
  return v_moved;
end $$;

revoke execute on function public.create_link_code(), public.redeem_link_code(text) from public, anon;
grant execute on function public.create_link_code(), public.redeem_link_code(text) to authenticated;
