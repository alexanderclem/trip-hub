import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, ClipboardPaste, Plus } from 'lucide-react'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import { Button, Card, ErrorNote, Input } from '@/ui'
import { parseShareToken } from './actions'

export function HomeScreen() {
  const navigate = useNavigate()
  const joined = useDevice((s) => s.trips)
  const trips = useLiveQuery(() => db.trips.bulkGet(Object.keys(joined)), [joined]) ?? []
  const [link, setLink] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function pasteFromClipboard() {
    try {
      setLink(await navigator.clipboard.readText())
    } catch {
      setError('Could not read the clipboard. Long-press the box and choose Paste.')
    }
  }

  function join() {
    const token = parseShareToken(link)
    if (!token) return setError("That doesn't look like a trip link.")
    navigate(`/join#t=${token}`)
  }

  return (
    <div className="pt-safe mx-auto max-w-md p-5">
      <h1 className="mt-4 text-3xl font-bold text-brand-700">Trip Hub</h1>
      <p className="mt-1 text-stone-600">Your group's trips, all in one place.</p>

      {trips.some(Boolean) && (
        <section className="mt-6 space-y-2">
          {trips.filter((t) => t && !t.deleted_at).map((t) => (
            <Link
              key={t!.id}
              to={`/t/${t!.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm active:bg-stone-50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{t!.name}</div>
                {t!.start_date && (
                  <div className="text-sm text-stone-500">
                    {t!.start_date} → {t!.end_date}
                  </div>
                )}
              </div>
              <ChevronRight className="size-5 text-stone-400" />
            </Link>
          ))}
        </section>
      )}

      <Card className="mt-6">
        <h2 className="font-semibold">Join a trip</h2>
        <p className="mt-1 text-sm text-stone-500">Paste the trip link someone shared with you.</p>
        <div className="mt-3 flex gap-2">
          <Input
            value={link}
            onChange={(e) => {
              setLink(e.target.value)
              setError(null)
            }}
            placeholder="https://…/join#t=…"
            className="min-w-0 flex-1"
          />
          <Button variant="secondary" onClick={pasteFromClipboard} aria-label="Paste from clipboard" className="px-3">
            <ClipboardPaste className="size-5" />
          </Button>
        </div>
        <div className="mt-3 space-y-3">
          <ErrorNote error={error} />
          <Button className="w-full" disabled={!link.trim()} onClick={join}>
            Join
          </Button>
        </div>
      </Card>

      <Link
        to="/new"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 py-4 text-stone-600 active:bg-stone-100"
      >
        <Plus className="size-5" /> Create a trip
      </Link>
    </div>
  )
}
