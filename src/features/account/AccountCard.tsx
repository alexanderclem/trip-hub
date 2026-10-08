import { useConfirm } from '@/ui/ConfirmProvider'
import { useState } from 'react'
import { ShieldCheck, UserRound } from 'lucide-react'
import { useOnline } from '@/lib/useOnline'
import { Button, Card, ErrorNote } from '@/ui'
import { CardDescription, CardHeader, CardTitle } from '@/ui/collection'
import { signOutAndClear, startGoogleSignIn, unsyncedCount, useAccount, useGoogleEnabled } from './account'

/** Sign in with Google, or see who is signed in. Hidden until Google sign-in is switched on. */
export function AccountCard() {
  const confirm = useConfirm()
  const account = useAccount()
  const google = useGoogleEnabled()
  const online = useOnline()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (account.kind === 'loading') return null
  if (account.kind === 'guest' && !google) return null

  async function signIn() {
    setBusy(true)
    setError(null)
    try {
      await startGoogleSignIn() // leaves the page
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in. Try again.')
      setBusy(false)
    }
  }

  async function signOut() {
    const waiting = await unsyncedCount()
    const warning = waiting > 0
      ? `${waiting} ${waiting === 1 ? 'change has' : 'changes have'} not synced yet and will be lost. `
      : ''
    if (!await confirm(`${warning}Sign out and remove all trips from this phone? You can get them back by signing in again.`)) return
    setBusy(true)
    try {
      await signOutAndClear()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign out. Try again.')
      setBusy(false)
    }
  }

  if (account.kind === 'signed-in') {
    return (
      <Card>
        <CardHeader>
          <ShieldCheck aria-hidden="true" className="mb-2 size-5 text-brand-700" />
          <CardTitle>Your trips are on your account</CardTitle>
          <CardDescription>Signed in{account.email ? ` as ${account.email}` : ''}. Sign in on another phone to get your trips there.</CardDescription>
        </CardHeader>
        <ErrorNote error={error} />
        <Button variant="secondary" className="mt-4 w-full" disabled={busy} onClick={() => void signOut()}>Sign out and clear this phone</Button>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <UserRound aria-hidden="true" className="mb-2 size-5 text-brand-700" />
        <CardTitle>Keep your trips if you change phones</CardTitle>
        <CardDescription>Optional. Sign in with Google and your trips come back on any phone. Without it, this phone is the only key.</CardDescription>
      </CardHeader>
      <ErrorNote error={error} />
      <Button className="mt-4 w-full" disabled={busy || !online} onClick={() => void signIn()}>{busy ? 'Opening Google…' : 'Sign in with Google'}</Button>
      {!online && <p className="mt-2 text-xs text-stone-500">You need signal to sign in.</p>}
    </Card>
  )
}
