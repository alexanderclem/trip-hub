import { useEffect, useId, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useOnline } from '@/lib/useOnline'
import { Input } from '@/ui'
import { searchDestinations, type Destination } from './destinations'

/** Type a town, tap a result. Results come from OpenStreetMap, so it needs signal. */
export function DestinationSearch({ onPick, placeholder = 'Search for a town or city' }: { onPick: (d: Destination) => void; placeholder?: string }) {
  const id = useId()
  const online = useOnline()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Destination[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    setError(null)
    if (q.length < 3) return void setResults(null)
    const abort = new AbortController()
    // Wait for a pause in typing; the search service is shared and free.
    const timer = setTimeout(() => {
      searchDestinations(q, abort.signal)
        .then(setResults)
        .catch((e: unknown) => {
          if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Search failed. Try again.')
        })
    }, 400)
    return () => {
      clearTimeout(timer)
      abort.abort()
    }
  }, [query])

  return (
    <div>
      <Input
        id={id}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        // Inside a form, Enter would submit the form instead of searching.
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault()
        }}
        placeholder={online ? placeholder : 'Searching needs signal'}
        disabled={!online}
        aria-label="Search for a destination"
        autoCorrect="off"
        spellCheck={false}
      />
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {results && (
        results.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No places found for “{query.trim()}”.</p>
        ) : (
          <ul aria-label="Search results" className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {results.map((d) => (
              <li key={d.label}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(d)
                    setQuery('')
                    setResults(null)
                  }}
                  className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50"
                >
                  <MapPin aria-hidden="true" className="size-4 shrink-0 text-brand-700" />
                  <span className="min-w-0 break-words">{d.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}
