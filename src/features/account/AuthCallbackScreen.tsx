import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Brand } from '@/ui/Brand'
import { ErrorNote } from '@/ui'
import { finishSignIn, type SignInResult } from './account'
import { takeConnectorReturn } from './connector'
import { quizStillNeeded } from '@/features/onboarding/profile'

/** Where Google sends the phone back to. Finishes sign-in, restores trips, then goes home. */
export function AuthCallbackScreen() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SignInResult | null>(null)
  const [returnPath, setReturnPath] = useState('/')

  useEffect(() => {
    let cancelled = false
    finishSignIn(location.search)
      .then(async (r) => {
        if (cancelled) return
        const connector = takeConnectorReturn()
        // A first sign-in continues to the travel quiz, unless a restored trip already has this person's answers.
        const destination = connector ?? ((await quizStillNeeded()) ? '/quiz?next=%2F' : '/')
        setReturnPath(destination)
        if (r.notCarried > 0) setResult(r)
        else navigate(destination, { replace: true })
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not sign in. Try again.')
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <main className="mx-auto max-w-md space-y-5 px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <Brand />
      {error ? (
        <>
          <h1 className="text-xl font-semibold">Sign-in didn’t finish</h1>
          <ErrorNote error={error} />
          <p className="text-sm text-stone-600">Nothing on this phone was changed.</p>
        </>
      ) : result ? (
        <>
          <h1 className="text-xl font-semibold">You’re signed in</h1>
          <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {result.notCarried} {result.notCarried === 1 ? 'trip on this phone was' : 'trips on this phone were'} not added to your account. Open {result.notCarried === 1 ? 'its' : 'their'} invite link again to join with your account.
          </p>
        </>
      ) : (
        <p role="status" className="text-stone-600">Signing you in and fetching your trips…</p>
      )}
      {(error || result) && <Link to={returnPath} replace className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 font-medium text-white">{returnPath === '/' ? 'Back to your trips' : 'Continue connecting'}</Link>}
    </main>
  )
}
