// The organizer refunds a booking from the app. POST { booking_id, amount_minor, cancel } as an
// organizer of the trip. Refunds run on their own Stripe account, newest charge first, each keyed so a
// retry never refunds twice. The webhook mirrors them and gives back our 1%.
import { admin, caller, cors, json, rpcOf, stripe } from '../_deno/server.ts'
import { splitRefund } from '../_shared/refunds.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const user = await caller(req)
  if (!user || user.isAnonymous) return json({ error: 'Sign in with your organizer account.' }, 401)
  const rpc = rpcOf(admin())
  let body: { booking_id?: string; amount_minor?: number; cancel?: boolean }
  try { body = await req.json() } catch { return json({ error: 'Bad request' }, 400) }
  if (!body.booking_id) return json({ error: 'Choose a booking.' }, 400)
  try {
    const plan = await rpc('pay_refund_plan', { p_user: user.id, p_booking: body.booking_id }) as
      { charges: { charge: string; refundable: number }[]; stripe_account_id: string; refunded_minor: number } | null
    if (!plan) return json({ error: 'Only this trip’s organizer can refund it.' }, 403)
    const amount = Math.floor(Number(body.amount_minor ?? 0))
    if (amount > 0) {
      const parts = splitRefund(amount, plan.charges)
      const s = stripe()
      for (const p of parts) {
        await s.post('/v1/refunds', { charge: p.charge, amount: p.amount, reason: 'requested_by_customer', metadata: { booking_id: body.booking_id } },
          { account: plan.stripe_account_id, idempotencyKey: `refund:${body.booking_id}:${p.charge}:${plan.refunded_minor}:${p.amount}` })
      }
    }
    if (body.cancel) await rpc('pay_cancel_booking', { p_user: user.id, p_booking: body.booking_id })
    return json({ refunded: amount, cancelled: !!body.cancel })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[refund-create]', message)
    return json({ error: message.startsWith('That’s more') ? message : 'Stripe couldn’t make the refund. Nothing was refunded; try again or use your Stripe Dashboard.' }, 502)
  }
})
