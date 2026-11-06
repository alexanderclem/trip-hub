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
  { path: 'plan/new', label: 'Add to plan', detail: 'Flights, meals, and activities', Icon: CalendarPlus, cap: 'plan' },
  { path: 'more/places/new', label: 'Save a place', detail: 'Somewhere to visit', Icon: MapPin, cap: 'plan' },
  { path: 'money/new', label: 'Add an expense', detail: 'A cost shared with the group', Icon: Wallet, cap: 'participate' },
  { path: 'tickets/new', label: 'Add a ticket', detail: 'A booking, pass, or document', Icon: Ticket, cap: 'participate' },
] as const

/** A normal link list in a native modal: keyboard, Escape, and restored focus come for free. */
export function QuickAdd({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false)
  const trip = useTrip(tripId)
  const access = useTripAccess(tripId)
  const allowed = actions.filter((a) => can(access, a.cap))
  const { pathname, search } = useLocation()
  const screen = pathname.slice(`/t/${tripId}/`.length)
  const contextualAdd = allowed.some(({ path }) => screen === path.replace('/new', ''))
    || (can(access, 'plan') && ['more/tasks', 'more/packing', 'more/vote'].includes(screen))
  const editing = /(?:^|\/)(?:new|edit)$/.test(screen) || /^money\/[^/]+$/.test(screen) || /^more\/(?:tasks|packing)\/[^/]+$/.test(screen)
  const selectedDay = new URLSearchParams(search).get('day')
  const today = DateTime.now().setZone(trip?.timezone ?? 'UTC').toISODate()!
  const day = selectedDay && /^\d{4}-\d{2}-\d{2}$/.test(selectedDay) && DateTime.fromISO(selectedDay).isValid
    ? selectedDay : trip?.start_date && today < trip.start_date ? trip.start_date : today
  if (!allowed.length || editing) return null
  return <>
    <Button variant="secondary" className={`quick-add-trigger${contextualAdd ? ' quick-add-contextual' : ''}`} aria-haspopup="dialog" onClick={() => setOpen(true)}><Plus aria-hidden="true" className="size-4" /><span>Add</span></Button>
    <Dialog open={open} onClose={() => setOpen(false)} title="Add to your trip" sheet>
      <nav aria-label="Add to your trip" className="quick-add-list">{allowed.map(({ path, label, detail, Icon }) => <Link key={path} to={`/t/${tripId}/${path}${path === 'plan/new' ? `?day=${day}` : ''}`} onClick={() => setOpen(false)}>
        <span className="quick-add-icon"><Icon aria-hidden="true" className="size-5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span><span className="mt-1 block text-sm leading-relaxed text-muted">{detail}</span></span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
      </Link>)}</nav>
    </Dialog>
  </>
}
