import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { CalendarPlus, ChevronRight, Globe, MapPin, Navigation, Plus, Ruler, Ticket, X } from 'lucide-react'
import { useLinks } from '@/data/hooks'
import { useMyMemberId } from '@/data/device'
import { save } from '@/data/repo'
import type { Place } from '@/data/types'
import { googleMapsUrl } from '@/lib/geo'
import { Button, ErrorNote } from '@/ui'
import { CATEGORY_STYLE } from '@/features/places/categories'
import { PlaceCategoryIcon, PlaceStatusBadge, placeActionClass, webLink } from '@/features/places/PlaceSummary'
import { travelOptions, type LegContext } from '@/features/routing/legs'
import { ReportTimeForm, TravelOptionsList } from '@/features/routing/TravelOptionsList'
import { usePlaceRatings } from '@/features/polls/data'
import { summarizeRatings } from '@/features/polls/rank'
import { StarsSummary } from '@/features/ratings/Stars'

export const ME_ID = 'me'

export interface OriginChoice {
  place: Place // for "you", a stand-in place at your location with id ME_ID
  label: string
}

interface Props {
  place: Place
  origins: OriginChoice[]
  origin: Place | null
  onOrigin: (id: string) => void
  onMeasure: () => void
  legCtx: LegContext | undefined
  onClose: () => void
}

export function PlaceSheet({ place, origins, origin, onOrigin, onMeasure, legCtx, onClose }: Props) {
  const memberId = useMyMemberId(place.trip_id)
  const [reporting, setReporting] = useState(false)
  const { label } = CATEGORY_STYLE[place.category]
  const links = useLinks(place.id) ?? []
  const rating = summarizeRatings(usePlaceRatings(place.id) ?? [])
  const booking = links.find((link) => link.kind === 'booking' && webLink(link.url))
  const website = webLink(place.website)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const at = place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null
  const options = origin && legCtx && origin.id !== place.id ? travelOptions(origin, place, legCtx) : []
  const choices = origins.filter((o) => o.place.id !== place.id)

  async function shortlist() {
    setSaving(true)
    setError(null)
    try {
      await save('places', { ...place, status: 'shortlist' }, memberId)
    } catch {
      setError('Could not shortlist this place. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet onClose={onClose} label={place.name}>
      <div className="flex items-start gap-3 pr-10">
        <PlaceCategoryIcon category={place.category} />
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-medium text-stone-500">{[label, place.area].filter(Boolean).join(' · ')}</p>
          <h2 className="break-words text-xl font-semibold leading-snug tracking-tight">{place.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2"><PlaceStatusBadge status={place.status} /><StarsSummary summary={rating} /></div>
        </div>
      </div>
      {place.address && <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-stone-600"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 break-words">{place.address}</span></p>}
      {place.notes && !reporting && <p className="mt-3 line-clamp-3 break-words text-sm leading-relaxed whitespace-pre-wrap text-stone-700">{place.notes}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={googleMapsUrl(place.name, place.area, at)} target="_blank" rel="noreferrer" className={placeActionClass}><Navigation aria-hidden="true" className="size-4" />Google Maps<span className="sr-only"> (opens in a new tab)</span></a>
        {booking && <a href={webLink(booking.url)!} target="_blank" rel="noreferrer" className={placeActionClass}><Ticket aria-hidden="true" className="size-4" />Booking<span className="sr-only"> (opens in a new tab)</span></a>}
        {website && <a href={website} target="_blank" rel="noreferrer" className={placeActionClass}><Globe aria-hidden="true" className="size-4" />Website<span className="sr-only"> (opens in a new tab)</span></a>}
      </div>
      {!at && <p className="mt-2 text-xs text-amber-800">No map pin yet. Google Maps will search by name.</p>}

      {at && (choices.length > 0 || origin) && (
        <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-3">
          <h3 className="mb-2 text-sm font-semibold text-stone-700">Getting there</h3>
          <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1">
            {choices.map((c) => (
              <button
                key={c.place.id}
                onClick={() => { setReporting(false); onOrigin(c.place.id) }}
                aria-pressed={origin?.id === c.place.id}
                className={`min-h-11 shrink-0 rounded-xl px-3 py-2 text-sm ${origin?.id === c.place.id ? 'bg-brand-700 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}
              >
                From {c.label}
              </button>
            ))}
            <button onClick={onMeasure} className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
              <Ruler aria-hidden="true" className="size-3.5" /> Measure from here
            </button>
          </div>
          {origin && origin.id !== place.id && <TravelOptionsList options={options} />}
          {origin && origin.id !== place.id && origin.id !== ME_ID && !reporting && (
            <button onClick={() => setReporting(true)} className="mt-1 min-h-11 text-sm text-brand-700 underline underline-offset-4">
              Report the actual time
            </button>
          )}
          {reporting && origin && (
            <div className="mt-2">
              <ReportTimeForm from={origin} to={place} onDone={() => setReporting(false)} />
            </div>
          )}
        </div>
      )}

      <div className="sticky -bottom-4 -mx-4 -mb-4 mt-4 border-t border-stone-200 bg-white px-4 pt-3 pb-4 sm:-bottom-5 sm:-mx-5 sm:-mb-5 sm:px-5 sm:pb-5">
        <ErrorNote error={error} />
        <div className="mt-2 flex flex-wrap gap-2">
          {place.status === 'catalog' && <Button disabled={saving} onClick={shortlist} className="flex-1"><Plus aria-hidden="true" className="size-4" />{saving ? 'Saving…' : 'Shortlist'}</Button>}
          {place.status !== 'catalog' && <Link to={`/t/${place.trip_id}/plan/new?place=${place.id}`} className={`${placeActionClass} flex-1`}><CalendarPlus aria-hidden="true" className="size-4" />Add to plan</Link>}
          <Link to={`/t/${place.trip_id}/more/places/${place.id}`} className={`${placeActionClass} flex-1`}>Details<ChevronRight aria-hidden="true" className="size-4" /></Link>
        </div>
      </div>
    </Sheet>
  )
}

/** Nonmodal: the map and its controls remain available behind the sheet. */
export function Sheet({ children, onClose, label = 'Map selection' }: { children: React.ReactNode; onClose: () => void; label?: string }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus({ preventScroll: true })
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 p-3">
      <div role="dialog" aria-label={label} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }} className="pointer-events-auto relative mx-auto max-h-[70dvh] max-w-lg overflow-y-auto overscroll-contain rounded-3xl border border-stone-200 bg-white p-4 shadow-xl sm:p-5">
        <button ref={closeRef} onClick={onClose} className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200" aria-label="Close">
          <X aria-hidden="true" className="size-5" />
        </button>
        {children}
      </div>
    </div>
  )
}
