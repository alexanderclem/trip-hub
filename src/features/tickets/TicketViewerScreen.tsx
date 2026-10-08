import { useConfirm } from '@/ui/ConfirmProvider'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Trash2 } from 'lucide-react'
import { db } from '@/data/db'
import { useMyMemberId } from '@/data/device'
import { Button, ErrorNote, PageHeader } from '@/ui'
import { getBlob, removeAttachment } from './files'
import { PdfView } from './PdfView'
import { AttachmentText } from '@/features/scan/AttachmentText'
import { LoadingState } from '@/ui/LoadingState'

export function TicketViewerScreen() {
  const confirm = useConfirm()
  const { tripId, attachmentId } = useParams() as { tripId: string; attachmentId: string }
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const att = useLiveQuery(() => db.attachments.get(attachmentId), [attachmentId])
  const item = useLiveQuery(() => (att?.item_id ? db.itinerary_items.get(att.item_id) : undefined), [att?.item_id])
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!att || att.deleted_at) return
    let cancelled = false
    setError(null)
    getBlob(att)
      .then((b) => !cancelled && setBlob(b))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [att?.id, att?.uploaded_at]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  if (!att || att.deleted_at) {
    return (
      <div>
        <PageHeader title="Ticket" back={`/t/${tripId}/tickets`} />
        {att?.deleted_at && <p className="p-5 text-stone-500">This ticket was removed.</p>}
      </div>
    )
  }

  return (
    <div className="min-h-full bg-stone-100 pb-10">
      <PageHeader title={att.title} back={`/t/${tripId}/tickets`} />
      <div className="mx-auto max-w-2xl space-y-3 p-3">
        {att.confirmation_code && (
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">Confirmation</p>
            <p className="font-mono text-3xl font-semibold tracking-wider break-all select-all">{att.confirmation_code}</p>
          </div>
        )}
        {item && (
          <Link to={`/t/${tripId}/plan/${item.id}`} className="block rounded-xl bg-white px-4 py-3 text-sm text-brand-700 shadow-sm">For: {item.title}</Link>
        )}
        <ErrorNote error={error} />
        {/* touch-action lets people pinch-zoom a barcode for the scanner. */}
        <div style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
          {blob && att.mime === 'application/pdf' && <PdfView blob={blob} title={att.title} />}
          {url && att.mime.startsWith('image/') && <img src={url} alt={att.title} className="w-full rounded-lg bg-white shadow-sm" />}
          {!blob && !error && <LoadingState title="Opening your ticket…" description="Getting your saved ticket ready to view." />}
        </div>
        <AttachmentText att={att} blob={blob} />
        <div className="grid grid-cols-2 gap-2 pt-2">
          {url && (
            <a href={url} download={att.filename} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 font-medium text-stone-800">
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
