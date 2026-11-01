// Called by pg_cron (x-cron-token). Every minute: retries webhook events that didn't finish. Daily
// ({ "daily": true }): queues balance reminders and re-syncs the last 3 days of Checkout Sessions on
// every connected account, in case a webhook never arrived.
import { admin, fromCron, json, rpcOf, site, stripe } from '../_deno/server.ts'
import { processEvent, reconcileAccount } from '../_shared/process.ts'
import type { StripeEvent } from '../_shared/stripe.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const db = admin()
  if (!(await fromCron(req, db))) return json({ error: 'Forbidden' }, 403)
  const rpc = rpcOf(db)
  const deps = { stripe: stripe(), rpc, site: site() }
  const body = await req.json().catch(() => ({})) as { daily?: boolean }
  let processed = 0
  let failed = 0
  const events = await rpc('pay_inbox_next', { p_limit: 25 }) as { id: string; account: string | null; payload: StripeEvent }[]
  for (const e of events ?? []) {
    try {
      await processEvent({ ...e.payload, account: e.account ?? e.payload.account }, deps)
      await rpc('pay_inbox_done', { p_event_id: e.id, p_error: null })
      processed++
    } catch (err) {
      await rpc('pay_inbox_done', { p_event_id: e.id, p_error: err instanceof Error ? err.message.slice(0, 500) : 'failed' })
      failed++
    }
  }
  let reconciled = 0
  let reminders = 0
  if (body.daily) {
    reminders = await rpc('pay_enqueue_reminders', { p_site: site() }) as number
    const { data: accounts } = await db.from('stripe_accounts').select('stripe_account_id').is('disconnected_at', null)
    const since = Math.floor(Date.now() / 1000) - 3 * 86400
    for (const a of (accounts ?? []) as { stripe_account_id: string }[]) {
      try { reconciled += await reconcileAccount(a.stripe_account_id, since, deps) } catch (err) { console.error('[reconcile]', a.stripe_account_id, err) }
    }
  }
  return json({ processed, failed, reconciled, reminders })
})
