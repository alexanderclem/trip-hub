// /organize/travelers (Pro): everyone who has booked one of your trips, with trips, total paid, tags,
// notes and whether they agreed to hear about future trips. Built from bookings on the server; needs signal.

import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Button, Card, ErrorNote, Input, PageHeader, Textarea } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'
import { listContacts, saveContact, type ContactRow } from './api'
import { contactsCsv, downloadText } from './data'
import { ProBadge, useMyOrganizer } from './pro'

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)

export function TravelersScreen() {
  const me = useMyOrganizer()
  const [rows, setRows] = useState<ContactRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => { listContacts().then(setRows, (e: unknown) => setError(e instanceof Error ? e.message : String(e))) }, [])

  const tags = useMemo(() => [...new Set((rows ?? []).flatMap((r) => r.tags))].sort(), [rows])
  const shown = (rows ?? []).filter((r) => (!tag || r.tags.includes(tag)) && (!search.trim() || `${r.name} ${r.email}`.toLowerCase().includes(search.trim().toLowerCase())))

  if (!rows && !error) return <LoadingState fullScreen title="Loading your travelers…" />
  return (
    <div className="pb-16">
      <PageHeader title="Past travelers" back="/organize" />
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <div className="-ml-2"><ProBadge beta={me?.beta ?? true} /></div>
        <p className="text-sm text-muted">Everyone who has booked one of your trips. “Emails OK” means they ticked the box to hear about future trips; only they can turn it on.</p>
        <ErrorNote error={error} />
        {rows && (
          <>
            <Input type="search" aria-label="Search by name or email" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tag">
                {[null, ...tags].map((t) => (
                  <button key={t ?? 'all'} type="button" aria-pressed={tag === t} className={`min-h-11 rounded-control border px-3 text-sm ${tag === t ? 'border-action bg-action text-white' : 'border-line'}`} onClick={() => setTag(t)}>{t ?? 'All'}</button>
                ))}
              </div>
            )}
            <Card>
              {shown.length === 0 ? <p className="text-sm text-muted">{rows.length ? 'Nobody matches.' : 'Travelers appear here once they’ve paid for a trip.'}</p> : (
                <ul className="divide-y divide-line">
                  {shown.map((c) => (
                    <li key={c.id} className="py-2">
                      <button type="button" aria-expanded={open === c.id} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
                        <span className="min-w-0 break-words"><span className="font-semibold text-action">{c.name}</span> <span className="text-sm text-muted">{c.email}</span></span>
                        <span className="text-sm tabular-nums">{c.trips} {c.trips === 1 ? 'trip' : 'trips'} · {usd(c.total_paid_minor)}{c.marketing_consent && !c.unsubscribed_at ? ' · emails OK' : ''}{c.credit_minor ? ` · ${usd(c.credit_minor)} credit` : ''}</span>
                      </button>
                      {c.tags.length > 0 && <p className="text-xs text-muted">{c.tags.join(' · ')}</p>}
                      {open === c.id && c.referral_code && <p className="mt-1 text-xs text-muted">Referral code {c.referral_code}</p>}
                      {open === c.id && <ContactEditor contact={c} onSaved={(n) => setRows(rows.map((r) => (r.id === n.id ? { ...r, tags: n.tags, notes: n.notes } : r)))} />}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            {rows.length > 0 && <button type="button" className="ui-link inline-flex min-h-11 items-center gap-2" onClick={() => downloadText('stowaway-travelers.csv', contactsCsv(shown))}><Download aria-hidden="true" className="size-4" />Download {tag || search ? 'these' : 'all'} as CSV</button>}
          </>
        )}
      </div>
    </div>
  )
}

function ContactEditor({ contact, onSaved }: { contact: ContactRow; onSaved: (c: ContactRow) => void }) {
  const [tags, setTags] = useState(contact.tags.join(', '))
  const [notes, setNotes] = useState(contact.notes)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit() {
    setBusy(true); setError(null)
    try { onSaved(await saveContact(contact.id, tags.split(',').map((t) => t.trim()).filter(Boolean), notes)) } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return (
    <div className="mt-2 space-y-2 rounded-surface bg-mist/60 p-3">
      <label className="block text-sm font-[550]" htmlFor={`tags-${contact.id}`}>Tags, separated by commas</label>
      <Input id={`tags-${contact.id}`} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="repeat, vip" />
      <label className="block text-sm font-[550]" htmlFor={`notes-${contact.id}`}>Notes (only you see these)</label>
      <Textarea id={`notes-${contact.id}`} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <ErrorNote error={error} />
      <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void submit()}>{busy ? 'Saving…' : 'Save'}</Button>
    </div>
  )
}
