import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { Place } from '@/data/types'
import { Card } from '@/ui'
import { CATEGORY_STYLE } from '@/features/places/categories'
import { bestTime, travelOptions, type LegContext } from './legs'
import { isPick } from './requestLegs'
import { TrafficEstimate } from './TrafficEstimate'
import { ReportTimeForm, TravelOptionsList } from './TravelOptionsList'

const SHOW = 8

/** Travel times from this place to the group's other places, nearest first. */
export function TravelTimesCard({ place, places, ctx }: { place: Place; places: Place[]; ctx: LegContext }) {
  const [all, setAll] = useState(false)
  const [reportFor, setReportFor] = useState<string | null>(null)
  const rows = useMemo(
    () =>
      places
        .filter((p) => isPick(p) && p.id !== place.id)
        .map((p) => ({ p, options: travelOptions(place, p, ctx) }))
        .sort((a, b) => bestTime(a.options) - bestTime(b.options)),
    [place, places, ctx],
  )
  if (rows.length === 0) return null
  const shown = all ? rows : rows.slice(0, SHOW)

  return (
    <Card>
      <h2 className="ui-section-title">Travel times</h2>
      <p className="mb-3 text-xs text-stone-600">To the group's other places. Planning times include a buffer; check traffic for a fresh driving estimate.</p>
      <ul className="space-y-3">
        {shown.map(({ p, options }) => {
          const { Icon, color } = CATEGORY_STYLE[p.category]
          return (
            <li key={p.id}>
              <div className="mb-1 flex items-center gap-2">
                <Icon className="size-4" style={{ color }} />
                <Link to={`../${p.id}`} relative="path" className="min-w-0 flex-1 truncate font-medium">
                  {p.name}
                </Link>
                <button onClick={() => setReportFor(reportFor === p.id ? null : p.id)} className="text-xs text-brand-700">
                  Report time
                </button>
              </div>
              <div className="pl-6">
                <TravelOptionsList options={options} compact />
                <TrafficEstimate key={`${place.id}:${place.lat}:${place.lng}:${p.id}:${p.lat}:${p.lng}`} from={place} to={p} />
              </div>
              {reportFor === p.id && (
                <div className="mt-2">
                  <ReportTimeForm from={place} to={p} onDone={() => setReportFor(null)} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {rows.length > SHOW && (
        <button onClick={() => setAll((v) => !v)} className="mt-3 text-sm text-brand-700">
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </Card>
  )
}
