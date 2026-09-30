import { Link } from 'react-router'
import { ChevronRight, ExternalLink, Plus, X } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { save } from '@/data/repo'
import type { Place } from '@/data/types'
import { formatDistance, googleMapsUrl, haversineM, type LatLng } from '@/lib/geo'
import { Button } from '@/ui'
import { CATEGORY_STYLE, STATUS_LABEL } from '@/features/places/categories'

export function PlaceSheet({ place, me, onClose }: { place: Place; me: LatLng | null; onClose: () => void }) {
  const memberId = useMyMemberId(place.trip_id)
  const { Icon, color, label } = CATEGORY_STYLE[place.category]
  const at = place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null
  const distance = me && at ? haversineM(me, at) : null

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: color }}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{place.name}</h2>
          <p className="text-sm text-stone-500">
            {[label, place.area, STATUS_LABEL[place.status]].filter(Boolean).join(' · ')}
          </p>
          {distance != null && (
            <p className="mt-0.5 text-sm text-stone-700">
              {formatDistance(distance)} away <span className="text-stone-400">(straight line)</span>
            </p>
          )}
        </div>
      </div>
      {place.notes && <p className="mt-3 line-clamp-3 text-sm whitespace-pre-wrap text-stone-700">{place.notes}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
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
      <div className="relative mx-auto max-w-md rounded-3xl bg-white p-4 shadow-xl ring-1 ring-black/5">
        <button onClick={onClose} className="absolute top-3 right-3 rounded-full p-1.5 text-stone-400 active:bg-stone-100" aria-label="Close">
          <X className="size-5" />
        </button>
        {children}
      </div>
    </div>
  )
}
