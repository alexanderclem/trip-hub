import { ensureSession, supabase } from '@/lib/supabase'
import { minorUnits } from '@/lib/money'
import { parseDetails, type ScanDetails, type ScanRequest } from './details'

const SEND_EDGE = 1600 // px; plenty for the model, small enough to send on weak signal

/** A small JPEG of the photo (or the first PDF page is skipped: its text is enough). */
async function smallJpeg(blob: Blob, mime: string): Promise<string | null> {
  if (!mime.startsWith('image/')) return null
  try {
    const bmp = await createImageBitmap(blob)
    const scale = Math.min(1, SEND_EDGE / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1] ?? null
  } catch {
    return null
  }
}

/** Asks the server to pull out details. Needs signal; the on-phone text is never lost if this fails. */
export async function requestDetails(kind: ScanRequest['kind'], file: Blob | null, mime: string, text: string): Promise<ScanDetails> {
  if (!navigator.onLine) throw new Error('Connect to the internet to pull out details. The text is already saved on your phone.')
  const image = file ? await smallJpeg(file, mime) : null
  await ensureSession()
  const { data } = await supabase.auth.getSession()
  const response = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify({ kind, image, text: text.slice(0, 20_000) } satisfies ScanRequest),
    signal: AbortSignal.timeout(60_000),
  })
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) throw new Error('Reading details isn’t available on this server yet.')
  const body = (await response.json()) as { details?: unknown; error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Couldn’t read details. Try again.')
  const details = parseDetails(body.details)
  if (!details) throw new Error('Couldn’t find any details. You can fill them in yourself.')
  return details
}

/** "450.5" in GTQ → 45050; null if the amount or currency can't be used. */
export function detailsAmountMinor(d: Pick<ScanDetails, 'amount' | 'currency'>): number | null {
  if (d.amount == null || !d.currency) return null
  try {
    return Math.round(d.amount * 10 ** minorUnits(d.currency))
  } catch {
    return null
  }
}
