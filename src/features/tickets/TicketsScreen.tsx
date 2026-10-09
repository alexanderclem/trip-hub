import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { DateTime } from 'luxon'
import { CheckCircle2, CloudUpload, Download, FileText, Image as ImageIcon, Plus, Search } from 'lucide-react'
import { useTrip } from '@/data/hooks'
import type { Attachment, ItineraryItem } from '@/data/types'
import { formatInZone } from '@/lib/time'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/ui/collection'
import { useDisplayZone, useItems } from '@/features/itinerary/data'
import { OfflineReadyCard } from '@/features/offline/OfflineReadyCard'
import { useAttachments } from './files'
import { Fab, Input, LinkButton, PageHeader } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'
import { Stowie } from '@/features/stowie/Stowie'

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
      <PageHeader title="Tickets" back={`/t/${tripId}/more`} below={rows.length > 0 && (
        <label className="relative block px-4 pb-3 lg:px-6">
          <span className="sr-only">Search tickets, documents and receipts</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-7 size-4 text-stone-600 lg:left-9" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, codes and text" className="w-full pl-9" />
        </label>
      )} />
      <div className="mx-auto max-w-lg space-y-4 p-4 lg:p-6">
        {trip && <OfflineReadyCard trip={trip} compact />}
        {query && groups.length === 0 && <p className="py-6 text-center text-sm text-stone-600">Nothing matches “{q.trim()}”.</p>}

        {rows && rows.length === 0 ? (
          <Empty>
            <Stowie size={64} />
            <EmptyHeader>
              <EmptyTitle>Keep every ticket handy</EmptyTitle>
              <EmptyDescription>Booked something? Add the boarding pass, stay confirmation, or tour ticket as a PDF or photo. Download your tickets before you leave so they’re ready without signal.</EmptyDescription>
            </EmptyHeader>
            <LinkButton to="new"><Plus aria-hidden="true" className="size-4" />Add a ticket</LinkButton>
          </Empty>
        ) : (
          groups.map(([day, list]) => (
            <section key={day} aria-label={day === 'other' ? 'Not on the plan' : day === 'receipts' ? 'Receipts' : day}>
              <h2 className="ui-label mb-2">
                {day === 'other' ? 'Not linked to the plan' : day === 'receipts' ? 'Receipts' : DateTime.fromISO(day).toFormat('cccc d LLLL')}
              </h2>
              <ul className="space-y-2">
                {list.map(({ att, onPhone, item }) => <TicketCard key={att.id} att={att} onPhone={onPhone} item={item} zone={zone} />)}
              </ul>
            </section>
          ))
        )}
      </div>
      {rows.length > 0 && <Fab to="new" label="Add ticket" />}
    </div>
  )
}

function TicketCard({ att, onPhone, item, zone }: { att: Attachment; onPhone: boolean; item?: ItineraryItem; zone: string }) {
  const Icon = att.mime === 'application/pdf' ? FileText : ImageIcon
  const status = onPhone
    ? att.uploaded_at
      ? { text: 'On this phone', Icon: CheckCircle2, cls: 'text-stone-600' }
      : { text: 'Waiting to upload', Icon: CloudUpload, cls: 'text-amber-700' }
    : { text: 'Not downloaded yet', Icon: Download, cls: 'text-stone-600' }
  return (
    <li>
      <Link to={att.id} className="block rounded-2xl border border-stone-200 bg-surface p-4 hover:border-brand-600">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon aria-hidden="true" className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-stone-600">{KIND_LABEL[att.kind]}{item && !item.all_day ? ` · ${formatInZone(item.start_at, zone)}` : ''}</p>
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
