// Called by pg_cron (private.push_tick) when queued notifications are waiting. Claims a batch,
// sends each as a Web Push message, and disables subscriptions the push service says are gone.
// Auth: the x-cron-token header must match the Vault secret; runs with the service role.
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'
import { plan, type QueuedEvent } from './dispatch.ts'

// Push services may contact the sender at this address about problems.
const CONTACT = 'https://trip-hub.alexanderclem12.workers.dev'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const token = req.headers.get('x-cron-token') ?? ''
  const { data: ok } = await admin.rpc('push_check_token', { p_token: token })
  if (!ok) return json({ error: 'Forbidden' }, 403)

  const { data: keys, error: keyErr } = await admin.rpc('push_vapid_keys')
  if (keyErr || !keys) return json({ error: 'VAPID keys missing from Vault' }, 500)
  const vapidKeys = await webpush.importVapidKeys(keys, { extractable: false })
  const server = await webpush.ApplicationServer.new({ contactInformation: CONTACT, vapidKeys })

  let sent = 0
  let failed = 0
  for (let round = 0; round < 5; round++) {
    const { data, error } = await admin.rpc('push_claim_batch')
    if (error) return json({ error: error.message, sent, failed }, 500)
    const events = (data ?? []) as QueuedEvent[]
    if (!events.length) break
    const sends = plan(events)
    await Promise.all(sends.map(async ({ sub, payload }) => {
      try {
        await server.subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } })
          .pushTextMessage(payload, { ttl: 6 * 3600, urgency: webpush.Urgency.High })
        sent++
      } catch (e) {
        failed++
        const gone = e instanceof webpush.PushMessageError && (e.isGone() || e.response.status === 404)
        // PushMessageError carries the status in toString(), not message.
        await admin.rpc('push_mark_failed', { p_endpoint: sub.endpoint, p_error: String(e), p_gone: gone })
      }
    }))
  }
  console.log(JSON.stringify({ sent, failed }))
  return json({ sent, failed })
})
