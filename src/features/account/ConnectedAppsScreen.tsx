import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useOnline } from '@/lib/useOnline'
import { Brand } from '@/ui/Brand'
import { Button, Card, ErrorNote } from '@/ui'
import { useAccount } from './account'

type Grants = NonNullable<Awaited<ReturnType<typeof supabase.auth.oauth.listGrants>>['data']>

export function ConnectedAppsScreen() {
  const account = useAccount()
  const online = useOnline()
  const [grants, setGrants] = useState<Grants | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let cancelled = false
    setGrants(null)
    setError(null)
    if (account.kind !== 'signed-in' || !online) return
    void supabase.auth.oauth.listGrants().then(({ data, error: problem }) => {
      if (cancelled) return
      if (problem) setError('Could not load connected apps. Account linking may not be enabled yet.')
      else setGrants(data)
    }).catch(() => { if (!cancelled) setError('Could not load connected apps. Try again.') })
    return () => { cancelled = true }
  }, [account.kind, online, retry])

  async function disconnect(clientId: string) {
    setBusy(clientId)
    setError(null)
    try {
      const { error: problem } = await supabase.auth.oauth.revokeGrant({ clientId })
      if (problem) throw problem
      setGrants((current) => current?.filter((grant) => grant.client.id !== clientId) ?? null)
    } catch { setError('Could not disconnect this app. Try again.') }
    finally { setBusy(null) }
  }

  return <main className="mx-auto max-w-lg space-y-6 px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
    <Brand />
    <div><h1 className="text-2xl font-semibold tracking-tight">Connected apps</h1><p className="mt-3 text-sm leading-relaxed text-stone-600">Manage apps you have allowed to access your Stowaway account.</p></div>
    {account.kind === 'guest' ? <p className="text-sm text-stone-600">Sign in from your trips page to manage connected apps.</p>
      : !online ? <p role="status">Connect to the internet to manage apps.</p>
      : grants ? grants.length ? grants.map((grant) => <Card key={grant.client.id} className="space-y-3">
        <h2 className="break-words text-lg font-semibold">{grant.client.name}</h2>
        <p className="text-sm text-stone-600">Disconnecting stops this app from refreshing its access. Existing access expires within five minutes. It does not remove information already shared.</p>
        <Button variant="danger" disabled={busy !== null} onClick={() => void disconnect(grant.client.id)}>{busy === grant.client.id ? 'Disconnecting…' : 'Disconnect'}</Button>
      </Card>) : <p role="status" className="text-sm text-stone-600">You have no connected apps.</p>
      : !error ? <p role="status">Loading connected apps…</p> : null}
    {error && <div className="space-y-3"><ErrorNote error={error} /><Button variant="secondary" disabled={!online} onClick={() => setRetry((value) => value + 1)}>Try again</Button></div>}
    <Link to="/" className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700">Back to your trips</Link>
  </main>
}
