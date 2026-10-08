// Optional sign-in, with Google or with an email address (a one-time code, or a password). A
// phone starts as a guest (an anonymous Supabase user) and stays fully usable that way. Signing in
// gives it an account that owns its trips, so a new or second phone can get them back. Both ways
// lead to the same account for the same address. Everything here needs signal; reading trips never does.

import { useEffect, useState } from 'react'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import { pull } from '@/data/sync/engine'
import { supabaseRemote } from '@/data/sync/remote'
import { supabase } from '@/lib/supabase'
import { quizStillNeeded } from '@/features/onboarding/profile'
import { takeConnectorReturn } from './connector'

const LINK_CODE_KEY = 'stowaway-link-code'
const GOOGLE_KEY = 'stowaway-google-enabled'
const EMAIL_KEY = 'stowaway-email-enabled'
export const MIN_PASSWORD = 8
export const CALLBACK_PATH = '/auth/callback'

export type Account =
  | { kind: 'loading' }
  | { kind: 'guest' } // no session yet, or an anonymous one
  | { kind: 'signed-in'; email: string | null }

export function useAccount(): Account {
  const [account, setAccount] = useState<Account>({ kind: 'loading' })
  useEffect(() => {
    const from = (user: { is_anonymous?: boolean; email?: string } | undefined): Account =>
      user && !user.is_anonymous ? { kind: 'signed-in', email: user.email ?? null } : { kind: 'guest' }
    // getSession reads the stored session, so this works with no signal.
    void supabase.auth.getSession().then(({ data }) => setAccount(from(data.session?.user)))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setAccount(from(session?.user)))
    return () => data.subscription.unsubscribe()
  }, [])
  return account
}

export interface SignInMethods { google: boolean; email: boolean }

/**
 * Which ways of signing in are switched on for this project. The last answer is remembered, so
 * the buttons don't flicker or vanish offline.
 */
export function useSignInMethods(): SignInMethods {
  const [methods, setMethods] = useState<SignInMethods>(() => ({ google: localStorage.getItem(GOOGLE_KEY) === '1', email: localStorage.getItem(EMAIL_KEY) === '1' }))
  useEffect(() => {
    let cancelled = false
    const url = import.meta.env.VITE_SUPABASE_URL as string
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : null))
      .then((settings: { external?: { google?: boolean; email?: boolean } } | null) => {
        if (cancelled || !settings) return
        const on = { google: settings.external?.google === true, email: settings.external?.email === true }
        localStorage.setItem(GOOGLE_KEY, on.google ? '1' : '0')
        localStorage.setItem(EMAIL_KEY, on.email ? '1' : '0')
        setMethods(on)
      })
      .catch(() => {}) // offline: keep the remembered answer
    return () => {
      cancelled = true
    }
  }, [])
  return methods
}

/** A guest gets a one-time code that lets the account take over this phone's trips afterwards. */
async function prepareLink(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.user.is_anonymous) return
  const { data: code, error } = await supabase.rpc('create_link_code')
  if (error) throw new Error(`Could not get ready to sign in: ${error.message}`)
  localStorage.setItem(LINK_CODE_KEY, code as string)
}

/** With a new session in place: hands this phone's guest trips to the account, then fetches the account's trips. */
async function completeSignIn(): Promise<SignInResult> {
  const linkCode = localStorage.getItem(LINK_CODE_KEY)
  if (linkCode) {
    localStorage.removeItem(LINK_CODE_KEY)
    // An expired code is not fatal: the trips are reported as not carried over.
    await supabase.rpc('redeem_link_code', { p_code: linkCode })
  }
  return restoreTrips()
}

/** Leaves the app for Google and comes back to CALLBACK_PATH. */
export async function startGoogleSignIn(): Promise<void> {
  await prepareLink()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}${CALLBACK_PATH}` },
  })
  if (error) throw new Error(`Could not open Google sign-in: ${error.message}`)
}

export interface SignInResult {
  /** Trips now on this phone that belong to the account. */
  trips: number
  /** Trips on this phone the account couldn't take over (the code had expired). */
  notCarried: number
}

let finishing: Promise<SignInResult> | null = null

/** Completes sign-in from the callback address. Safe to call twice (React strict mode). */
export function finishSignIn(search: string): Promise<SignInResult> {
  finishing ??= (async () => {
    const params = new URLSearchParams(search)
    const problem = params.get('error_description') ?? params.get('error')
    if (problem) throw new Error(problem)
    const authCode = params.get('code')
    if (!authCode) throw new Error('Sign-in did not finish. Try again.')
    const { error } = await supabase.auth.exchangeCodeForSession(authCode)
    if (error) throw new Error(`Could not sign in: ${error.message}`)
    return completeSignIn()
  })()
  return finishing
}

/** Which kind of emailed code is being entered: a sign-in code, or the one confirming a new password account. */
export type EmailCodeKind = 'email' | 'signup'

/** Emails a one-time code (and a link that comes back to CALLBACK_PATH). Makes the account if the address is new. */
export async function sendEmailCode(email: string): Promise<void> {
  await prepareLink()
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}${CALLBACK_PATH}` } })
  if (error) throw new Error(`Could not send the code: ${error.message}`)
}

export async function verifyEmailCode(email: string, token: string, kind: EmailCodeKind): Promise<SignInResult> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: kind })
  if (error) throw new Error('That code didn’t work. Check it, or send a new one.')
  return completeSignIn()
}

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  await prepareLink()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error('That email and password don’t match an account. Check them, or get a code by email instead.')
  return completeSignIn()
}

/** Makes a password account. 'needs-code' means the address has to be confirmed with an emailed code first. */
export async function createPasswordAccount(email: string, password: string): Promise<SignInResult | 'needs-code'> {
  await prepareLink()
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}${CALLBACK_PATH}` } })
  if (error) throw new Error(`Could not create the account: ${error.message}`)
  return data.session ? completeSignIn() : 'needs-code'
}

/** Adds or changes the password of the signed-in account. */
export async function setPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(`Could not save the password: ${error.message}`)
}

/** Where a newly signed-in phone goes: back to a waiting connection, to the travel quiz, or home. */
export async function signedInDestination(): Promise<string> {
  // A first sign-in continues to the travel quiz, unless a restored trip already has this person's answers.
  return takeConnectorReturn() ?? ((await quizStillNeeded()) ? '/quiz?next=%2Fapp' : '/app')
}

/** Brings the account's trips onto this phone: who you are on each, then the data. */
export async function restoreTrips(): Promise<SignInResult> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user.id
  if (!userId) throw new Error('Not signed in.')
  const { data, error } = await supabase.from('trip_devices').select('trip_id, member_id').eq('user_id', userId)
  if (error) throw new Error(`Could not load your trips: ${error.message}`)
  const rows = (data ?? []) as { trip_id: string; member_id: string | null }[]
  const mine = new Set(rows.map((r) => r.trip_id))
  const device = useDevice.getState()
  const notCarried = Object.keys(device.trips).filter((id) => !mine.has(id)).length
  for (const row of rows) device.rememberTrip(row.trip_id, row.member_id)
  // A trip that fails to download now is fetched by the normal sync when it's opened.
  await Promise.all(rows.map((row) => pull(supabaseRemote, row.trip_id).catch(() => undefined)))
  return { trips: rows.length, notCarried }
}

export const unsyncedCount = () => db._outbox.count()

/** Signs out and removes every trip from this phone, so the next person starts clean. */
export async function signOutAndClear(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' })
  useDevice.setState({ trips: {}, travelProfile: null, quizSeen: false })
  await db.delete()
  location.assign('/')
}
