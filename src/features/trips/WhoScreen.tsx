import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMembers, useTrip } from '@/data/hooks'
import { Avatar, Button, Card, ErrorNote, Input } from '@/ui'
import { claimMember, createMemberAndClaim, MEMBER_COLORS } from './actions'

/** "Who are you?" — ties this device to a person on the trip. */
export function WhoScreen() {
  const { tripId } = useParams() as { tripId: string }
  const navigate = useNavigate()
  const trip = useTrip(tripId)
  const members = useMembers(tripId) ?? []
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      navigate(`/t/${tripId}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="pt-safe mx-auto max-w-md p-5">
      <p className="mt-4 text-sm text-stone-500">{trip?.name}</p>
      <h1 className="text-2xl font-bold">Who are you?</h1>
      <p className="mt-1 text-sm text-stone-500">This is remembered on this device.</p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {members.map((m) => (
          <button
            key={m.id}
            disabled={busy}
            onClick={() => run(() => claimMember(tripId, m.id))}
            className="flex items-center gap-2 rounded-2xl bg-white p-3 text-left shadow-sm active:bg-stone-50 disabled:opacity-50"
          >
            <Avatar name={m.display_name} color={m.color} />
            <span className="truncate font-medium">{m.display_name}</span>
          </button>
        ))}
      </div>

      <Card className="mt-5">
        <h2 className="font-semibold">Not on the list?</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newName.trim()) return
            const color = MEMBER_COLORS[members.length % MEMBER_COLORS.length]!
            void run(() => createMemberAndClaim(tripId, newName, color))
          }}
        >
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} placeholder="Your name" className="min-w-0 flex-1" />
          <Button type="submit" disabled={busy || !newName.trim()}>
            Add me
          </Button>
        </form>
      </Card>
      <div className="mt-3">
        <ErrorNote error={error} />
      </div>
    </div>
  )
}
