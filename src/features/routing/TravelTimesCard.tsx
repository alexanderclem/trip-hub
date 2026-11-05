import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { Place } from '@/data/types'
import { Card } from '@/ui'
import { CATEGORY_STYLE, categoryTone } from '@/features/places/categories'
import { bestTime, travelOptions, type LegContext } from './legs'
import { isPick } from './requestLegs'
import { TrafficEstimate, TrafficNotice } from './TrafficEstimate'
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
      <p className="mb-3 text-xs text-muted">To the group’s other places. Planning times include a buffer.</p>
      <ul className="space-y-3">
        {shown.map(({ p, options }) => {
          const { Icon, color } = CATEGORY_STYLE[p.category]
          return (
            <li key={p.id}>
              <div className="mb-1 flex items-center gap-2">
                <Icon aria-hidden="true" className="size-4 shrink-0" style={{ color: categoryTone(color) }} />
                <Link to={`../${p.id}`} relative="path" className="flex min-h-11 min-w-0 flex-1 items-center font-medium"><span className="truncate">{p.name}</span></Link>
                <button type="button" onClick={() => setReportFor(reportFor === p.id ? null : p.id)} aria-expanded={reportFor === p.id} className="ui-link shrink-0">
                  Report time
                </button>
              </div>
              <div className="pl-6">
                <TravelOptionsList options={options} compact />
                <TrafficEstimate key={`${place.id}:${place.lat}:${place.lng}:${p.id}:${p.lat}:${p.lng}`} from={place} to={p} notes={false} />
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
        <button onClick={() => setAll((v) => !v)} className="mt-3 text-sm text-action">
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
      <TrafficNotice />
    </Card>
  )
}
