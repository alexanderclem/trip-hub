import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useOnline } from '@/lib/useOnline'
import { Button, ErrorNote, Field, Input, LinkButton, PageHeader } from '@/ui'
import {
  createPasswordAccount, MIN_PASSWORD, sendEmailCode, signedInDestination, signInWithPassword, verifyEmailCode,
  type EmailCodeKind, type SignInResult,
} from './account'

const RESEND_SECONDS = 60
type Step = { at: 'email' } | { at: 'password' } | { at: 'code'; kind: EmailCodeKind }

/** Sign in or make an account with an email address: a one-time code by default, or a password. */
export function EmailSignInScreen() {
  const navigate = useNavigate()
  const online = useOnline()
  const [step, setStep] = useState<Step>({ at: 'email' })
  const [email, setEmail] = useState('')
  const [password, setPasswordText] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(0)
  const [notCarried, setNotCarried] = useState<{ count: number; to: string } | null>(null)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const address = email.trim().toLowerCase()

  async function run(work: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function finish(result: SignInResult) {
    const to = await signedInDestination()
    if (result.notCarried > 0) setNotCarried({ count: result.notCarried, to })
    else navigate(to, { replace: true })
  }

  const sendCode = () => run(async () => {
    await sendEmailCode(address)
    setCode('')
    setWait(RESEND_SECONDS)
    setStep({ at: 'code', kind: 'email' })
  })

  const create = () => run(async () => {
    const result = await createPasswordAccount(address, password)
    if (result === 'needs-code') {
      setCode('')
      setStep({ at: 'code', kind: 'signup' })
    } else await finish(result)
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (step.at === 'email') void sendCode()
    else if (step.at === 'password') void run(async () => finish(await signInWithPassword(address, password)))
    else void run(async () => finish(await verifyEmailCode(address, code.trim(), step.kind)))
  }

  if (notCarried) {
    return (
      <main className="mx-auto max-w-md space-y-5 px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <h1 className="text-xl font-semibold">You’re signed in</h1>
        <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {notCarried.count} {notCarried.count === 1 ? 'trip on this phone was' : 'trips on this phone were'} not added to your account. Open {notCarried.count === 1 ? 'its' : 'their'} invite link again to join with your account.
        </p>
        <LinkButton to={notCarried.to} replace>Back to your trips</LinkButton>
      </main>
    )
  }

  const passwordReady = password.length >= MIN_PASSWORD
  return (
    <>
      <PageHeader title="Sign in with email" back="/app" />
      <form onSubmit={submit} className="mx-auto max-w-md space-y-4 p-5">
        {step.at === 'code' ? (
          <>
            <p className="text-sm leading-relaxed text-stone-600">We sent a code to <strong className="break-all font-medium text-stone-800">{address}</strong>. It can take a minute, and may land in spam.</p>
            <Field label="Code from the email">
              <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" autoFocus required maxLength={10} className="w-40 text-lg tracking-widest tabular-nums" />
            </Field>
            <ErrorNote error={error} />
            <Button type="submit" className="w-full" disabled={busy || !online || code.trim().length < 6}>{busy ? 'Checking…' : 'Sign in'}</Button>
            {step.kind === 'email' && <Button type="button" variant="ghost" className="w-full" disabled={busy || !online || wait > 0} onClick={() => void sendCode()}>{wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}</Button>}
            <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => { setError(null); setStep({ at: 'email' }) }}>Use a different email</Button>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-stone-600">Your trips come back on any phone you sign in on. New here? The same steps make your account.</p>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" autoCapitalize="none" required />
            </Field>
            {step.at === 'password' && (
              <Field label="Password" hint={`At least ${MIN_PASSWORD} characters.`}>
                <Input type="password" value={password} onChange={(e) => setPasswordText(e.target.value)} autoComplete="current-password" required minLength={MIN_PASSWORD} />
              </Field>
            )}
            <ErrorNote error={error} />
            {step.at === 'email' ? (
              <>
                <Button type="submit" className="w-full" disabled={busy || !online || !address}>{busy ? 'Sending…' : 'Email me a code'}</Button>
                <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => { setError(null); setStep({ at: 'password' }) }}>Use a password instead</Button>
              </>
            ) : (
              <>
                <Button type="submit" className="w-full" disabled={busy || !online || !address || !passwordReady}>{busy ? 'Signing in…' : 'Sign in'}</Button>
                <Button type="button" variant="secondary" className="w-full" disabled={busy || !online || !address || !passwordReady} onClick={() => void create()}>Create account</Button>
                <Button type="button" variant="ghost" className="w-full" disabled={busy || !online || !address} onClick={() => void sendCode()}>Forgot it? Email me a code instead</Button>
              </>
            )}
            {!online && <p className="text-xs text-stone-600">You need signal to sign in.</p>}
          </>
        )}
      </form>
    </>
  )
}
