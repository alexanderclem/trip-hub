-- Money: expenses, settle-up payments, exchange-rate snapshots.
--
-- Amounts are integer minor units (cents, centavos). Each expense stores the rate used when it was
-- entered (fx_rate = units of `currency` per 1 unit of `base_currency`) and its base-currency
-- amount, so balances never move when exchange rates change. Payers and the split live on the
-- expense row as jsonb, so an expense is saved and replaced atomically (last write wins per row).
--   payers: [{ "member_id": uuid, "amount_minor": int }]             (original currency)
--   split:  [{ "member_id": uuid, "value": number }]   equal: ignored · shares: weight ·
--           exact: minor units (original currency) · percent: basis points (sum 10000)

create table public.expenses (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  description text not null check (length(trim(description)) between 1 and 200),
  category text not null default 'other' check (category in (
    'food', 'drinks', 'lodging', 'transport', 'activities', 'groceries', 'shopping', 'tips', 'fees', 'other')),
  spent_on date not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  fx_rate numeric(18, 8) not null check (fx_rate > 0),
  fx_source text not null default 'snapshot' check (fx_source in ('same', 'snapshot', 'manual', 'fallback')),
  fx_as_of date,
  base_currency char(3) not null,
  base_amount_minor bigint not null check (base_amount_minor > 0),
  payers jsonb not null,
  split_method text not null check (split_method in ('equal', 'shares', 'exact', 'percent')),
  split jsonb not null,
  place_id uuid references public.places (id),
  item_id uuid references public.itinerary_items (id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

create table public.settlements (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_member_id uuid not null references public.members (id),
  to_member_id uuid not null references public.members (id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  fx_rate numeric(18, 8) not null check (fx_rate > 0),
  base_amount_minor bigint not null check (base_amount_minor > 0),
  paid_on date not null,
  method text not null default 'cash' check (method in ('cash', 'transfer', 'card', 'other')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  check (from_member_id <> to_member_id)
);

-- One per (trip, base, day); id = stableId(trip, 'fx', base, as_of), so phones that fetch the same
-- day's rates converge on one row.
create table public.fx_snapshots (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  base char(3) not null,
  rates jsonb not null, -- { "GTQ": 7.63, ... }: units of currency per 1 base
  as_of date not null,
  fetched_at timestamptz not null default now(),
  source text not null default 'open.er-api.com',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

-- Refuse expenses whose numbers don't add up, whatever client sent them.
create or replace function private.validate_expense() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_paid numeric;
  v_split numeric;
begin
  if jsonb_typeof(new.payers) <> 'array' or jsonb_array_length(new.payers) = 0 then
    raise exception 'An expense needs at least one payer' using errcode = '22023';
  end if;
  if jsonb_typeof(new.split) <> 'array' or jsonb_array_length(new.split) = 0 then
    raise exception 'An expense needs at least one person to split with' using errcode = '22023';
  end if;
  select coalesce(sum((p ->> 'amount_minor')::numeric), 0) into v_paid from jsonb_array_elements(new.payers) p;
  if v_paid <> new.amount_minor then
    raise exception 'Payer amounts (%) must add up to the total (%)', v_paid, new.amount_minor using errcode = '22023';
  end if;
  select coalesce(sum((s ->> 'value')::numeric), 0) into v_split from jsonb_array_elements(new.split) s;
  if new.split_method = 'exact' and v_split <> new.amount_minor then
    raise exception 'Exact amounts (%) must add up to the total (%)', v_split, new.amount_minor using errcode = '22023';
  elsif new.split_method = 'percent' and v_split <> 10000 then
    raise exception 'Percentages must add up to 100%%' using errcode = '22023';
  elsif new.split_method = 'shares' and v_split <= 0 then
    raise exception 'At least one person needs a share' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger validate_expense before insert or update on public.expenses
  for each row execute function private.validate_expense();

do $$
declare t text;
begin
  foreach t in array array['expenses', 'settlements', 'fx_snapshots'] loop
    execute format(
      'create trigger sync_guard before insert or update on public.%I
         for each row execute function private.sync_guard()', t);
    execute format('create index %I on public.%I (trip_id, updated_at)', t || '_sync_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using ((select private.has_trip_access(trip_id)));
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check ((select private.has_trip_access(trip_id)));
      create policy %1$s_update on public.%1$I for update to authenticated
        using ((select private.has_trip_access(trip_id)))
        with check ((select private.has_trip_access(trip_id)));
    $f$, t);
  end loop;
end $$;

create index expenses_item_idx on public.expenses (item_id);
create index expenses_place_idx on public.expenses (place_id);
create index settlements_from_idx on public.settlements (from_member_id);
create index settlements_to_idx on public.settlements (to_member_id);
create unique index fx_snapshots_trip_day_idx on public.fx_snapshots (trip_id, base, as_of);

alter publication supabase_realtime add table public.expenses, public.settlements, public.fx_snapshots;
