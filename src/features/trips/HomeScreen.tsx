import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, CalendarDays, ClipboardPaste, Compass, Link2, Plus } from 'lucide-react'
import { DateTime } from 'luxon'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import type { Trip } from '@/data/types'
import { Button, Card, Input } from '@/ui'
import { Brand } from '@/ui/Brand'
import { CardDescription, CardHeader, CardTitle, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Skeleton } from '@/ui/collection'
import { AccountCard } from '@/features/account/AccountCard'
import { parseShareToken } from './actions'

function dateLabel(value: string) {
  const date = DateTime.fromISO(value)
  return date.isValid ? date.toLocaleString(DateTime.DATE_MED) : value
}

function TripCard({ trip }: { trip: Trip }) {
  const dates = trip.start_date
    ? `${dateLabel(trip.start_date)}${trip.end_date ? ` – ${dateLabel(trip.end_date)}` : ''}`
    : trip.end_date ? `Until ${dateLabel(trip.end_date)}` : 'Dates to be decided'
  return (
    <Link to={`/t/${trip.id}`} className="group block rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-600 active:bg-brand-50">
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Compass aria-hidden="true" className="size-5" /></span>
        <ArrowRight aria-hidden="true" className="mt-2 size-5 shrink-0 text-stone-400 group-hover:text-brand-700" />
      </div>
      <h3 className="mt-5 break-words text-xl font-semibold tracking-tight group-hover:text-brand-700">{trip.name}</h3>
      <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-stone-600"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{dates}</p>
      <div className="mt-5 border-t border-stone-100 pt-3 text-sm font-medium text-brand-700">Open trip</div>
    </Link>
  )
}

export function HomeScreen() {
  const navigate = useNavigate()
  const joined = useDevice((s) => s.trips)
  const trips = useLiveQuery(() => db.trips.bulkGet(Object.keys(joined)), [joined])
  const visibleTrips = trips?.filter((t): t is NonNullable<typeof t> => !!t && !t.deleted_at) ?? []
  const [link, setLink] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [pasting, setPasting] = useState(false)

  async function pasteFromClipboard() {
    setPasting(true)
    try {
      setLink(await navigator.clipboard.readText())
      setError(null)
      setInvalid(false)
    } catch {
      setError('Could not read the clipboard. Paste the trip link into the box below.')
    } finally {
      setPasting(false)
    }
  }

  function join(event: FormEvent) {
    event.preventDefault()
    const token = parseShareToken(link.trim())
    if (!token) {
      setInvalid(true)
      setError("That doesn't look like a trip link. Copy the full link and try again.")
      return
    }
    navigate(`/join#t=${token}`)
  }

  return (
    <main className="mx-auto max-w-5xl px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-8 sm:pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-900/15 pb-5">
        <Brand />
        <span className="text-xs tracking-wide text-brand-700">Good company. Great trips.</span>
      </header>
      <div className="mb-8 mt-8 flex flex-wrap items-end justify-between gap-5 sm:mt-12">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">A little planning. A lot of possibility.</p>
          <h1 className="travel-heading text-5xl text-brand-900 sm:text-6xl">Your trips, all aboard.</h1>
          <p className="mt-4 max-w-md leading-relaxed text-stone-600">The whole trip, tucked away. Keep your group’s plans, places, and tickets together, wherever you go.</p>
        </div>
        <Link to="/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-brand-900 active:bg-brand-900"><Plus aria-hidden="true" className="size-4" />Create a trip</Link>
      </div>

      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="saved-trips" aria-busy={trips === undefined}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="saved-trips" className="text-sm font-semibold text-stone-700">Saved on this device</h2>
            {trips !== undefined && <span className="text-xs tabular-nums text-stone-500">{visibleTrips.length} {visibleTrips.length === 1 ? 'trip' : 'trips'}</span>}
          </div>
          {trips === undefined ? (
            <div role="status">
              <span className="sr-only">Loading your trips…</span>
              <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                {[0, 1].map((key) => <Card key={key}><Skeleton className="size-10" /><Skeleton className="mt-5 h-6 w-3/4" /><Skeleton className="mt-3 h-4 w-1/2" /><Skeleton className="mt-6 h-5 w-20" /></Card>)}
              </div>
            </div>
          ) : visibleTrips.length ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">{visibleTrips.map((trip) => <TripCard key={trip.id} trip={trip} />)}</div>
          ) : (
            <Empty className="border-brand-900/20 bg-white/50">
              <img src="/brand/packed-for-anywhere.svg" alt="" width="360" height="170" className="w-64 max-w-full" />
              <EmptyHeader><EmptyTitle>Room for your next adventure</EmptyTitle><EmptyDescription>Create a trip for your favorite people, or hop aboard with an invite. We’ll keep the details here.</EmptyDescription></EmptyHeader>
            </Empty>
          )}
        </section>

        <div className="space-y-6">
        <Card>
          <CardHeader>
            <Link2 aria-hidden="true" className="mb-2 size-5 text-brand-700" />
            <CardTitle>Have an invite?</CardTitle>
            <CardDescription>Paste the link your group shared to join their trip.</CardDescription>
          </CardHeader>
          <form onSubmit={join} className="mt-5">
            <label htmlFor="trip-link" className="text-sm font-medium text-stone-700">Trip link</label>
            <div className="mt-2 flex gap-2">
              <Input id="trip-link" value={link} onChange={(e) => { setLink(e.target.value); setError(null); setInvalid(false) }} placeholder="https://…/join#t=…" className="min-w-0 flex-1" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={invalid} aria-describedby={error ? 'trip-link-error' : undefined} />
              <Button type="button" variant="secondary" onClick={pasteFromClipboard} disabled={pasting} aria-label="Paste from clipboard" className="px-3"><ClipboardPaste aria-hidden="true" className="size-5" /></Button>
            </div>
            {error && <p id="trip-link-error" role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            <Button type="submit" className="mt-4 w-full" disabled={!link.trim()}>Join trip<ArrowRight aria-hidden="true" className="size-4" /></Button>
          </form>
        </Card>
        <AccountCard />
        </div>
      </div>
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-brand-900/15 pt-5 text-xs text-stone-600">
        <span>Made for the way you go together.</span>
        <span className="tracking-wide">joinstowaway.app</span>
      </footer>
    </main>
  )
}
