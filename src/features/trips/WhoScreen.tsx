import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DateTime } from 'luxon'
import { useMembers, useTrip } from '@/data/hooks'
import { Avatar, Button, Card, ErrorNote, Input } from '@/ui'
import { claimMember, createMemberAndClaim, MEMBER_COLORS, parseJoinTarget } from './actions'
import { LoadingState } from '@/ui/LoadingState'
import { afterEntry } from '@/features/onboarding/profile'
import { Brand } from '@/ui/Brand'
import { Stowie } from '@/features/stowie/Stowie'
import { tripAreas } from '@/features/destinations/destinations'

/** "Who are you?" — ties this device to a person on the trip. */
export function WhoScreen() {
  const { tripId } = useParams() as { tripId: string }
  const navigate = useNavigate()
  const trip = useTrip(tripId)
  const members = useMembers(tripId)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      navigate(await afterEntry(`/t/${tripId}/${parseJoinTarget(location.search) ?? 'overview?joined=1'}`), { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (!trip || !members) return <LoadingState fullScreen title="Finding your group…" description="Loading the travelers already on this trip." />
  const destinations = tripAreas(trip).map((area) => area.name).join(' · ')
  const dateLabel = (value: string) => DateTime.fromISO(value).toLocaleString(DateTime.DATE_MED)
  const dates = trip.start_date
    ? `${dateLabel(trip.start_date)}${trip.end_date ? ` – ${dateLabel(trip.end_date)}` : ''}`
    : trip.end_date ? `Until ${dateLabel(trip.end_date)}` : 'Dates to be decided together'
  return (
    <main className="mx-auto max-w-md px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <Link to="/" aria-label="Stowaway home" className="inline-flex min-h-11 items-center"><Brand /></Link>
      <header className="mt-8 border-b border-brand-900/15 pb-6">
        <div className="mb-3 flex items-center gap-3"><Stowie mood="listening" size={48} /><p className="text-sm font-medium text-brand-700">You’re invited</p></div>
        <h1 className="travel-heading break-words text-4xl text-brand-900">{trip.name}</h1>
        {destinations && <p className="mt-3 break-words font-medium text-brand-700">{destinations}</p>}
        <p className="mt-2 text-sm text-stone-600">{dates}</p>
        <p className="mt-4 text-sm leading-relaxed text-stone-600">Your friends have made room for you. Help pick the places, have your say, and keep the plans together.</p>
      </header>
      <h2 className="mt-6 text-xl font-semibold text-brand-900">Who are you?</h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{members.length ? 'Here’s who’s coming. Choose your name, or add yourself below.' : 'Be the first to add your name. The rest of the group can join you here.'} We’ll remember you on this device.</p>

      <div className="mt-5 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        {members.map((m) => (
          <button
            key={m.id}
            disabled={busy}
            onClick={() => run(() => claimMember(tripId, m.id))}
            className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-surface p-3 text-left active:bg-stone-50 disabled:opacity-50"
          >
            <Avatar name={m.display_name} color={m.color} photo={m.avatar_url} size="sm" />
            <span className="min-w-0 break-words font-medium">{m.display_name}</span>
          </button>
        ))}
      </div>

      <Card className="mt-5">
        <h2 className="font-semibold">{members.length ? 'Not on the list?' : 'What should we call you?'}</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newName.trim()) return
            const color = MEMBER_COLORS[members.length % MEMBER_COLORS.length]!
            void run(() => createMemberAndClaim(tripId, newName, color))
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
        {busy && <p role="status" className="mb-2 text-sm text-stone-600">Connecting you to the group…</p>}
        <ErrorNote error={error} />
      </div>
    </main>
  )
}
