import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { DateTime } from 'luxon'
import type { ItineraryItem, Place } from '@/data/types'
import { formatInZone } from '@/lib/time'
import { layoutDay } from '@/features/itinerary/layout'
import { KIND_STYLE } from '@/features/itinerary/kinds'

/** A glimpse of the actual itinerary, not another set of feature counters. */
export function TripDayPreview({ tripId, day, items, places, zone, today }: {
  tripId: string; day: string; items: ItineraryItem[]; places: Place[]; zone: string; today: string
}) {
  const layout = layoutDay(items, day, zone)
  const rows = [...layout.allDay, ...layout.blocks.map((block) => block.item)]
  if (!rows.length) return null
  return <section className="trip-day-preview" aria-labelledby="preview-day-title">
    <div className="shared-places-heading"><h2 id="preview-day-title">{day === today ? 'Today · ' : ''}{DateTime.fromISO(day).toFormat('cccc, d LLLL')}</h2><Link to={`/t/${tripId}/plan?day=${day}`} className="ui-link">Full plan<ArrowRight aria-hidden="true" className="size-4" /></Link></div>
    <ol className="preview-stops">{rows.slice(0, 3).map((item) => {
      const style = KIND_STYLE[item.kind]
      const place = places.find((place) => place.id === item.place_id)
      return <li key={item.id}><Link to={`/t/${tripId}/plan/${item.id}`}>
        <span className={`preview-stop-icon ${style.bg} ${style.text}`}><style.Icon aria-hidden="true" className="size-4" /></span>
        <span className="preview-stop-body"><strong>{item.title}</strong><span>{place?.name ?? style.label}{item.status === 'idea' ? ' · Idea' : item.status === 'tentative' ? ' · Tentative' : ''}</span></span>
        <span className="preview-stop-time">{item.all_day ? 'All day' : formatInZone(item.start_at, zone)}</span>
      </Link></li>
    })}</ol>
    {rows.length > 3 && <Link to={`/t/${tripId}/plan?day=${day}`} className="ui-link text-xs">{rows.length - 3} more in this day<ArrowRight aria-hidden="true" className="size-3.5" /></Link>}
  </section>
}
