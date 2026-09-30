import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, ExternalLink, Plus, Ruler, X } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { save } from '@/data/repo'
import type { Place } from '@/data/types'
import { googleMapsUrl } from '@/lib/geo'
import { Button } from '@/ui'
import { CATEGORY_STYLE, STATUS_LABEL } from '@/features/places/categories'
import { travelOptions, type LegContext } from '@/features/routing/legs'
import { ReportTimeForm, TravelOptionsList } from '@/features/routing/TravelOptionsList'

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
  const { Icon, color, label } = CATEGORY_STYLE[place.category]
  const at = place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null
  const options = origin && legCtx && origin.id !== place.id ? travelOptions(origin, place, legCtx) : []
  const choices = origins.filter((o) => o.place.id !== place.id)

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-start gap-3 pr-8">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: color }}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{place.name}</h2>
          <p className="text-sm text-stone-500">{[label, place.area, STATUS_LABEL[place.status]].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      {at && (choices.length > 0 || origin) && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1">
            {choices.map((c) => (
              <button
                key={c.place.id}
                onClick={() => onOrigin(c.place.id)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${origin?.id === c.place.id ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-700'}`}
              >
                From {c.label}
              </button>
            ))}
            <button onClick={onMeasure} className="flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700">
              <Ruler className="size-3.5" /> Measure from here
            </button>
          </div>
          {origin && origin.id !== place.id && <TravelOptionsList options={options} />}
          {origin && origin.id !== place.id && origin.id !== ME_ID && !reporting && (
            <button onClick={() => setReporting(true)} className="mt-1 text-xs text-brand-700 underline">
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

      {place.notes && !reporting && <p className="mt-3 line-clamp-2 text-sm whitespace-pre-wrap text-stone-700">{place.notes}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {place.status === 'catalog' ? (
          <Button className="flex items-center justify-center gap-1" onClick={() => save('places', { ...place, status: 'shortlist' }, memberId)}>
            <Plus className="size-4" /> Shortlist
          </Button>
        ) : (
          <a href={googleMapsUrl(place.name, place.area, at)} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="flex w-full items-center justify-center gap-1">
              <ExternalLink className="size-4" /> Google Maps
            </Button>
          </a>
        )}
        <Link to={`../more/places/${place.id}`}>
          <Button variant="secondary" className="flex w-full items-center justify-center gap-1">
            Details <ChevronRight className="size-4" />
          </Button>
        </Link>
      </div>
    </Sheet>
  )
}

export function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-6 z-20 p-3">
      <div className="relative mx-auto max-h-[70vh] max-w-md overflow-y-auto rounded-3xl bg-white p-4 shadow-xl ring-1 ring-black/5">
        <button onClick={onClose} className="absolute top-3 right-3 rounded-full p-1.5 text-stone-400 active:bg-stone-100" aria-label="Close">
          <X className="size-5" />
        </button>
        {children}
      </div>
    </div>
  )
}
