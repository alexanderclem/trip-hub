import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (see .env.local)')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

/** Every device gets an anonymous account on first use; that identity is what joins trips. */
export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    // A stored session can outlive its user (e.g. the account was removed server-side).
    // Check with the server; if it's rejected, start over. If there's no signal, trust it.
    const { error } = await supabase.auth.getUser()
    if (!error) return data.session.user.id
    const rejected = error.status === 401 || error.status === 403 || /not.?found|does not exist/i.test(error.message)
    if (!rejected) return data.session.user.id
    await supabase.auth.signOut({ scope: 'local' })
  }
  const { data: signIn, error } = await supabase.auth.signInAnonymously()
  if (error || !signIn.user) {
    const msg = error?.message ?? 'unknown error'
    throw new Error(
      msg.includes('Anonymous sign-ins are disabled')
        ? 'Trip Hub is not set up yet: anonymous sign-ins are disabled in Supabase.'
        : /rate limit/i.test(msg)
          ? 'Too many new phones joined from this network in the last hour. Try again in a little while, or switch between Wi-Fi and mobile data.'
          : `Could not sign in: ${msg}`,
    )
  }
  return signIn.user.id
}
