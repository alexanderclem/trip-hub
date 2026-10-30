-- Wakes the payment Edge Functions (docs/PAYMENTS.md). Like push_tick, a quiet minute costs nothing:
-- the functions are called only when a webhook event or an email is waiting. Once a day,
-- stripe-process also queues balance reminders and reconciles the last three days with Stripe.
-- Uses the Vault secrets push already relies on (project_url, cron_token).

-- How many emails went out in the last 24 hours (Gmail allows about 500 recipients a day).
create function public.pay_email_sent_today() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from private.email_outbox where sent_at > now() - interval '1 day'
$$;
revoke execute on function public.pay_email_sent_today() from public, anon, authenticated;
grant execute on function public.pay_email_sent_today() to service_role;

create function private.call_function(p_name text, p_body jsonb default '{}') returns void
language sql security definer set search_path = '' as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_token')),
    body := p_body,
    timeout_milliseconds := 30000)
$$;

create function private.payments_tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.stripe_events where processed_at is null and attempts < 10
             and received_at < now() - interval '30 seconds') then
    perform private.call_function('stripe-process');
  end if;
  if exists (select 1 from private.email_outbox where sent_at is null and send_after <= now() and attempts < 5
             and (claimed_at is null or claimed_at < now() - interval '10 minutes')) then
    perform private.call_function('email-dispatch');
  end if;
end $$;

select cron.schedule('payments-tick', '* * * * *', 'select private.payments_tick()');
-- 14:07 UTC: morning in the US, after overnight payouts settle.
select cron.schedule('payments-daily', '7 14 * * *', $$ select private.call_function('stripe-process', '{"daily": true}'::jsonb) $$);
