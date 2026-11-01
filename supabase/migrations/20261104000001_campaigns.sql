-- Phase 2c: campaigns (Pro). Organizers write plain-text emails to past travelers who agreed to hear
-- about future trips. Everything is built, but campaign mail waits in the outbox until Stowaway has a
-- sender on its own domain: Gmail can't send bulk mail. app_settings.campaign_sending turns it on.
-- CAN-SPAM: every email carries the organizer's postal address and a one-tap unsubscribe link.

insert into private.app_settings (key, value) values ('campaign_sending', 'false') on conflict (key) do nothing;

alter table public.organizers add column postal_address text check (postal_address is null or length(trim(postal_address)) between 10 and 300);
alter table private.email_outbox add column channel text not null default 'transactional' check (channel in ('transactional', 'campaign'));

create function public.save_organizer_address(p_address text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if length(trim(coalesce(p_address, ''))) not between 10 and 300 then
    raise exception 'Add a full postal address (street, city, state and ZIP)' using errcode = '22023';
  end if;
  update public.organizers set postal_address = trim(p_address), updated_at = now() where owner_user_id = (select auth.uid());
  if not found then raise exception 'You don''t organize trips yet' using errcode = '42501'; end if;
end $$;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  subject text not null default '' check (length(subject) <= 150),
  body text not null default '' check (length(body) <= 10000),
  audience jsonb not null default '{}' check (jsonb_typeof(audience) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'queued')),
  recipients integer not null default 0,
  queued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
create policy campaigns_select on public.campaigns for select to authenticated
  using (exists (select 1 from public.organizers o where o.id = organizer_id and o.owner_user_id = (select auth.uid())));

create table private.campaign_sends (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  contact_id uuid not null references public.organizer_contacts (id) on delete cascade,
  email text not null,
  unsubscribe_token_hash text not null unique,
  queued_at timestamptz not null default now(),
  primary key (campaign_id, contact_id)
);
alter table private.campaign_sends enable row level security;

create function private.my_organizer_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.organizers where owner_user_id = (select auth.uid())
$$;
revoke all on function private.my_organizer_id() from public;

-- Who a campaign reaches: contacts who agreed and haven't unsubscribed, by past trip and tag.
create function private.campaign_recipients(p_organizer uuid, p_audience jsonb) returns setof public.organizer_contacts
language sql stable security definer set search_path = '' as $$
  select c.* from public.organizer_contacts c
  where c.organizer_id = p_organizer and c.marketing_consent and c.unsubscribed_at is null
    and (jsonb_array_length(coalesce(p_audience -> 'trip_ids', '[]')) = 0 or exists (
      select 1 from public.bookings b
      where b.organizer_id = p_organizer and b.traveler_email = c.email and b.status in ('active', 'paid')
        and b.trip_id::text in (select jsonb_array_elements_text(p_audience -> 'trip_ids'))))
    and (jsonb_array_length(coalesce(p_audience -> 'tags', '[]')) = 0
         or c.tags && array(select jsonb_array_elements_text(p_audience -> 'tags')))
  order by c.name
$$;
revoke all on function private.campaign_recipients(uuid, jsonb) from public;

create function public.save_campaign(p_id uuid, p_subject text, p_body text, p_audience jsonb) returns public.campaigns
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.my_organizer_id();
  c public.campaigns;
begin
  perform private.require_pro(v_org);
  if jsonb_typeof(coalesce(p_audience, '{}')) <> 'object' then raise exception 'Choose who it goes to' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.campaigns (organizer_id, subject, body, audience)
    values (v_org, left(trim(coalesce(p_subject, '')), 150), left(coalesce(p_body, ''), 10000), coalesce(p_audience, '{}'))
    returning * into c;
  else
    update public.campaigns set subject = left(trim(coalesce(p_subject, '')), 150), body = left(coalesce(p_body, ''), 10000),
      audience = coalesce(p_audience, '{}'), updated_at = now()
    where id = p_id and organizer_id = v_org and status = 'draft' returning * into c;
    if c.id is null then raise exception 'This campaign is already queued' using errcode = 'P0002'; end if;
  end if;
  return c;
end $$;

