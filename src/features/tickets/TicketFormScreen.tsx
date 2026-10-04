import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Camera, FileUp } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { ATTACHMENT_KINDS, type AttachmentKind } from '@/data/types'
import { Button, ErrorNote, Field, Input, PageHeader, Select } from '@/ui'
import { useItems } from '@/features/itinerary/data'
import { useTrip } from '@/data/hooks'
import { ScanPanel, type ScanValue } from '@/features/scan/ScanPanel'
import type { ScanDetails } from '@/features/scan/details'
import { ocrLangs } from '@/features/scan/text'
import { formatMoney } from '@/lib/money'
import { detailsAmountMinor } from '@/features/scan/client'
import { addAttachment } from './files'
import { KIND_LABEL } from './TicketsScreen'

export function TicketFormScreen() {
  const { tripId } = useParams() as { tripId: string }
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const items = useItems(tripId)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const forExpense = search.get('expense') === '1'
  const forExpenseId = search.get('for_expense')
  const [kind, setKind] = useState<AttachmentKind>(ATTACHMENT_KINDS.find((k) => k === search.get('kind')) ?? 'ticket')
  const trip = useTrip(tripId)
  const langKey = ocrLangs(trip).join('+')
  const langs = useMemo(() => langKey.split('+'), [langKey])
  const [scan, setScan] = useState<ScanValue>({ text: '', source: null })
  const [details, setDetails] = useState<ScanDetails | null>(null)
  const titleTouched = useRef(false)
  const [itemId, setItemId] = useState<string>(search.get('item') ?? '')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Prefill from the linked plan item once it's loaded.
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !items || !itemId) return
    const it = items.find((i) => i.id === itemId)
    if (!it) return
    prefilled.current = true
    setTitle((t) => t || it.title)
    setCode((c) => c || it.confirmation_code || '')
    if (it.kind === 'lodging' || it.kind === 'reservation') setKind('reservation')
  }, [items, itemId])

  function pick(f: File | undefined) {
    if (!f) return
    setFile(f)
    setError(null)
    setScan({ text: '', source: null })
    setDetails(null)
    setTitle((t) => t || f.name.replace(/\.\w+$/, ''))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) return setError('Choose a PDF or a photo.')
    setSaving(true)
    setError(null)
    try {
      const id = await addAttachment({ tripId, file, title, kind, itemId: itemId || null, confirmationCode: code, text: scan.text, textSource: scan.source, details, expenseId: forExpenseId }, me)
      navigate(forExpenseId ? `/t/${tripId}/money/${forExpenseId}` : forExpense && kind === 'receipt' ? `/t/${tripId}/money/new?receipt=${id}` : `/t/${tripId}/tickets/${id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full pb-10">
      <PageHeader title={forExpense ? 'Scan a receipt' : 'Add ticket or document'} back={forExpenseId ? `/t/${tripId}/money/${forExpenseId}` : forExpense ? `/t/${tripId}/money` : itemId ? `/t/${tripId}/plan/${itemId}` : `/t/${tripId}/tickets`} />
      <form onSubmit={submit} className="mx-auto max-w-md space-y-4 p-4">
        <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden aria-label="Choose file" onChange={(e) => pick(e.target.files?.[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden aria-label="Take photo" onChange={(e) => pick(e.target.files?.[0])} />
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}><FileUp aria-hidden="true" className="size-4" />PDF or photo</Button>
          <Button type="button" variant="secondary" onClick={() => cameraRef.current?.click()}><Camera aria-hidden="true" className="size-4" />Take a photo</Button>
        </div>
        {file && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
        {file && (
          <ScanPanel
            file={file} mime={file.type || 'application/octet-stream'} kind={kind} langs={langs} value={scan} onChange={setScan}
            onDetails={(d) => {
              setDetails(d)
              if (d.title && !titleTouched.current) setTitle(d.title)
              if (d.confirmation_code) setCode((c) => c || d.confirmation_code!)
            }}
          />
        )}
        {details && (
          <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
            Found: {[details.merchant, detailsAmountMinor(details) != null ? formatMoney(detailsAmountMinor(details)!, details.currency!) : null, details.date, details.flight, details.confirmation_code].filter(Boolean).join(' · ') || 'a few details'}. Check them before saving.
          </p>
        )}

        <Field label="Name">
          <Input value={title} onChange={(e) => { titleTouched.current = true; setTitle(e.target.value) }} maxLength={200} placeholder={kind === 'receipt' ? 'Dinner at Café Sky' : 'Boarding pass UA 1234'} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as AttachmentKind)}>
              {ATTACHMENT_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
          </Field>
          <Field label="Confirmation code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
          </Field>
        </div>
        <Field label="For which part of the plan?">
          <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Not linked</option>
            {(items ?? []).map((i) => <option key={i.id} value={i.id}>{i.start_local.slice(5, 10).replace('-', '/')} · {i.title}</option>)}
          </Select>
        </Field>
        <ErrorNote error={error} />
        <Button type="submit" className="w-full" disabled={saving || !file}>{saving ? 'Saving…' : forExpense && kind === 'receipt' ? 'Save and log the expense' : 'Save'}</Button>
        <p className="text-center text-xs text-stone-500">Saved on this phone right away, then shared with the group when there's signal.</p>
      </form>
    </div>
  )
}
