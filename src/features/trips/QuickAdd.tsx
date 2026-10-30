import { useState } from 'react'
import { useTripAccess } from '@/data/device'
import { can } from '@/data/access'
import { Link, useLocation } from 'react-router'
import { CalendarPlus, ChevronRight, MapPin, Plus, Ticket, Wallet } from 'lucide-react'
import { DateTime } from 'luxon'
import { Dialog } from '@/ui/Dialog'
import { Button } from '@/ui'
import { useTrip } from '@/data/hooks'

// Planning needs 'plan'; an expense or a ticket of your own needs 'participate' (src/data/access.ts).
const actions = [
  { path: 'plan/new', label: 'Add to plan', detail: 'A meal, a flight, a little adventure.', Icon: CalendarPlus, cap: 'plan' },
  { path: 'more/places/new', label: 'Save a place', detail: 'Somewhere worth going together.', Icon: MapPin, cap: 'plan' },
  { path: 'money/new', label: 'Add an expense', detail: 'Keep the shared costs together.', Icon: Wallet, cap: 'participate' },
  { path: 'tickets/new', label: 'Add a ticket', detail: 'A booking, pass, or document.', Icon: Ticket, cap: 'participate' },
] as const

/** A normal link list in a native modal: keyboard, Escape, and restored focus come for free. */
export function QuickAdd({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false)
  const trip = useTrip(tripId)
  const access = useTripAccess(tripId)
  const allowed = actions.filter((a) => can(access, a.cap))
  const { search } = useLocation()
  const selectedDay = new URLSearchParams(search).get('day')
  const today = DateTime.now().setZone(trip?.timezone ?? 'UTC').toISODate()!
  const day = selectedDay && /^\d{4}-\d{2}-\d{2}$/.test(selectedDay) && DateTime.fromISO(selectedDay).isValid
    ? selectedDay : trip?.start_date && today < trip.start_date ? trip.start_date : today
  if (!allowed.length) return null
  return <>
    <Button variant="secondary" className="quick-add-trigger" aria-haspopup="dialog" onClick={() => setOpen(true)}><Plus aria-hidden="true" className="size-4" /><span>Add</span></Button>
    <Dialog open={open} onClose={() => setOpen(false)} title="Something for the trip?">
      <p className="mb-4 text-sm text-muted">Keep it all in one place.</p>
      <nav aria-label="Add to your trip" className="quick-add-list">{allowed.map(({ path, label, detail, Icon }) => <Link key={path} to={`/t/${tripId}/${path}${path === 'plan/new' ? `?day=${day}` : ''}`} onClick={() => setOpen(false)}>
        <span className="quick-add-icon"><Icon aria-hidden="true" className="size-5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span><span className="mt-1 block text-sm leading-relaxed text-muted">{detail}</span></span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
      </Link>)}</nav>
    </Dialog>
  </>
}
