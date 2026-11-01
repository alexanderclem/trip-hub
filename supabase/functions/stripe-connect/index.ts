// The organizer connects their own Stripe account (Stripe-hosted onboarding), or refreshes its status.
// POST { action: 'start' | 'refresh', return_path } as a signed-in account. Returns { url } or { status }.
import { admin, caller, cors, json, rpcOf, site, stripe } from '../_deno/server.ts'
import { syncAccount } from '../_shared/process.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const user = await caller(req)
  if (!user || user.isAnonymous) return json({ error: 'Sign in with an account first.' }, 401)
  const db = admin()
  const rpc = rpcOf(db)
  const s = stripe()
  try {
    const body = await req.json().catch(() => ({})) as { action?: string; return_path?: string }
    const organizer = await rpc('pay_organizer_for_user', { p_user: user.id }) as { id: string; display_name: string; support_email: string; stripe_account_id: string | null } | null
    if (!organizer) return json({ error: 'Set up your organizer profile first.' }, 400)
    let accountId = organizer.stripe_account_id
    if (!accountId) {
      // Standard-style controller properties: the organizer is the merchant of record, Stripe
      // collects their details and carries losses, fees are charged to their account, and they get
      // the full Stripe Dashboard (refunds, disputes, payout schedule).
      const account = await s.post<{ id: string }>('/v1/accounts', {
        country: 'US',
        email: organizer.support_email,
        business_profile: { name: organizer.display_name },
        controller: { losses: { payments: 'stripe' }, fees: { payer: 'account' }, requirement_collection: 'stripe', stripe_dashboard: { type: 'full' } },
      }, { idempotencyKey: `account:${organizer.id}` })
      accountId = account.id
    }
    await syncAccount(accountId, { stripe: s, rpc, site: site() }, organizer.id)
    if (body.action === 'refresh') return json({ status: 'ok' })
    const back = /^\/t\/[0-9a-f-]{36}\/[\w/-]*$|^\/organize$/.test(body.return_path ?? '') ? body.return_path! : '/organize'
    const link = await s.post<{ url: string }>('/v1/account_links', {
      account: accountId, type: 'account_onboarding',
      refresh_url: `${site()}${back}?stripe=refresh`, return_url: `${site()}${back}?stripe=return`,
    })
    return json({ url: link.url })
  } catch (e) {
    console.error('[stripe-connect]', e instanceof Error ? e.message : e)
    return json({ error: 'Could not reach Stripe. Try again in a minute.' }, 502)
  }
})
