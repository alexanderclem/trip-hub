import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, ErrorNote, LinkButton } from '@/ui'
import { Brand } from '@/ui/Brand'
import { LoadingState } from '@/ui/LoadingState'
import { afterEntry } from '@/features/onboarding/profile'
import { joinedTripForToken, joinTargetQuery, joinTrip, parseJoinTarget, parseShareToken } from './actions'

/** The token remains in memory for recovery after it is removed from browser history. */
export function JoinScreen() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const token = useRef(parseShareToken(location.hash))
  // A shared vote link also says where to land (`?to=vote/<id>`).
  const target = useRef(parseJoinTarget(location.search))
  const started = useRef(false)
  const attempt = useCallback(async () => {
    if (!token.current) { setError('This link is missing its trip code. Ask your group for a new invite.'); return }
    setError(null)
    setBusy(true)
    try {
      const to = target.current
      // Someone already on the trip opens a shared link straight away, with or without signal.
      const known = to ? await joinedTripForToken(token.current) : null
      if (known) { navigate(`/t/${known}/${to}`, { replace: true }); return }
      const { tripId, memberId } = await joinTrip(token.current)
      navigate(memberId ? await afterEntry(`/t/${tripId}/${to ?? 'overview?joined=1'}`) : `/t/${tripId}/who${joinTargetQuery(to)}`, { replace: true })
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not join. Please try again.') }
    finally { setBusy(false) }
  }, [navigate])
  useEffect(() => {
    if (started.current) return
    started.current = true
    history.replaceState(null, '', '/join')
    void attempt()
  }, [attempt])
  return <div className="pt-safe mx-auto flex min-h-full max-w-md flex-col justify-center p-6 text-center">
    <Link to="/" aria-label="Stowaway home" className="mx-auto mb-8"><Brand /></Link>
    {error ? <div className="space-y-4">
      <h1 className="text-xl font-semibold">Couldn't join the trip</h1>
      <ErrorNote error={error} />
      {!navigator.onLine && <p className="text-sm text-stone-600">You're offline. Joining needs a connection once.</p>}
      {token.current && <Button className="w-full" disabled={busy} onClick={() => void attempt()}>{busy ? 'Joining…' : 'Try joining again'}</Button>}
      <LinkButton to="/app" variant="secondary" className="w-full">Back to your trips</LinkButton>
    </div> : <LoadingState title="Joining your group…" description="Downloading the shared plan so it’s ready on this device." />}
  </div>
}
