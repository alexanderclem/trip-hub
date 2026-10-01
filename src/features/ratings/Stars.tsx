import { Star } from 'lucide-react'
import type { RatingSummary } from '@/features/polls/rank'

/** Five tappable stars. Tapping your current rating again clears it. */
export function StarsInput({ value, onChange, label = 'Your rating' }: { value: number | null; onChange: (v: number | null) => void; label?: string }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value != null && n <= value
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            aria-pressed={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className="flex size-11 items-center justify-center rounded-xl hover:bg-amber-50 active:bg-amber-100"
          >
            <Star aria-hidden="true" className={`size-7 ${on ? 'fill-amber-400 text-amber-500' : 'text-stone-300'}`} />
          </button>
        )
      })}
    </div>
  )
}

/** "★ 4.5 · 3 ratings" — compact group rating, or nothing if unrated. */
export function StarsSummary({ summary, compact = false }: { summary: RatingSummary | undefined; compact?: boolean }) {
  if (!summary?.average) return null
  const text = `${summary.average.toFixed(1)}`
  return (
    <span className="inline-flex items-center gap-1 text-sm text-stone-700" aria-label={`Group rating ${text} out of 5 from ${summary.count} ${summary.count === 1 ? 'person' : 'people'}`}>
      <Star aria-hidden="true" className="size-4 fill-amber-400 text-amber-500" />
      <span className="font-medium tabular-nums">{text}</span>
      {!compact && <span className="text-stone-500">· {summary.count}</span>}
    </span>
  )
}
