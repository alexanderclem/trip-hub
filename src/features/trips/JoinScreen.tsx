import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, ErrorNote } from '@/ui'
import { Brand } from '@/ui/Brand'
import { joinTrip, parseShareToken } from './actions'

/** Landing page for a shared trip link: /join#t=<token>. */
export function JoinScreen() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return // StrictMode runs effects twice in development
    started.current = true
    const token = parseShareToken(location.hash)
    if (!token) {
      setError('This link is missing its trip code.')
      return
    }
    // Keep the token out of the address bar and browser history.
    history.replaceState(null, '', '/join')
    joinTrip(token)
      .then(({ tripId, memberId }) =>
        navigate(memberId ? `/t/${tripId}` : `/t/${tripId}/who`, { replace: true }),
      )
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [navigate])

  return (
    <div className="pt-safe mx-auto flex h-full max-w-md flex-col justify-center p-6 text-center">
      <Link to="/" aria-label="Stowaway home" className="mx-auto mb-8"><Brand /></Link>
      {error ? (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">Couldn't join the trip</h1>
          <ErrorNote error={error} />
          {!navigator.onLine && <p className="text-sm text-stone-500">You're offline. Joining needs a connection once.</p>}
          <Link to="/">
            <Button variant="secondary" className="w-full">
              Back
            </Button>
          </Link>
        </div>
      ) : (
        <p className="text-stone-500">Joining trip…</p>
      )}
    </div>
  )
}
