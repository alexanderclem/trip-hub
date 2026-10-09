import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarPlus, ChevronDown, Lightbulb, Plus, X } from 'lucide-react'
import { save } from '@/data/repo'
import type { Place } from '@/data/types'
import { PlaceCategoryIcon, placeActionClass } from '@/features/places/PlaceSummary'
import { Card, ErrorNote } from '@/ui'
import { SLOTS, slotLabel, type Suggestion } from './rank'

/**
 * Places from the trip's idea pool for the parts of a day nobody has planned yet. Nothing is added
 * until someone taps: to the plan (through the usual form), to the shortlist, or out of the pool.
 * It sits above the timeline, so it starts closed and the day itself stays in view.
 */
export function SuggestionsCard({ tripId, day, suggestions, me }: { tripId: string; day: string; suggestions: Suggestion[]; me: string | null }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!suggestions.length) return null

  async function mark(place: Place, status: 'shortlist' | 'rejected') {
    setBusy(place.id)
    setError(null)
    try {
      await save('places', { ...place, status }, me)
    } catch {
      setError(`Could not update ${place.name}. Please try again.`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-brand-900">
        <button aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-11 w-full items-center gap-2 text-left">
          <Lightbulb aria-hidden="true" className="size-5 shrink-0" />
          <span className="flex-1">Ideas for this day</span>
          <span className="text-sm font-normal text-stone-600">{suggestions.length}</span>
          <ChevronDown aria-hidden="true" className={`size-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h2>
      {open && <p className="mt-1 text-sm text-stone-600">Picked from your idea pool for the time that’s still free. Nothing is added until you say so.</p>}
      {open && <div className="mt-2"><ErrorNote error={error} /></div>}
      {open && SLOTS.filter((slot) => suggestions.some((s) => s.slot === slot)).map((slot) => (
        <section key={slot} aria-label={slotLabel(slot)} className="mt-4">
          <h3 className="text-sm font-semibold text-stone-700">{slotLabel(slot)}</h3>
          <ul className="mt-1 divide-y divide-stone-200">
            {suggestions.filter((s) => s.slot === slot).map(({ place, reasons, startTime }) => (
              <li key={place.id} className="py-3">
                <Link to={`/t/${tripId}/more/places/${place.id}`} className="flex min-h-11 items-start gap-3 rounded-lg hover:bg-brand-50">
                  <PlaceCategoryIcon category={place.category} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium break-words text-stone-900">{place.name}</span>
                    {reasons.length > 0 && <span className="block text-sm text-stone-600">{reasons.join(' · ')}</span>}
                  </span>
                </Link>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link to={`/t/${tripId}/plan/new?day=${day}&place=${place.id}&time=${startTime}`} aria-label={`Add to plan: ${place.name}`} className={placeActionClass}>
                    <CalendarPlus aria-hidden="true" className="size-4" />Add to plan
                  </Link>
                  {place.status === 'catalog' && (
                    <button disabled={busy === place.id} onClick={() => void mark(place, 'shortlist')} aria-label={`Shortlist: ${place.name}`} className={placeActionClass}>
                      <Plus aria-hidden="true" className="size-4" />Shortlist
                    </button>
                  )}
                  <button disabled={busy === place.id} onClick={() => void mark(place, 'rejected')} aria-label={`Not for us: ${place.name}`} className={placeActionClass}>
                    <X aria-hidden="true" className="size-4" />Not for us
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Card>
  )
}
