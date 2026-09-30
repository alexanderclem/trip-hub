import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { MapPin, Plus, Search } from 'lucide-react'
import { usePlaces } from '@/data/hooks'
import { PLACE_CATEGORIES, type PlaceCategory } from '@/data/types'
import { Input, PageHeader } from '@/ui'
import { CATEGORY_STYLE, STATUS_LABEL } from './categories'

export function PlacesScreen() {
  const { tripId } = useParams() as { tripId: string }
  const places = usePlaces(tripId)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<PlaceCategory | null>(null)
  const [showPool, setShowPool] = useState(false)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (places ?? [])
      .filter((p) => showPool || p.status !== 'catalog' || needle)
      .filter((p) => !cat || p.category === cat)
      .filter((p) => !needle || `${p.name} ${p.area ?? ''} ${p.tags.join(' ')}`.toLowerCase().includes(needle))
      .sort((a, b) => (a.area ?? '').localeCompare(b.area ?? '') || a.name.localeCompare(b.name))
  }, [places, q, cat, showPool])

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
      <div className="space-y-3 p-4">
        <div className="relative">
          <Search className="absolute top-3 left-3 size-5 text-stone-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places" className="pl-10" />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={!cat} onClick={() => setCat(null)}>All</Chip>
          {PLACE_CATEGORIES.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)} color={CATEGORY_STYLE[c].color}>
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

        {places && filtered.length === 0 && (
          <div className="py-12 text-center text-stone-500">
            <MapPin className="mx-auto size-10 text-stone-300" />
            <p className="mt-2">{places.length ? 'No places match.' : 'No places yet. Add the first one!'}</p>
          </div>
        )}

        <ul className="space-y-2">
          {filtered.map((p) => {
            const { Icon, color, label } = CATEGORY_STYLE[p.category]
            return (
              <li key={p.id}>
                <Link to={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm active:bg-stone-50">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: color }}>
                    <Icon className="size-5" aria-label={label} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="truncate text-sm text-stone-500">
                      {[p.area, STATUS_LABEL[p.status]].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {p.lat == null && <span className="text-xs text-amber-700">no pin</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function Chip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color?: string; children: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
        active ? 'border-transparent text-white' : 'border-stone-300 bg-white text-stone-700'
      }`}
      style={active ? { background: color ?? 'var(--color-brand-600)' } : undefined}
    >
      {children}
    </button>
  )
}
