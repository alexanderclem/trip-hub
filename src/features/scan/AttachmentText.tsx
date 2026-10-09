import { useState } from 'react'
import { Link } from 'react-router'
import { Check, Copy, Pencil, ScanText, Sparkles, Wallet } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useTrip } from '@/data/hooks'
import type { Attachment } from '@/data/types'
import { updateAttachment } from '@/features/tickets/files'
import { formatMoney } from '@/lib/money'
import { useOnline } from '@/lib/useOnline'
import { Button, ErrorNote, LinkButton, Textarea } from '@/ui'
import { detailsAmountMinor, requestDetails } from './client'
import { extractText, ocrLangs } from './text'

/** The text and details of a saved ticket, document or receipt: read, copy, correct, enrich. */
export function AttachmentText({ att, blob }: { att: Attachment; blob: Blob | null }) {
  const me = useMyMemberId(att.trip_id)
  const trip = useTrip(att.trip_id)
  const online = useOnline()
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState<'read' | 'details' | 'save' | null>(null)
  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const text = att.text ?? ''
  const d = att.details
  const amount = d ? detailsAmountMinor(d) : null

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<void>) {
    setBusy(kind); setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Try again.') } finally { setBusy(null) }
  }
  const read = () => run('read', async () => {
    if (!blob) throw new Error('The file isn’t on this phone yet.')
    const r = await extractText(blob, att.mime, ocrLangs(trip), setProgress)
    await updateAttachment(att.id, { text: r.text || null, text_source: r.text ? r.source : null }, me)
    setOpen(true)
  })
  const pull = () => run('details', async () => {
    const details = await requestDetails(att.kind, blob, att.mime, text)
    await updateAttachment(att.id, { details, ...(details.confirmation_code && !att.confirmation_code ? { confirmation_code: details.confirmation_code } : {}) }, me)
  })
  const save = () => run('save', async () => {
    await updateAttachment(att.id, { text: editing?.trim() || null, text_source: editing?.trim() ? 'edited' : null }, me)
    setEditing(null)
  })

  return (
    <section aria-label="Text" className="space-y-2 rounded-2xl border border-stone-200 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="ui-section-title flex items-center gap-2"><ScanText aria-hidden="true" className="size-4 text-brand-700" />Text</h2>
        {text && editing === null && (
          <div className="flex gap-1">
            <button onClick={() => { void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
              {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}{copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={() => setEditing(text)} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-brand-700 hover:bg-brand-50"><Pencil aria-hidden="true" className="size-4" />Edit</button>
          </div>
        )}
      </div>

      {d && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
          {d.merchant && <><dt className="font-medium">From</dt><dd>{d.merchant}</dd></>}
          {amount != null && <><dt className="font-medium">Amount</dt><dd className="tabular-nums">{formatMoney(amount, d.currency!)}</dd></>}
          {d.date && <><dt className="font-medium">Date</dt><dd>{d.date}</dd></>}
          {d.flight && <><dt className="font-medium">Flight</dt><dd>{d.flight}</dd></>}
          {d.confirmation_code && <><dt className="font-medium">Code</dt><dd className="font-mono">{d.confirmation_code}</dd></>}
          {d.notes && <><dt className="font-medium">Note</dt><dd>{d.notes}</dd></>}
        </dl>
      )}

      {editing !== null ? (
        <>
          <Textarea aria-label="Text" rows={8} value={editing} maxLength={20_000} onChange={(e) => setEditing(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy === 'save'}>Cancel</Button>
            <Button onClick={() => void save()} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save text'}</Button>
          </div>
        </>
      ) : text ? (
        <div>
          <p className={`whitespace-pre-line break-words text-sm text-stone-700 ${open ? '' : 'line-clamp-4'}`}>{text}</p>
          {text.split('\n').length > 4 || text.length > 240 ? (
            <button onClick={() => setOpen(!open)} className="min-h-11 rounded-xl px-1 text-sm font-medium text-brand-700">{open ? 'Show less' : 'Show all'}</button>
          ) : null}
        </div>
      ) : (
        <Button variant="secondary" className="flex w-full items-center justify-center gap-2" disabled={!blob || busy !== null} onClick={() => void read()}>
          <ScanText aria-hidden="true" className="size-4" />{busy === 'read' ? `Reading text… ${Math.round(progress * 100)}%` : 'Read the text'}
        </Button>
      )}

      {editing === null && (
        <Button variant="secondary" className="flex w-full items-center justify-center gap-2" disabled={!online || busy !== null || (!text && !blob)} onClick={() => void pull()}>
          <Sparkles aria-hidden="true" className="size-4" />{busy === 'details' ? 'Reading details…' : d ? 'Pull out details again' : 'Pull out details'}
        </Button>
      )}
      {!online && editing === null && <p className="text-xs text-stone-600">Pulling out details needs signal.</p>}
      {att.kind === 'receipt' && !att.expense_id && (
        <LinkButton to={`/t/${att.trip_id}/money/new?receipt=${att.id}`} className="w-full">
          <Wallet aria-hidden="true" className="size-4" />Log as an expense
        </LinkButton>
      )}
      {att.expense_id && (
        <Link to={`/t/${att.trip_id}/money/${att.expense_id}`} className="block min-h-11 rounded-xl px-1 py-2.5 text-sm font-medium text-brand-700">Logged as an expense →</Link>
      )}
      <ErrorNote error={error} />
    </section>
  )
}
