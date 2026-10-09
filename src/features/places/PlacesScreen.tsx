import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowUpRight, MapPin, Navigation, Plus, Search } from 'lucide-react'
import { usePlaces } from '@/data/hooks'
import { PLACE_CATEGORIES, type PlaceCategory } from '@/data/types'
import { Input, PageHeader } from '@/ui'
import { CATEGORY_STYLE } from './categories'
import { googleMapsUrl } from '@/lib/geo'
import { PlaceCategoryIcon, PlaceStatusBadge, placeActionClass } from './PlaceSummary'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, Skeleton } from '@/ui/collection'
import { useRatingSummaries } from '@/features/polls/data'
import { StarsSummary } from '@/features/ratings/Stars'

export function PlacesScreen() {
  const { tripId } = useParams() as { tripId: string }
  const places = usePlaces(tripId)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<PlaceCategory | null>(null)
  const [showPool, setShowPool] = useState(false)
  const [sort, setSort] = useState<'area' | 'rating'>('area')
  const ratings = useRatingSummaries(tripId)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (places ?? [])
      .filter((p) => showPool || p.status !== 'catalog' || needle)
      .filter((p) => !cat || p.category === cat)
      .filter((p) => !needle || `${p.name} ${p.area ?? ''} ${p.tags.join(' ')}`.toLowerCase().includes(needle))
      .sort((a, b) =>
        sort === 'rating'
          ? (ratings?.get(b.id)?.average ?? 0) - (ratings?.get(a.id)?.average ?? 0) || (ratings?.get(b.id)?.count ?? 0) - (ratings?.get(a.id)?.count ?? 0) || a.name.localeCompare(b.name)
          : (a.area ?? '').localeCompare(b.area ?? '') || a.name.localeCompare(b.name),
      )
  }, [places, q, cat, showPool, sort, ratings])

  const poolCount = places?.filter((p) => p.status === 'catalog').length ?? 0

  return (
    <div className="min-h-full">
      <PageHeader
        title="Places"
        back={`/t/${tripId}/more`}
        action={
          <Link to="new" className="flex size-10 items-center justify-center rounded-full text-brand-700 active:bg-brand-50" aria-label="Add place">
            <Plus className="size-6" />
          </Link>
        }
      />
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <div className="relative">
          <Search aria-hidden="true" className="absolute top-3 left-3 size-5 text-stone-400" />
          <Input aria-label="Search places" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places" className="pl-10" />
        </div>
        <div aria-label="Filter places by category" className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1">
          <Chip active={!cat} onClick={() => setCat(null)}>All</Chip>
          {PLACE_CATEGORIES.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)}>
              {CATEGORY_STYLE[c].label}
            </Chip>
          ))}
        </div>
        {poolCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={showPool} onChange={(e) => setShowPool(e.target.checked)} className="size-4 accent-brand-600" />
            Include {poolCount} places from the idea pool
          </label>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <h2 className="text-sm font-semibold text-stone-700">{q.trim() ? 'Search results' : showPool ? 'All places' : 'Your places'}</h2>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-stone-600">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as 'area' | 'rating')} className="min-h-9 rounded-lg border border-stone-300 bg-white px-2 text-xs">
              <option value="area">By town</option>
              <option value="rating">Best rated</option>
            </select>
          </label>
          <p role="status" className="text-xs text-stone-500">{places ? `${filtered.length} ${filtered.length === 1 ? 'place' : 'places'}` : 'Loading places…'}</p>
        </div>
        {!places && <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="rounded-2xl border border-stone-200 bg-surface p-4"><Skeleton className="h-10 w-10" /><Skeleton className="mt-4 h-5 w-3/4" /><Skeleton className="mt-3 h-4 w-1/2" /></div>)}</div>}
        {places && filtered.length === 0 && (
          <Empty>
            <MapPin aria-hidden="true" className="size-8 text-brand-700" />
            <EmptyHeader>
              <EmptyTitle>{places.length ? 'No places in this view' : 'Where should we go?'}</EmptyTitle>
              <EmptyDescription>{places.length ? 'Try another search or category, or include the idea pool.' : 'That restaurant from the group chat? The beach you can’t stop thinking about? Save it here and let your friends add their favorites.'}</EmptyDescription>
            </EmptyHeader>
            {places.length ? <button className={placeActionClass} onClick={() => { setQ(''); setCat(null); setShowPool(true) }}>Show all places</button> : <Link to="new" className={placeActionClass}><Plus aria-hidden="true" className="size-4" />Add a place</Link>}
          </Empty>
        )}

        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((p) => {
            const at = p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null
            return (
              <li key={p.id} className="flex min-w-0 flex-col rounded-2xl border border-stone-200 bg-surface">
                <Link to={p.id} className="group flex-1 rounded-t-2xl p-4 transition-colors hover:bg-stone-50">
                  <div className="mb-4 flex items-center justify-between gap-2"><PlaceCategoryIcon category={p.category} /><span className="flex items-center gap-2"><StarsSummary summary={ratings?.get(p.id)} compact /><PlaceStatusBadge status={p.status} /></span></div>
                  <p className="mb-1 text-xs font-medium text-stone-500">{CATEGORY_STYLE[p.category].label}</p>
                  <h3 className="flex items-start justify-between gap-3 text-lg font-semibold leading-snug tracking-tight group-hover:text-brand-700"><span className="min-w-0 break-words">{p.name}</span><ArrowUpRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-stone-400" /></h3>
                  {(p.area || p.address) && <p className="mt-2 flex items-start gap-1.5 text-sm text-stone-600"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 break-words">{p.address || p.area}</span></p>}
                  {p.notes && <p className="mt-3 line-clamp-2 break-words text-sm leading-relaxed text-stone-600">{p.notes}</p>}
                  {!at && <p className="mt-3 text-xs text-amber-800">No map pin yet</p>}
                </Link>
                <div className="mx-4 flex flex-wrap gap-2 border-t border-stone-100 py-3">
                  {at && <Link to={`/t/${tripId}/map?place=${encodeURIComponent(p.id)}`} className={placeActionClass}><MapPin aria-hidden="true" className="size-4" />On map</Link>}
                  <a href={googleMapsUrl(p.name, p.area, at)} target="_blank" rel="noreferrer" className={placeActionClass}><Navigation aria-hidden="true" className="size-4" />Google Maps<span className="sr-only"> (opens in a new tab)</span></a>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 shrink-0 rounded-full border px-3 py-2 text-sm ${
        active ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
      }`}
    >
      {children}
    </button>
  )
}
