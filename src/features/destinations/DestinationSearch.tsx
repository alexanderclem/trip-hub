import { useEffect, useId, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useOnline } from '@/lib/useOnline'
import { Button, Input } from '@/ui'
import { searchDestinations, type Destination } from './destinations'

/** Type a town, tap a result. Results come from OpenStreetMap, so it needs signal. */
export function DestinationSearch({ onPick, placeholder = 'Search for a town or city' }: { onPick: (d: Destination) => void; placeholder?: string }) {
  const id = useId()
  const online = useOnline()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Destination[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const q = query.trim()
    setError(null)
    setResults(null)
    if (q.length < 3 || !online) { setSearching(false); return }
    setSearching(true)
    const abort = new AbortController()
    let deadline: ReturnType<typeof setTimeout> | undefined
    // Wait for a pause in typing; the search service is shared and free.
    const timer = setTimeout(() => {
      deadline = setTimeout(() => {
        abort.abort()
        setSearching(false)
        setError('Destination search is taking too long. Check your connection and retry.')
      }, 10_000)
      searchDestinations(q, abort.signal)
        .then(setResults)
        .catch((e: unknown) => {
          if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Search failed. Try again.')
        })
        .finally(() => { clearTimeout(deadline); if (!abort.signal.aborted) setSearching(false) })
    }, 400)
    return () => {
      clearTimeout(timer)
      clearTimeout(deadline)
      abort.abort()
    }
  }, [query, online, retry])

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
        aria-busy={searching}
        aria-label="Search for a destination"
        autoCorrect="off"
        spellCheck={false}
      />
      {searching && <p role="status" className="mt-2 text-sm text-muted">Searching destinations…</p>}
      {error && <div className="mt-2"><p role="alert" className="text-sm text-danger-ink">{error}</p><Button type="button" variant="secondary" className="mt-2" onClick={() => setRetry((value) => value + 1)}>Retry destination search</Button></div>}
      {results && (
        results.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No places found for “{query.trim()}”.</p>
        ) : (
          <ul aria-label="Search results" className="mt-2 divide-y divide-line overflow-hidden rounded-surface border border-line bg-surface">
            {results.map((d) => (
              <li key={d.label}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(d)
                    setQuery('')
                    setResults(null)
                  }}
                  className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50"
                >
                  <MapPin aria-hidden="true" className="size-4 shrink-0 text-action" />
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
