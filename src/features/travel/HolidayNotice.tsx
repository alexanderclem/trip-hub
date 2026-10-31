import { z } from 'zod'
import type { Trip } from '@/data/types'
import { Link } from 'react-router'
import { useTravel } from './client'
import { holidaySchema } from './model'
const schema = z.array(holidaySchema)
export function HolidayNotice({ trip, day }: { trip: Trip; day: string }) {
  const country = typeof trip.settings.destination_country === 'string' ? trip.settings.destination_country : ''
  const result = useTravel(/^[A-Z]{2}$/.test(country) ? { action: 'holidays', tripId: trip.id, country, year: Number(day.slice(0, 4)) } : null, schema)
  const holidays = result.data?.filter((h) => h.date === day) ?? []
  if (!holidays.length) return country ? null : <Link className="ui-link text-sm" to={`/t/${trip.id}/more/explore`}>Set a destination to see local holidays</Link>
  return <aside className="rounded-control border border-line bg-mist p-3 text-sm"><p className="font-semibold">{holidays.map((h) => `${h.name}${h.regional ? ` (regional: ${h.regions.join(', ')})` : ''}`).join(' · ')}</p><p>Public holiday · Check opening hours. {result.error ? 'Showing saved information.' : ''}</p><p className="text-xs text-muted">Nager.Holidays · {result.fetchedAt ? `Updated ${new Date(result.fetchedAt).toLocaleDateString()}` : ''}</p></aside>
}
