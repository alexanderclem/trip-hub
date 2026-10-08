import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { DateTime } from 'luxon'
import { CheckCircle2, CloudUpload, Download, FileText, Image as ImageIcon, Plus, Search, Ticket } from 'lucide-react'
import { useTrip } from '@/data/hooks'
import type { Attachment, ItineraryItem } from '@/data/types'
import { formatInZone } from '@/lib/time'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/ui/collection'
import { useDisplayZone, useItems } from '@/features/itinerary/data'
import { OfflineReadyCard } from '@/features/offline/OfflineReadyCard'
import { useAttachments } from './files'
import { Input } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'

/** Lower-case text to search: title, code, the read text and any pulled-out details. */
const haystack = (a: Attachment) => [a.title, a.confirmation_code, a.text, a.details?.merchant, a.details?.flight, a.details?.confirmation_code].filter(Boolean).join(' ').toLowerCase()

export const KIND_LABEL: Record<Attachment['kind'], string> = {
  ticket: 'Ticket', reservation: 'Reservation', receipt: 'Receipt', document: 'Document', photo: 'Photo',
}

export function TicketsScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const rows = useAttachments(tripId)
  const items = useItems(tripId) ?? []
  const { zone } = useDisplayZone(trip)
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  // Group by the day of the linked plan item; unlinked files last.
  const groups = useMemo(() => {
    const byItem = new Map(items.map((i) => [i.id, i]))
    const keyed = (rows ?? []).filter((r) => !query || haystack(r.att).includes(query)).map((r) => {
      const item = r.att.item_id ? byItem.get(r.att.item_id) : undefined
      const day = item ? (item.all_day ? item.start_local.slice(0, 10) : DateTime.fromISO(item.start_at).setZone(zone).toISODate()!) : null
      return { ...r, item, day }
    })
    keyed.sort((a, b) => (a.day ?? '9999').localeCompare(b.day ?? '9999') || (a.item?.start_at ?? '').localeCompare(b.item?.start_at ?? '') || a.att.title.localeCompare(b.att.title))
    const out = new Map<string, typeof keyed>()
    // Receipts get their own group at the end: they're for money, not for getting in somewhere.
    for (const k of keyed) {
      const key = k.att.kind === 'receipt' ? 'receipts' : (k.day ?? 'other')
      out.set(key, [...(out.get(key) ?? []), k])
    }
    const receipts = out.get('receipts')
    out.delete('receipts')
    return receipts ? [...out, ['receipts', receipts] as const] : [...out]
  }, [rows, items, zone, query])

  if (!trip || !rows) return <LoadingState fullScreen title="Loading your tickets…" description="Finding the documents saved for this trip." />

  return (
    <div className="min-h-full pb-28">
      <header className="pt-safe sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 backdrop-blur">
        <div className="px-4 py-3">
          <p className="truncate text-xs font-medium text-stone-500">{trip?.name}</p>
          <h1 className="text-xl font-semibold tracking-tight">Tickets</h1>
        </div>
      </header>
      <div className="mx-auto max-w-lg space-y-4 p-4 lg:max-w-5xl lg:p-6">
        {trip && <OfflineReadyCard trip={trip} compact />}
        {rows && rows.length > 0 && (
          <label className="relative block">
            <span className="sr-only">Search tickets, documents and receipts</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, codes and text" className="w-full pl-9" />
          </label>
        )}
        {query && groups.length === 0 && <p className="py-6 text-center text-sm text-stone-500">Nothing matches “{q.trim()}”.</p>}

        {rows && rows.length === 0 ? (
          <Empty>
            <Ticket aria-hidden="true" className="size-8 text-brand-700" />
            <EmptyHeader>
              <EmptyTitle>No tickets yet</EmptyTitle>
              <EmptyDescription>Add boarding passes, hotel confirmations and tour vouchers (PDFs or photos). They're saved on every phone in the group, so they open with no signal.</EmptyDescription>
            </EmptyHeader>
            <Link to="new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 font-medium text-white"><Plus aria-hidden="true" className="size-4" />Add a ticket</Link>
          </Empty>
        ) : (
          groups.map(([day, list]) => (
            <section key={day} aria-label={day === 'other' ? 'Not on the plan' : day === 'receipts' ? 'Receipts' : day}>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">
                {day === 'other' ? 'Not linked to the plan' : day === 'receipts' ? 'Receipts' : DateTime.fromISO(day).toFormat('cccc d LLLL')}
              </h2>
              <ul className="space-y-2">
                {list.map(({ att, onPhone, item }) => <TicketCard key={att.id} att={att} onPhone={onPhone} item={item} zone={zone} />)}
              </ul>
            </section>
          ))
        )}
      </div>
      <Link to="new" aria-label="Add ticket" className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-20 flex size-14 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-lg hover:bg-brand-900">
        <Plus aria-hidden="true" className="size-7" />
      </Link>
    </div>
  )
}

function TicketCard({ att, onPhone, item, zone }: { att: Attachment; onPhone: boolean; item?: ItineraryItem; zone: string }) {
  const Icon = att.mime === 'application/pdf' ? FileText : ImageIcon
  const status = onPhone
    ? att.uploaded_at
      ? { text: 'On this phone', Icon: CheckCircle2, cls: 'text-green-700' }
      : { text: 'Waiting to upload', Icon: CloudUpload, cls: 'text-amber-700' }
    : { text: 'Not downloaded yet', Icon: Download, cls: 'text-stone-500' }
  return (
    <li>
      <Link to={att.id} className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm hover:border-brand-600">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon aria-hidden="true" className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-stone-500">{KIND_LABEL[att.kind]}{item && !item.all_day ? ` · ${formatInZone(item.start_at, zone)}` : ''}</p>
            <p className="truncate font-semibold">{att.title}</p>
            {item && item.title !== att.title && <p className="truncate text-sm text-stone-600">{item.title}</p>}
          </div>
        </div>
        {att.confirmation_code && <p className="mt-3 font-mono text-2xl font-semibold tracking-wider break-all">{att.confirmation_code}</p>}
        <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${status.cls}`}><status.Icon aria-hidden="true" className="size-4" />{status.text}</p>
      </Link>
    </li>
  )
}
