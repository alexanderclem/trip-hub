import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useDevice } from '@/data/device'
import { useTrip } from '@/data/hooks'
import { Brand } from '@/ui/Brand'
import { Button } from '@/ui'
import { Stowie } from '@/features/stowie/Stowie'

/** The same frame as "Who are you?", for a trip this phone can't open yet or any more. */
function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <Link to="/" aria-label="Stowaway home" className="inline-flex min-h-11 items-center"><Brand /></Link>
      <header className="mt-8">
        <Stowie mood="listening" size={48} />
        <h1 className="travel-heading mt-3 break-words text-3xl text-ink">{title}</h1>
      </header>
      {children}
    </main>
  )
}

/** Shown when an organizer removed this phone's person. The trip's data has already left the phone. */
export function RemovedScreen({ tripId }: { tripId: string }) {
  const navigate = useNavigate()
  const forgetTrip = useDevice((s) => s.forgetTrip)
  return (
    <Frame title="You were removed from this trip">
      <p className="mt-2 text-sm text-muted">Its plans, documents and expenses are no longer on this phone. If you think this is a mistake, ask the trip’s organizer.</p>
      <Button className="mt-4 w-full" onClick={() => { forgetTrip(tripId); navigate('/app', { replace: true }) }}>Back to my trips</Button>
    </Frame>
  )
}

/** Shown while a hosted trip's organizer hasn't let this person in yet. Sync keeps checking. */
export function PendingScreen({ tripId }: { tripId: string }) {
  const trip = useTrip(tripId)
  const navigate = useNavigate()
  return (
    <Frame title={trip ? `Waiting to join ${trip.name}` : 'Waiting to join'}>
      <p className="mt-2 text-sm text-muted">The organizer will let you in. This page opens the trip by itself once they do, so you can leave it open or come back later.</p>
      <Button variant="secondary" className="mt-4 w-full" onClick={() => navigate('/app')}>Back to my trips</Button>
    </Frame>
  )
}
