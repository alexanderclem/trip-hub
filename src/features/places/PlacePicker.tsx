import { useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Place } from '@/data/types'
import { Input } from '@/ui'
import { PlaceCategoryIcon } from './PlaceSummary'

/** Search-and-pick a place: the group's picks first, then the idea pool. */
export function PlacePicker({ places, value, onChange, label }: { places: Place[]; value: string | null; onChange: (id: string | null) => void; label: string }) {
  const [q, setQ] = useState('')
  const selected = value ? places.find((p) => p.id === value) : undefined
  const needle = q.trim().toLowerCase()
  const matches = needle.length >= 2
    ? places
        .filter((p) => !p.deleted_at && `${p.name} ${p.area ?? ''}`.toLowerCase().includes(needle))
        .sort((a, b) => Number(a.status === 'catalog') - Number(b.status === 'catalog') || a.name.localeCompare(b.name))
        .slice(0, 6)
    : []

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-stone-300 bg-white p-2">
        <PlaceCategoryIcon category={selected.category} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{selected.name}</p>
          {selected.area && <p className="text-xs text-stone-500">{selected.area}</p>}
        </div>
        <button type="button" onClick={() => onChange(null)} className="flex size-11 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100" aria-label={`Clear ${label}`}>
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
    )
  }
  return (
    <div>
      <div className="relative">
        <Search aria-hidden="true" className="absolute top-3 left-3 size-5 text-stone-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places" className="pl-10" aria-label={label} />
      </div>
      {matches.length > 0 && (
        <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {matches.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => { onChange(p.id); setQ('') }} className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-stone-500">{p.area}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
