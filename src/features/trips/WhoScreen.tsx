import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DateTime } from 'luxon'
import { useMembers, useTrip } from '@/data/hooks'
import { Avatar, Button, Card, ErrorNote, Input } from '@/ui'
import { claimMember, createMemberAndClaim, MEMBER_COLORS, parseJoinTarget, STOPPED_WAITING } from './actions'
import { useDevice } from '@/data/device'
import { newId } from '@/lib/ids'
import { LoadingState } from '@/ui/LoadingState'
import { afterEntry } from '@/features/onboarding/profile'
import { Brand } from '@/ui/Brand'
import { Stowie } from '@/features/stowie/Stowie'
import { tripAreas } from '@/features/destinations/destinations'

/** The whole of "Who are you?" (sign-in, access repair, claim, first download) finishes or gives up in this long. */
export const WHO_DEADLINE_MS = 20_000

/** "Who are you?" — ties this device to a person on the trip. */
export function WhoScreen() {
  const { tripId } = useParams() as { tripId: string }
  const navigate = useNavigate()
  const trip = useTrip(tripId)
  const members = useMembers(tripId)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    setSlow(false)
    if (!busy) return
    const timer = setTimeout(() => setSlow(true), 8_000)
    return () => clearTimeout(timer)
  }, [busy])

  const attempt = useRef(0)
  // Retrying "Add me" with the same name reuses the id, so a slow first try can't add them twice.
  const pendingNew = useRef<{ name: string; id: string } | null>(null)
  useEffect(() => () => { attempt.current++ }, [])

  async function run(memberId: string, fn: (signal: AbortSignal) => Promise<void>) {
    const mine = ++attempt.current
    const controller = new AbortController()
    setBusy(true)
    setError(null)
    const enter = async () => navigate(await afterEntry(`/t/${tripId}/${parseJoinTarget(location.search) ?? 'overview?joined=1'}`), { replace: true })
    const claimed = () => useDevice.getState().trips[tripId]?.memberId === memberId
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<'late'>((resolve) => { timer = setTimeout(() => resolve('late'), WHO_DEADLINE_MS) })
    try {
      const outcome = await Promise.race([fn(controller.signal).then(() => 'done' as const), deadline])
      if (mine !== attempt.current) return
      if (outcome === 'late') {
        controller.abort()
        // Already this person on the phone, still downloading: go in; sync finishes the rest.
        if (claimed()) return void (await enter())
        attempt.current++
        setError(STOPPED_WAITING)
        setBusy(false)
        return
      }
      await enter()
    } catch (e) {
      if (mine !== attempt.current) return
      // A request timeout can beat the screen's own deadline; either way nothing changed on this phone,
      // so people see the same plain message rather than "signal timed out" or "AbortError".
      const stalled = e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError' || /timed out|abort/i.test(e.message))
      setError(stalled ? STOPPED_WAITING : e instanceof Error ? e.message : String(e))
      setBusy(false)
    } finally {
      clearTimeout(timer)
    }
  }

  if (!trip || !members) return <LoadingState fullScreen title="Finding your group…" />
  const destinations = tripAreas(trip).map((area) => area.name).join(' · ')
  const dateLabel = (value: string) => DateTime.fromISO(value).toLocaleString(DateTime.DATE_MED)
  const dates = trip.start_date
    ? `${dateLabel(trip.start_date)}${trip.end_date ? ` – ${dateLabel(trip.end_date)}` : ''}`
    : trip.end_date ? `Until ${dateLabel(trip.end_date)}` : 'Dates to be decided together'
  return (
    <main className="mx-auto max-w-md px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <Link to="/" aria-label="Stowaway home" className="inline-flex min-h-11 items-center"><Brand /></Link>
      <header className="mt-8 border-b border-ink/15 pb-6">
        <div className="mb-3 flex items-center gap-3"><Stowie mood="listening" size={48} /><p className="text-sm font-medium text-action">You’re invited</p></div>
        <h1 className="travel-heading break-words text-4xl text-ink">{trip.name}</h1>
        {destinations && <p className="mt-3 break-words font-medium text-action">{destinations}</p>}
        <p className="mt-2 text-sm text-muted">{dates}</p>
      </header>
      <h2 className="mt-6 text-xl font-semibold text-ink">Who are you?</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{members.length ? 'Choose your name, or add yourself below.' : 'Add your name to get started.'} We’ll remember you on this device.</p>

      <div className="mt-5 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        {members.map((m) => (
          <button
            key={m.id}
            disabled={busy}
            onClick={() => run(m.id, (signal) => claimMember(tripId, m.id, signal))}
            className="flex items-center gap-2 rounded-surface border border-line bg-surface p-3 text-left active:bg-brand-50 disabled:opacity-50"
          >
            <Avatar name={m.display_name} color={m.color} photo={m.avatar_url} size="sm" />
            <span className="min-w-0 break-words font-medium">{m.display_name}</span>
          </button>
        ))}
      </div>

      <Card className="mt-5">
        <h2 className="ui-section-title">{members.length ? 'Not on the list?' : 'What should we call you?'}</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newName.trim()) return
            const color = MEMBER_COLORS[members.length % MEMBER_COLORS.length]!
            const name = newName.trim()
            if (pendingNew.current?.name !== name) pendingNew.current = { name, id: newId() }
            const id = pendingNew.current.id
            void run(id, (signal) => createMemberAndClaim(tripId, name, color, { memberId: id, signal }))
          }}
        >
          <label htmlFor="join-name" className="sr-only">Your name</label>
          <Input id="join-name" autoComplete="given-name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} placeholder="Your name" className="min-w-0 flex-1" />
          <Button type="submit" disabled={busy || !newName.trim()}>
            Add me
          </Button>
        </form>
      </Card>
      <div className="mt-3">
        {busy && <p role="status" className="mb-2 text-sm text-muted">{slow ? 'The connection is taking longer than usual. Your name stays here; if it cannot finish, you can retry.' : 'Connecting you to the group…'}</p>}
        <ErrorNote error={error} />
      </div>
    </main>
  )
}
