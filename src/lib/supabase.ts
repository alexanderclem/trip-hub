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
  if (data.session) return data.session.user.id
  const { data: signIn, error } = await supabase.auth.signInAnonymously()
  if (error || !signIn.user) {
    throw new Error(
      error?.message.includes('Anonymous sign-ins are disabled')
        ? 'Trip Hub is not set up yet: anonymous sign-ins are disabled in Supabase.'
        : `Could not sign in: ${error?.message ?? 'unknown error'}`,
    )
  }
  return signIn.user.id
}
