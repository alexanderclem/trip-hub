import { useConfirm } from '@/ui/ConfirmProvider'
import { useState } from 'react'
import { ShieldCheck, UserRound } from 'lucide-react'
import { useOnline } from '@/lib/useOnline'
import { Button, Card, ErrorNote, Field, Input, LinkButton } from '@/ui'
import { CardDescription, CardHeader, CardTitle } from '@/ui/collection'
import { MIN_PASSWORD, setPassword, signOutAndClear, startGoogleSignIn, unsyncedCount, useAccount, useSignInMethods } from './account'

/** Sign in with Google or email, or see who is signed in. Hidden until a way of signing in is switched on. */
export function AccountCard() {
  const confirm = useConfirm()
  const account = useAccount()
  const methods = useSignInMethods()
  const online = useOnline()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPasswordText] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (account.kind === 'loading') return null
  if (account.kind === 'guest' && !methods.google && !methods.email) return null

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

  async function savePassword() {
    if (password === null) return
    setBusy(true)
    setError(null)
    try {
      await setPassword(password)
      setPasswordText(null)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the password. Try again.')
    } finally {
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
        {saved && <p role="status" className="mt-3 text-sm text-stone-600">Password saved. You can sign in with it, or with a code by email.</p>}
        {password === null ? (
          <Button variant="ghost" className="mt-2 -ml-4" disabled={busy || !online} onClick={() => { setSaved(false); setPasswordText('') }}>Set a password</Button>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void savePassword() }}>
            <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
              <Input type="password" value={password} onChange={(e) => setPasswordText(e.target.value)} autoComplete="new-password" required minLength={MIN_PASSWORD} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !online || password.length < MIN_PASSWORD}>Save password</Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setPasswordText(null)}>Cancel</Button>
            </div>
          </form>
        )}
        <Button variant="secondary" className="mt-4 w-full" disabled={busy} onClick={() => void signOut()}>Sign out and clear this phone</Button>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <UserRound aria-hidden="true" className="mb-2 size-5 text-brand-700" />
        <CardTitle>Keep your trips if you change phones</CardTitle>
        <CardDescription>Optional. Sign in and your trips come back on any phone. Without it, this phone is the only key.</CardDescription>
      </CardHeader>
      <ErrorNote error={error} />
      {methods.google && <Button className="mt-4 w-full" disabled={busy || !online} onClick={() => void signIn()}>{busy ? 'Opening Google…' : 'Sign in with Google'}</Button>}
      {methods.email && <LinkButton to="/signin" variant={methods.google ? 'secondary' : 'primary'} className={`w-full ${methods.google ? 'mt-2' : 'mt-4'}`}>{methods.google ? 'Use email instead' : 'Sign in with email'}</LinkButton>}
      {!online && <p className="mt-2 text-xs text-stone-600">You need signal to sign in.</p>}
    </Card>
  )
}
