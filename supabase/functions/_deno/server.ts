// Deno-only helpers shared by the payment Edge Functions (not type-checked by the Node config; the
// logic they call lives in ../_shared and is tested there).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { stripeClient } from '../_shared/stripe.ts'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

export const env = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not set`)
  return value
}

/** Service-role client: only for pay_* functions and reads the functions need. */
export const admin = (): SupabaseClient => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

export const stripe = () => stripeClient({ secretKey: env('STRIPE_SECRET_KEY'), apiVersion: Deno.env.get('STRIPE_API_VERSION') ?? undefined })

export const site = () => Deno.env.get('SITE_URL') ?? 'https://joinstowaway.app'

/** pay_* calls with named arguments; errors become exceptions carrying Postgres's message. */
export const rpcOf = (db: SupabaseClient) => async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw Object.assign(new Error(error.message), { code: error.code })
  return data
}

/** The signed-in caller (a guest phone or an account), from the Authorization header. */
export async function caller(req: Request): Promise<{ id: string; isAnonymous: boolean; email: string | null } | null> {
  const authorization = req.headers.get('Authorization')
  if (!authorization) return null
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  return { id: data.user.id, isAnonymous: data.user.is_anonymous === true, email: data.user.email ?? null }
}

/** Cron calls carry the Vault cron token (as push-dispatch does). */
export async function fromCron(req: Request, db: SupabaseClient): Promise<boolean> {
  const { data } = await db.rpc('push_check_token', { p_token: req.headers.get('x-cron-token') ?? '' })
  return data === true
}
