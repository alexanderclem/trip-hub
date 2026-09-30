-- On insert, created_at was stamped by a second clock_timestamp() call, landing a few
-- microseconds after updated_at. Use the same instant for both.

create or replace function private.sync_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.trip_id := old.trip_id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    if old.deleted_at is not null then
      new.deleted_at := old.deleted_at;
    end if;
  else
    new.created_at := new.updated_at;
  end if;
  return new;
end $$;

create or replace function private.sync_guard_trip() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    -- Only rotate_share_token() may change the token; it sets this transaction-local flag.
    if current_setting('trip_hub.rotating_token', true) is distinct from 'on' then
      new.share_token := old.share_token;
    end if;
    if old.deleted_at is not null then
      new.deleted_at := old.deleted_at;
    end if;
  else
    new.created_at := new.updated_at;
  end if;
  return new;
end $$;
