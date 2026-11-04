import type { Attachment, DayNote, ItineraryItem, Place, TripTask } from '@/data/types'

export interface SearchResult { id: string; kind: string; title: string; detail: string; path: string }
export interface SearchData { items: ItineraryItem[]; places: Place[]; attachments: Attachment[]; notes: DayNote[]; tasks: TripTask[] }
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()

/** Only searches the selected trip's locally available data. Never indexes removed rows. */
export function searchTrip(data: SearchData, tripId: string, query: string): SearchResult[] {
  const words = normalize(query.trim()).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const root = `/t/${tripId}`
  const out: (SearchResult & { score: number })[] = []
  const add = (row: { id: string; trip_id: string; deleted_at?: string | null }, kind: string, title: string, detail: string, path: string) => {
    if (row.trip_id !== tripId || row.deleted_at) return
    const name = normalize(title), haystack = `${name} ${normalize(detail)}`
    if (!words.every((w) => haystack.includes(w))) return
    out.push({ id: row.id, kind, title, detail: detail.slice(0, 180), path: `${root}/${path}`, score: words.every((w) => name.includes(w)) ? 1 : 0 })
  }
  for (const i of data.items) add(i, 'Plan', i.title, [i.start_local.slice(0, 10), i.confirmation_code, i.notes, i.details.flight_iata].filter(Boolean).join(' · '), `plan/${i.id}`)
  for (const p of data.places) add(p, 'Place', p.name, [p.address, p.area, p.notes, ...p.tags].filter(Boolean).join(' · '), `more/places/${p.id}`)
  for (const a of data.attachments) add(a, 'Document', a.title, [a.confirmation_code, a.text, ...Object.values(a.details ?? {})].filter(Boolean).join(' · '), `tickets/${a.id}`)
  for (const n of data.notes) add(n, 'Day note', n.title || `Notes for ${n.date}`, n.notes ?? '', `plan?day=${n.date}`)
  for (const t of data.tasks) add(t, 'Task', t.title, t.notes ?? '', `more/tasks/${t.id}`)
  return out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)).slice(0, 100)
}
