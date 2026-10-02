import { Link } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { formatRange, MODE_LABEL, SOURCE_LABEL } from '@/features/routing/legs'
import { needsTravelBuffer, type Transfer } from './travel'

export function TravelWarnings({ transfers, tripId }: { transfers: Transfer[]; tripId: string }) {
  const warnings = transfers.filter(needsTravelBuffer)
  if (!warnings.length) return null
  return (
    <section aria-labelledby="travel-warnings-title" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
      <h2 id="travel-warnings-title" className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle aria-hidden="true" className="size-4 shrink-0" />Allow more travel time</h2>
      <ul className="mt-1 divide-y divide-amber-200">
        {warnings.map((t) => (
          <li key={`${t.from.id}:${t.to.id}`} className="py-2 text-sm">
            <Link to={`/t/${tripId}/plan/${t.to.id}`} className="flex min-h-11 items-center font-medium underline underline-offset-2">{t.from.title} → {t.to.title}</Link>
            <p>{Math.floor(t.gapS! / 60)} min between plans; allow {formatRange(t.option.minS, t.option.maxS)} by {MODE_LABEL[t.option.mode].label.toLowerCase()}.</p>
            <p className="mt-1 text-xs">{t.fromPlace.name} → {t.toPlace.name} · {SOURCE_LABEL[t.option.source]}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
