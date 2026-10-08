import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useOnline } from '@/lib/useOnline'
import { Brand } from '@/ui/Brand'
import { Button, Card, ErrorNote, LinkButton } from '@/ui'
import { startGoogleSignIn, useAccount, useSignInMethods } from './account'
import { chatgptRedirect, rememberConnectorReturn } from './connector'

export function ConnectorConsentScreen() {
  const [params] = useSearchParams()
  const authorizationId = params.get('authorization_id')
  const account = useAccount()
  const methods = useSignInMethods()
  const online = useOnline()
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  const validId = !!authorizationId && /^[a-zA-Z0-9_-]{1,200}$/.test(authorizationId)

  useEffect(() => {
    let cancelled = false
    setDetails(null)
    setError(null)
    if (!validId || account.kind !== 'signed-in' || !online) return
    void supabase.auth.oauth.getAuthorizationDetails(authorizationId!).then(({ data, error: problem }) => {
      if (cancelled) return
      if (problem || !data) { setError('Could not load this connection request. Start again from ChatGPT.'); return }
      try {
        if ('redirect_url' in data) { location.assign(chatgptRedirect(data.redirect_url)); return }
        chatgptRedirect(data.redirect_uri)
        if (data.scope.split(' ').some((scope) => !['openid', 'email', 'profile'].includes(scope))) throw new Error('This app requested unsupported permissions.')
        setDetails(data)
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this request.') }
    }).catch(() => { if (!cancelled) setError('Could not load this connection request. Check your connection and try again.') })
    return () => { cancelled = true }
  }, [authorizationId, validId, account.kind, online, retry])

  async function signIn() {
    if (!validId) return
    setBusy(true)
    setError(null)
    try {
      rememberConnectorReturn(`/oauth/consent?authorization_id=${authorizationId}`)
      await startGoogleSignIn()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in.'); setBusy(false) }
  }

  async function decide(approve: boolean) {
    if (!details || busy || !online) return
    setBusy(true)
    setError(null)
    try {
      const { data, error: problem } = approve
        ? await supabase.auth.oauth.approveAuthorization(details.authorization_id, { skipBrowserRedirect: true })
        : await supabase.auth.oauth.denyAuthorization(details.authorization_id, { skipBrowserRedirect: true })
      if (problem || !data) throw new Error('Could not finish connecting. Start again from ChatGPT.')
      location.assign(chatgptRedirect(data.redirect_url))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not finish connecting.'); setBusy(false) }
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <Brand />
      <div>
        <p className="text-sm font-medium text-brand-700">Connect your account</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Your trips in ChatGPT</h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">Ask about your shared plans using the trips saved to your Stowaway account.</p>
      </div>
      {!validId ? <ErrorNote error="This connection request is missing or invalid. Start again from ChatGPT." />
        : account.kind === 'loading' ? <p role="status">Checking your account…</p>
        : account.kind === 'guest' ? <Card className="space-y-4">
          <h2 className="text-lg font-semibold">Sign in to connect your trips</h2>
          <p className="text-sm leading-relaxed text-stone-600">Use the same account you use in Stowaway. After signing in, you can review and approve the connection.</p>
          {methods.google && <Button onClick={() => void signIn()} disabled={busy || !online} className="w-full">{busy ? 'Opening Google…' : 'Sign in with Google'}</Button>}
          {methods.email && <LinkButton to="/signin" variant={methods.google ? 'secondary' : 'primary'} className="w-full" onClick={() => rememberConnectorReturn(`/oauth/consent?authorization_id=${authorizationId}`)}>{methods.google ? 'Use email instead' : 'Sign in with email'}</LinkButton>}
          {!methods.google && !methods.email && <p className="text-sm text-stone-600">Sign-in needs to be enabled for Stowaway before you can connect.</p>}
        </Card>
        : details ? <Card className="space-y-4">
          <h2 className="break-words text-lg font-semibold">Allow {details.client.name} to read your trips?</h2>
          <p className="break-words text-sm text-stone-600">Signed in as {account.email ?? details.user.email}</p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
            <li>Read names, dates, timezones and currencies for trips you have joined.</li>
            <li>Read itinerary titles, times, activity types and plan status.</li>
            {details.scope.includes('email') && <li>Read your account email address.</li>}
            {details.scope.includes('profile') && <li>Read your account profile.</li>}
          </ul>
          <p className="text-sm leading-relaxed text-stone-600">This connection cannot change your plans or read tickets, booking codes, expenses or private notes. Only changes synced to your account are available.</p>
          <p className="text-sm text-stone-600">You can disconnect at any time in <Link to="/connections" className="font-medium text-brand-700 underline">Connected apps</Link>.</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void decide(true)} disabled={busy || !online}>{busy ? 'Finishing…' : 'Allow connection'}</Button>
            <Button variant="secondary" onClick={() => void decide(false)} disabled={busy || !online}>Decline</Button>
          </div>
        </Card> : !error && online ? <p role="status">Loading the connection request…</p> : null}
      {!online && <p role="status" className="text-sm text-amber-900">Connect to the internet to link your account.</p>}
      {error && <div className="space-y-3"><ErrorNote error={error} />{account.kind === 'signed-in' && <Button variant="secondary" disabled={busy || !online} onClick={() => setRetry((value) => value + 1)}>Try again</Button>}</div>}
      <Link to="/app" className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700">Back to your trips</Link>
    </main>
  )
}
