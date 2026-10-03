import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DateTime } from 'luxon'
import { ChevronDown, Wallet } from 'lucide-react'
import type { ExpenseRow, Trip } from '@/data/types'
import { useItems } from '@/features/itinerary/data'
import type { RateTable } from '@/lib/fx'
import { Card } from '@/ui'
import { forecast } from './forecast'

/** "What will this trip cost me?": spent so far plus my share of planned estimates. */
export function TripCostCard({ trip, me, memberIds, expenses, snapshot, fmt }: {
  trip: Trip
  me: string
  memberIds: string[]
  expenses: ExpenseRow[]
  snapshot: RateTable | null
  fmt: (baseMinor: number) => string
}) {
  const items = useItems(trip.id)
  const [open, setOpen] = useState(false)
  const f = useMemo(() => (items ? forecast({ items, expenses, memberIds, me, base: trip.base_currency, snapshot }) : null), [items, expenses, memberIds, me, trip.base_currency, snapshot])
  if (!f || (f.spentMinor === 0 && f.planned.length === 0 && f.missingEstimates === 0)) return null
  // Estimates are approximate; the local-currency view already starts with "≈".
  const approx = (v: number) => `≈ ${fmt(v).replace(/^≈ /, '')}`

  return (
    <Card>
      <h2 className="flex items-center gap-2 font-semibold"><Wallet aria-hidden="true" className="size-5 text-brand-700" />What this trip costs you</h2>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex items-baseline justify-between gap-3 px-1"><dt className="text-stone-600">Spent so far</dt><dd className="font-semibold tabular-nums">{fmt(f.spentMinor)}</dd></div>
        <div className="flex items-baseline justify-between gap-3 px-1"><dt className="text-stone-600">Still planned</dt><dd className="font-semibold tabular-nums">{approx(f.plannedMinor)}</dd></div>
        <div className="flex items-baseline justify-between gap-3 rounded-xl bg-brand-50 px-3 py-2 text-brand-900"><dt className="font-medium">Trip total</dt><dd className="text-lg font-semibold tabular-nums">{approx(f.spentMinor + f.plannedMinor)}</dd></div>
      </dl>
      {f.planned.length > 0 && (
        <>
          <button aria-expanded={open} aria-controls="planned-costs" onClick={() => setOpen(!open)} className="mt-2 flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-sm font-medium text-brand-700 hover:bg-brand-50">
            {open ? 'Hide' : 'Show'} {f.planned.length} planned cost{f.planned.length > 1 ? 's' : ''}
            <ChevronDown aria-hidden="true" className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <ul id="planned-costs" className="divide-y divide-stone-100 text-sm">
              {f.planned.map((p) => (
                <li key={p.item.id}>
                  <Link to={`/t/${trip.id}/plan/${p.item.id}`} className="flex min-h-11 items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-stone-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.item.title}</span>
                      <span className="block text-xs text-stone-500">{DateTime.fromISO(p.item.start_at, { zone: trip.timezone }).toFormat('ccc d LLL')} · {fmt(p.totalMinor)} ÷ {p.people}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{approx(p.shareMinor)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {f.missingEstimates > 0 && (
        <p className="mt-2 text-sm text-stone-600">
          {f.missingEstimates} of your plans {f.missingEstimates > 1 ? 'have' : 'has'} no cost estimate yet. <Link to={`/t/${trip.id}/plan`} className="font-medium text-brand-700 underline">Add {f.missingEstimates > 1 ? 'them' : 'it'} on the Plan tab</Link>.
        </p>
      )}
      <p className="mt-2 text-xs text-stone-500">Estimates come from plan items and are split among the people going. Once someone logs the expense, the real amount replaces the estimate.</p>
    </Card>
  )
}
