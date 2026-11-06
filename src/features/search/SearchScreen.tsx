import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams, useSearchParams } from 'react-router'
import { db } from '@/data/db'
import { Field, Input, PageHeader } from '@/ui'
import { searchTrip } from './search'

export function SearchScreen() {
  const { tripId } = useParams() as { tripId: string }
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const data = useLiveQuery(async () => {
    const [items, places, attachments, notes, tasks] = await Promise.all([
      db.itinerary_items.where('trip_id').equals(tripId).toArray(), db.places.where('trip_id').equals(tripId).toArray(),
      db.attachments.where('trip_id').equals(tripId).toArray(), db.day_notes.where('trip_id').equals(tripId).toArray(),
      db.trip_tasks.where('trip_id').equals(tripId).toArray(),
    ])
    return { items, places, attachments, notes, tasks }
  }, [tripId])
  const results = data ? searchTrip(data, tripId, query) : []
  return <div className="pb-10"><PageHeader title="Search this trip" back={`/t/${tripId}/more`} />
    <div className="mx-auto max-w-md space-y-4 p-4">
      <Field label="Search plans, places, documents, notes, and tasks" hint="Searches what is saved on this device, including text read from documents. Works offline.">
        <Input type="search" value={query} maxLength={200} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} placeholder="Name, booking code, or a detail…" />
      </Field>
      <p role="status" className="text-sm text-muted">{!data ? 'Loading saved trip…' : !query.trim() ? 'Enter a word or booking code to find it.' : results.length ? `${results.length}${results.length === 100 ? '+' : ''} results` : 'No matches. Try another word or check that the information is saved on this device.'}</p>
      <ul className="divide-y divide-line">{results.map((r) => <li key={`${r.kind}:${r.id}`}><Link to={r.path} className="block min-h-11 py-4">
        <span className="text-xs text-muted">{r.kind}</span><p className="wrap-anywhere font-semibold text-action">{r.title}</p>
        <p className="mt-1 line-clamp-3 wrap-anywhere text-sm text-muted">{r.detail}</p>
      </Link></li>)}</ul>
    </div></div>
}
