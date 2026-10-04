import { useEffect, useRef, useState } from 'react'
import { ScanText, Sparkles } from 'lucide-react'
import type { AttachmentKind } from '@/data/types'
import { useOnline } from '@/lib/useOnline'
import { Button, ErrorNote, Textarea } from '@/ui'
import { requestDetails } from './client'
import type { ScanDetails } from './details'
import { extractText, type TextSource } from './text'

export interface ScanValue {
  text: string
  source: TextSource | 'edited' | 'ai' | null
}

/**
 * Reads the text of a picked file on the phone (works offline once the text reader is
 * downloaded), shows it for correcting, and when online can pull out details with AI.
 */
export function ScanPanel({ file, mime, kind, langs, value, onChange, onDetails }: {
  file: Blob
  mime: string
  kind: AttachmentKind
  langs: string[]
  value: ScanValue
  onChange: (v: ScanValue) => void
  onDetails: (d: ScanDetails) => void
}) {
  const online = useOnline()
  const [reading, setReading] = useState<number | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const readFor = useRef<Blob | null>(null)
  const latest = useRef(onChange)
  latest.current = onChange

  useEffect(() => {
    if (readFor.current === file) return
    readFor.current = file
    let cancelled = false
    setReading(0)
    setReadError(null)
    extractText(file, mime, langs, (p) => !cancelled && setReading(p))
      .then((r) => { if (!cancelled) latest.current({ text: r.text, source: r.source }) })
      .catch((e) => {
        if (cancelled) return
        console.warn('text reading failed', e)
        setReadError(navigator.onLine ? 'Couldn’t read the text from this file. You can type it in.' : 'The text reader isn’t on this phone yet. Run “Ready for offline” while online, or type the text in.')
      })
      .finally(() => { if (!cancelled) setReading(null) })
    return () => { cancelled = true }
  }, [file, mime, langs])

  async function pullDetails() {
    setAsking(true)
    setDetailsError(null)
    try { onDetails(await requestDetails(kind, file, mime, value.text)) }
    catch (e) { setDetailsError(e instanceof Error ? e.message : 'Couldn’t read details. Try again.') }
    finally { setAsking(false) }
  }

  return (
    <section aria-label="Text from the file" className="space-y-2 rounded-2xl border border-stone-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><ScanText aria-hidden="true" className="size-4 text-brand-700" />Text</h2>
        {reading !== null && <span role="status" className="text-xs text-stone-500">Reading text… {Math.round(reading * 100)}%</span>}
      </div>
      <Textarea
        aria-label="Text from the file"
        rows={5}
        value={value.text}
        maxLength={20_000}
        disabled={reading !== null}
        placeholder={reading !== null ? 'Reading…' : 'No text found. You can type the important bits here.'}
        onChange={(e) => onChange({ text: e.target.value, source: 'edited' })}
      />
      {readError && <p className="text-sm text-amber-800">{readError}</p>}
      <Button type="button" variant="secondary" className="flex w-full items-center justify-center gap-2" disabled={!online || asking || reading !== null} onClick={() => void pullDetails()}>
        <Sparkles aria-hidden="true" className="size-4" />{asking ? 'Reading details…' : 'Pull out details'}
      </Button>
      {!online && <p className="text-xs text-stone-500">Pulling out details needs signal; the text above is read on your phone.</p>}
      <ErrorNote error={detailsError} />
    </section>
  )
}