create function public.campaign_audience(p_audience jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid := private.my_organizer_id();
begin
  perform private.require_pro(v_org);
  return jsonb_build_object(
    'count', (select count(*) from private.campaign_recipients(v_org, coalesce(p_audience, '{}'))),
    'first', coalesce((select jsonb_agg(jsonb_build_object('name', r.name, 'email', r.email))
                       from (select * from private.campaign_recipients(v_org, coalesce(p_audience, '{}')) limit 20) r), '[]'));
end $$;

create function private.campaign_email(c public.campaigns, o public.organizers, p_name text, p_unsubscribe text) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('organizer_id', o.id, 'organizer', o.display_name, 'postal_address', o.postal_address,
    'subject', c.subject, 'body', c.body, 'traveler_name', p_name, 'unsubscribe_url', p_unsubscribe)
$$;

-- One copy to the organizer's own address (transactional, so it goes now), to see it as travelers will.
create function public.send_campaign_test(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.campaigns;
  o public.organizers;
begin
  select * into o from public.organizers where id = private.my_organizer_id();
  perform private.require_pro(o.id);
  select * into c from public.campaigns where id = p_id and organizer_id = o.id;
  if c.id is null then raise exception 'Campaign not found' using errcode = 'P0002'; end if;
  if trim(c.subject) = '' or trim(c.body) = '' then raise exception 'Write a subject and a message first' using errcode = '22023'; end if;
  perform private.enqueue_email('campaign-test:' || c.id || ':' || extract(epoch from now())::bigint, o.support_email, null, 'campaign',
    private.campaign_email(c, o, 'Test', private.site_url() || '/unsubscribe#t=test'));
end $$;

-- Queues the campaign: one email per recipient, each with its own unsubscribe link. Mail on the
-- campaign channel waits until campaign_sending is on.
create function public.queue_campaign(p_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  c public.campaigns;
  o public.organizers;
  r public.organizer_contacts;
  v_token text;
  v_n integer := 0;
begin
  select * into o from public.organizers where id = private.my_organizer_id();
  perform private.require_pro(o.id);
  select * into c from public.campaigns where id = p_id and organizer_id = o.id for update;
  if c.id is null then raise exception 'Campaign not found' using errcode = 'P0002'; end if;
  if c.status <> 'draft' then raise exception 'This campaign is already queued' using errcode = 'P0002'; end if;
  if o.postal_address is null then raise exception 'Add your postal address first; the law requires it in every marketing email' using errcode = '22023'; end if;
  if trim(c.subject) = '' or trim(c.body) = '' then raise exception 'Write a subject and a message first' using errcode = '22023'; end if;
  for r in select * from private.campaign_recipients(o.id, c.audience) loop
    v_token := private.new_share_token() || private.new_share_token();
    insert into private.campaign_sends (campaign_id, contact_id, email, unsubscribe_token_hash)
    values (c.id, r.id, r.email, encode(sha256(convert_to(v_token, 'UTF8')), 'hex')) on conflict do nothing;
    if found then
      insert into private.email_outbox (dedupe_key, to_email, reply_to, template, data, channel)
      values ('campaign:' || c.id || ':' || r.id, r.email, o.support_email, 'campaign',
        private.campaign_email(c, o, r.name, private.site_url() || '/unsubscribe#t=' || v_token), 'campaign')
      on conflict (dedupe_key) do nothing;
      v_n := v_n + 1;
    end if;
  end loop;
  update public.campaigns set status = 'queued', recipients = v_n, queued_at = now(), updated_at = now() where id = c.id;
  return v_n;
end $$;

-- One tap, no sign-in. Unsent campaign mail from that organizer to that person is dropped too.
create function public.unsubscribe(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s private.campaign_sends;
  c public.organizer_contacts;
begin
  select * into s from private.campaign_sends where unsubscribe_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if s.campaign_id is null then raise exception 'This unsubscribe link isn''t valid' using errcode = 'P0002'; end if;
  update public.organizer_contacts set marketing_consent = false, unsubscribed_at = coalesce(unsubscribed_at, now()), updated_at = now()
  where id = s.contact_id returning * into c;
  delete from private.email_outbox
  where channel = 'campaign' and sent_at is null and to_email = c.email and data ->> 'organizer_id' = c.organizer_id::text;
  return jsonb_build_object('organizer', (select display_name from public.organizers where id = c.organizer_id));
end $$;

-- The dispatcher takes campaign mail only once campaign sending is switched on.
create or replace function public.pay_email_claim(p_limit integer default 20) returns setof private.email_outbox
language sql security definer set search_path = '' as $$
  update private.email_outbox set claimed_at = now(), attempts = attempts + 1
  where id in (select id from private.email_outbox where sent_at is null and send_after <= now() and attempts < 5
    and (claimed_at is null or claimed_at < now() - interval '10 minutes')
    and (channel = 'transactional' or coalesce((select value = 'true'::jsonb from private.app_settings where key = 'campaign_sending'), false))
    order by channel desc, send_after limit p_limit for update skip locked)
  returning *
$$;

create or replace function private.payments_tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.waitlist_tick();
  if exists (select 1 from private.stripe_events where processed_at is null and attempts < 10
             and received_at < now() - interval '30 seconds') then
    perform private.call_function('stripe-process');
  end if;
  if exists (select 1 from private.email_outbox where sent_at is null and send_after <= now() and attempts < 5
             and (claimed_at is null or claimed_at < now() - interval '10 minutes')
             and (channel = 'transactional' or coalesce((select value = 'true'::jsonb from private.app_settings where key = 'campaign_sending'), false))) then
    perform private.call_function('email-dispatch');
  end if;
end $$;

-- What the app shows: is campaign sending on yet?
create or replace function public.my_organizer() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', o.id, 'display_name', o.display_name, 'support_email', o.support_email, 'slug', o.slug,
    'reviewed', o.reviewed_at is not null, 'pro', private.has_pro(o.id), 'postal_address', o.postal_address,
    'beta', coalesce((select value = 'true'::jsonb from private.app_settings where key = 'pro_free_beta'), false),
    'campaign_sending', coalesce((select value = 'true'::jsonb from private.app_settings where key = 'campaign_sending'), false))
  from public.organizers o where o.owner_user_id = (select auth.uid())
$$;

revoke execute on function public.save_organizer_address(text), public.save_campaign(uuid, text, text, jsonb),
  public.campaign_audience(jsonb), public.send_campaign_test(uuid), public.queue_campaign(uuid), public.unsubscribe(text) from public;
grant execute on function public.save_organizer_address(text), public.save_campaign(uuid, text, text, jsonb),
  public.campaign_audience(jsonb), public.send_campaign_test(uuid), public.queue_campaign(uuid) to authenticated;
grant execute on function public.unsubscribe(text) to anon, authenticated;

notify pgrst, 'reload schema';
