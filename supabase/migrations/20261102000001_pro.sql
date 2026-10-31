-- Pro, the organizer plan for repeat-business tools (docs/PLAN_THE_SWITCH.md, Phase 2): running a trip
-- again, the traveler list, waitlists, rooming, reports, campaigns and referrals. Collecting money
-- stays on the flat 1% and is never Pro.
--
-- Pro is free during the beta: every organizer has it while app_settings.pro_free_beta is true.
-- Charging later means setting that to false and filling organizers.plan / pro_until from billing.

create table private.app_settings (
  key text primary key,
  value jsonb not null
);
alter table private.app_settings enable row level security;
insert into private.app_settings (key, value) values ('pro_free_beta', 'true');

alter table public.organizers
  add column plan text not null default 'free' check (plan in ('free', 'pro')),
  add column pro_until timestamptz;

create function private.has_pro(p_organizer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true'::jsonb from private.app_settings where key = 'pro_free_beta'), false)
    or exists (select 1 from public.organizers where id = p_organizer and plan = 'pro' and (pro_until is null or pro_until > now()))
$$;
revoke all on function private.has_pro(uuid) from public;

-- The caller's organizer profile and plan, for the app.
create function public.my_organizer() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', o.id, 'display_name', o.display_name, 'support_email', o.support_email, 'slug', o.slug,
    'reviewed', o.reviewed_at is not null, 'pro', private.has_pro(o.id),
    'beta', coalesce((select value = 'true'::jsonb from private.app_settings where key = 'pro_free_beta'), false))
  from public.organizers o where o.owner_user_id = (select auth.uid())
$$;
revoke execute on function public.my_organizer() from public, anon;
grant execute on function public.my_organizer() to authenticated;

-- Pro RPCs call this first.
create function private.require_pro(p_organizer uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_organizer is null or not private.has_pro(p_organizer) then
    raise exception 'This is a Pro tool for organizers' using errcode = '42501';
  end if;
end $$;
revoke all on function private.require_pro(uuid) from public;

notify pgrst, 'reload schema';
