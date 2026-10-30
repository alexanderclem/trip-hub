// Stripe webhooks for the platform endpoint and the Connect endpoint (deploy with verify_jwt off).
// Verifies the signature, stores the event once (the inbox), answers 200 at once, then tries to
// process it; anything that fails is retried by stripe-process every minute.
import { admin, json, rpcOf, site, stripe } from '../_deno/server.ts'
import { verifyWebhook } from '../_shared/stripe.ts'
import { processEvent } from '../_shared/process.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const payload = await req.text()
  let event
  try {
    event = await verifyWebhook(payload, req.headers.get('Stripe-Signature'),
      [Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '', Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET') ?? ''])
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Bad signature' }, 400)
  }
  const rpc = rpcOf(admin())
  const isNew = await rpc('pay_inbox_add', { p_event_id: event.id, p_account: event.account ?? null, p_type: event.type, p_payload: JSON.parse(payload) })
  if (isNew) {
    try {
      await processEvent(event, { stripe: stripe(), rpc, site: site() })
      await rpc('pay_inbox_done', { p_event_id: event.id, p_error: null })
    } catch (e) {
      await rpc('pay_inbox_done', { p_event_id: event.id, p_error: e instanceof Error ? e.message.slice(0, 500) : 'failed' })
    }
  }
  return json({ received: true })
})
