// Starts a payment. POST { slug, name, email, policy_version } holds a place and returns the Stripe
// Checkout URL for the first payment; POST { token } (a booking's private link) does the same for the
// balance. Any signed-in phone may call it, guests included: travelers never need an account.
import { admin, caller, cors, json, rpcOf, site, stripe } from '../_deno/server.ts'
import { checkoutSession, firstPayment, type PaymentKind } from '../_shared/checkout.ts'

const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const user = await caller(req)
  if (!user) return json({ error: 'Open the trip page again and retry.' }, 401)
  const rpc = rpcOf(admin())
  const s = stripe()
  let body: { slug?: string; name?: string; email?: string; policy_version?: number; token?: string }
  try { body = await req.json() } catch { return json({ error: 'Bad request' }, 400) }

  try {
    let booking: { bookingId: string; kind: PaymentKind; base: number; title: string; feeMode: 'absorb' | 'pass'; allowBank: boolean; email: string; slug: string; token: string; account: string }
    if (body.token) {
      const due = await rpc('pay_booking_due', { p_token: body.token }) as { booking_id: string; due_minor: number; paid_minor: number; title: string; slug: string; fee_mode: 'absorb' | 'pass'; allow_bank: boolean; stripe_account_id: string; traveler_email: string } | null
      if (!due) return json({ error: 'This booking can’t take a payment right now. Contact your organizer.' }, 404)
      if (due.due_minor <= 0) return json({ error: 'Nothing is left to pay.' }, 400)
      booking = { bookingId: due.booking_id, kind: due.paid_minor > 0 ? 'balance' : 'full', base: due.due_minor, title: due.title, feeMode: due.fee_mode,
        allowBank: due.allow_bank, email: due.traveler_email, slug: due.slug, token: body.token, account: due.stripe_account_id }
    } else {
      const name = (body.name ?? '').trim()
      const address = (body.email ?? '').trim()
      if (!body.slug || !name || name.length > 40 || !email.test(address) || typeof body.policy_version !== 'number') {
        return json({ error: 'Add your name and email, and accept the cancellation policy.' }, 400)
      }
      const r = await rpc('pay_reserve_booking', { p_slug: body.slug, p_user: user.id, p_name: name, p_email: address, p_policy_version: body.policy_version }) as
        { booking_id: string; manage_token: string; title: string; slug: string; stripe_account_id: string; price_minor: number; deposit_minor: number; fee_mode: 'absorb' | 'pass'; allow_bank: boolean; traveler_email: string }
      const first = firstPayment(r.price_minor, r.deposit_minor)
      booking = { bookingId: r.booking_id, kind: first.kind, base: first.base, title: r.title, feeMode: r.fee_mode, allowBank: r.allow_bank,
        email: r.traveler_email, slug: r.slug, token: r.manage_token, account: r.stripe_account_id }
    }
    const c = checkoutSession({ ...booking, site: site(), nowSeconds: Math.floor(Date.now() / 1000) })
    const session = await s.post<{ id: string; url: string }>('/v1/checkout/sessions', c.params, { account: booking.account, idempotencyKey: c.idempotencyKey })
    await rpc('pay_open_payment', { p_booking: booking.bookingId, p_kind: booking.kind, p_base: booking.base, p_charged: c.charged,
      p_app_fee: c.applicationFee, p_session_id: session.id, p_expires_at: new Date(c.expiresAt * 1000).toISOString() })
    return json({ url: session.url })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    // Messages raised by pay_reserve_booking are written for travelers (full, policy changed, …).
    if ((e as { code?: string }).code && ['P0002', '40001'].includes((e as { code: string }).code)) return json({ error: message }, 409)
    console.error('[checkout-create]', message)
    return json({ error: 'Payments are unavailable for a moment. Nothing was charged; try again.' }, 502)
  }
})
