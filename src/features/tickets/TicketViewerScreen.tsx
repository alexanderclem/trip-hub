import { useConfirm } from '@/ui/ConfirmProvider'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Download, LoaderCircle, RotateCw, Trash2 } from 'lucide-react'
import { db } from '@/data/db'
import { useMyMemberId } from '@/data/device'
import { Button, ErrorNote, PageHeader } from '@/ui'
import { getBlob, removeAttachment } from './files'
import { PdfView } from './PdfView'
import { AttachmentText } from '@/features/scan/AttachmentText'
import { Morph, morphName } from '@/ui/Morph'
import { rowLoader, useFirstRow } from '@/data/firstRow'

export function TicketViewerScreen() {
  const confirm = useConfirm()
  const { tripId, attachmentId } = useParams() as { tripId: string; attachmentId: string }
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const att = useFirstRow(attachmentId, useLiveQuery(() => db.attachments.get(attachmentId), [attachmentId]))
  const item = useLiveQuery(() => (att?.item_id ? db.itinerary_items.get(att.item_id) : undefined), [att?.item_id])
  const [file, setFile] = useState<{ id: string; blob: Blob } | null>(null)
  const [objectUrl, setObjectUrl] = useState<{ id: string; url: string } | null>(null)
  const blob = file?.id === attachmentId ? file.blob : null
  const url = objectUrl?.id === attachmentId && blob ? objectUrl.url : null
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!att || att.id !== attachmentId || att.deleted_at || file?.id === attachmentId) return
    let cancelled = false
    setError(null)
    getBlob(att)
      .then((blob) => !cancelled && setFile({ id: attachmentId, blob }))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [att?.id, att?.uploaded_at, attachmentId, file, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!blob) { setObjectUrl(null); return }
    const u = URL.createObjectURL(blob)
    setObjectUrl({ id: attachmentId, url: u })
    return () => URL.revokeObjectURL(u)
  }, [blob, attachmentId])

  if (!att || att.id !== attachmentId || att.deleted_at) {
    return (
      <div>
        <PageHeader title="Ticket" back={`/t/${tripId}/tickets`} />
        {att?.deleted_at && <p className="p-5 text-muted">This ticket was removed.</p>}
      </div>
    )
  }

  return (
    <div className="min-h-full bg-mist/60 pb-10">
      <PageHeader title={att.title} titleMorph={morphName('ticket', att.id, 'title')} back={`/t/${tripId}/tickets`} />
      <div className="mx-auto max-w-2xl space-y-3 p-3">
        {att.confirmation_code && (
          <div className="rounded-surface border border-line bg-surface p-4 text-center">
            <p className="ui-label">Confirmation</p>
            <Morph name={morphName('ticket', att.id, 'code')}><p className="mx-auto w-fit font-mono text-3xl font-semibold tracking-wider break-all select-all">{att.confirmation_code}</p></Morph>
          </div>
        )}
        {item && item.id === att.item_id && (
          <Link to={`/t/${tripId}/plan/${item.id}`} className="block rounded-control border border-line bg-surface px-4 py-3 text-sm text-action">For: {item.title}</Link>
        )}
        {error && <div className="rounded-surface border border-line bg-surface p-4"><ErrorNote error={error} /><Button variant="secondary" className="mt-3" onClick={() => { setError(null); setAttempt((value) => value + 1) }}><RotateCw aria-hidden="true" className="size-4" />Try again</Button></div>}
        {blob && <p role="status" className="flex items-center gap-2 text-sm text-success-ink"><CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />Saved on this phone</p>}
        {/* touch-action lets people pinch-zoom a barcode for the scanner. */}
        <div style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
          {blob && att.mime === 'application/pdf' && <PdfView blob={blob} title={att.title} />}
          {url && att.mime.startsWith('image/') && <img src={url} alt={att.title} className="w-full rounded-control bg-surface shadow-sm" />}
          {!blob && !error && <div role="status" className="flex items-center gap-3 rounded-surface border border-line bg-surface p-5 text-sm text-muted"><LoaderCircle aria-hidden="true" className="size-5 shrink-0 motion-safe:animate-spin" />Opening your ticket…</div>}
        </div>
        <AttachmentText att={att} blob={blob} />
        <div className="grid grid-cols-2 gap-2 pt-2">
          {url && (
            <a href={url} download={att.filename} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-control bg-surface px-4 font-medium text-ink">
              <Download aria-hidden="true" className="size-4" /> Save a copy
            </a>
          )}
          <Button variant="danger" onClick={async () => {
            if (!await confirm(`Remove "${att.title}" for everyone?`)) return
            await removeAttachment(att.id, me)
            navigate(`/t/${tripId}/tickets`, { replace: true })
          }}>
            <Trash2 aria-hidden="true" className="size-4" /> Remove
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Reads this screen's row before the route commits, so it can morph in from its list. */
export const loader = rowLoader('attachments', 'attachmentId')
