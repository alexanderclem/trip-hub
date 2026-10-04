// Reading the text in a ticket, receipt or document, on the phone (works offline once the text
// reader has been downloaded). PDFs with a text layer are read directly with pdf.js; photos and
// scanned PDFs go through Tesseract OCR. Tesseract's worker and wasm core ship with the app; the
// language data comes from jsDelivr. The service worker keeps the core and language data in the
// "ocr-assets" cache (vite.config.ts), filled on first use or by prepareTextReader().

import type { Trip } from '@/data/types'

export const MAX_TEXT = 20_000
const OCR_EDGE = 2000 // px; enough for receipts, fast on a phone
const PDF_OCR_PAGES = 3

export type TextSource = 'pdf' | 'ocr'
export const readerKey = (langs: string[]) => `ocr-reader:v1:${langs.join('+')}`
export async function readerAssets(langs: string[]) {
  const [{ default: worker }, { default: core }] = await Promise.all([
    import('tesseract.js/dist/worker.min.js?url'),
    import('tesseract.js-core/tesseract-core-lstm.wasm.js?url'),
  ])
  return { worker, core, urls: [worker, core, ...langs.map((lang) => `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`)] }
}

/** OCR languages for a trip: trips.settings.ocr_langs, else English + Spanish. */
export function ocrLangs(trip: Pick<Trip, 'settings'> | undefined): string[] {
  const raw = trip?.settings?.ocr_langs
  const langs = Array.isArray(raw) ? raw.filter((l): l is string => typeof l === 'string' && /^[a-z_]{3,8}$/.test(l)) : []
  return langs.length ? langs : ['eng', 'spa']
}

/** Collapses OCR noise: trims lines, drops empty runs, caps the length. */
export function tidyText(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l, i, all) => l || (i > 0 && all[i - 1]))
    .join('\n')
    .trim()
    .slice(0, MAX_TEXT)
}

async function loadPdf(blob: Blob) {
  const [pdfjs, { default: workerUrl }] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
}

async function toCanvasImage(source: ImageBitmap | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const w = source.width
  const h = source.height
  const scale = Math.min(1, OCR_EDGE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

let workerPromise: Promise<import('tesseract.js').Worker> | null = null
let workerLangs = ''
let progressListener: ((p: number) => void) | undefined

async function ocrWorker(langs: string[], onProgress?: (p: number) => void) {
  const key = langs.join('+')
  if (!workerPromise || workerLangs !== key) {
    if (workerPromise) void workerPromise.then((w) => w.terminate()).catch(() => {})
    workerLangs = key
    workerPromise = Promise.all([import('tesseract.js'), readerAssets(langs)]).then(([{ createWorker }, assets]) =>
      createWorker(langs, 1, {
        workerPath: assets.worker,
        corePath: assets.core,
        logger: (m) => {
          if (m.status === 'recognizing text') progressListener?.(m.progress)
        },
      }),
    )
    workerPromise.catch(() => { workerPromise = null })
  }
  progressListener = onProgress
  return workerPromise
}

async function ocrCanvas(canvas: HTMLCanvasElement, langs: string[], onProgress?: (p: number) => void): Promise<string> {
  const worker = await ocrWorker(langs, onProgress)
  const { data } = await worker.recognize(canvas)
  return data.text
}

/**
 * Text from a file. PDFs use their own text when they have some (fast, exact); photos and
 * scanned PDFs use OCR. Throws if the text reader can't load (offline before it was downloaded).
 */
export async function extractText(blob: Blob, mime: string, langs: string[], onProgress?: (p: number) => void): Promise<{ text: string; source: TextSource }> {
  if (mime === 'application/pdf') {
    const doc = await loadPdf(blob)
    const parts: string[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent()
      parts.push(content.items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : ' ') : '')).join(''))
    }
    const text = tidyText(parts.join('\n\n'))
    if (text.replace(/\s/g, '').length >= 20) return { text, source: 'pdf' }
    // A scanned PDF: OCR the first pages.
    const pages: string[] = []
    for (let n = 1; n <= Math.min(doc.numPages, PDF_OCR_PAGES); n++) {
      const page = await doc.getPage(n)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      await page.render({ canvas, viewport }).promise
      pages.push(await ocrCanvas(await toCanvasImage(canvas), langs, (p) => onProgress?.((n - 1 + p) / Math.min(doc.numPages, PDF_OCR_PAGES))))
    }
    return { text: tidyText(pages.join('\n\n')), source: 'ocr' }
  }
  if (!mime.startsWith('image/')) throw new Error('Only photos and PDFs can be read.')
  const bitmap = await createImageBitmap(blob)
  return { text: tidyText(await ocrCanvas(await toCanvasImage(bitmap), langs, onProgress)), source: 'ocr' }
}

/** Downloads the text reader and language data so scanning works offline later. */
export async function prepareTextReader(langs: string[]): Promise<void> {
  const { db } = await import('@/data/db')
  await db._meta.delete(readerKey(langs))
  if (!navigator.serviceWorker?.controller) throw new Error('Reopen Stowaway online before preparing scanning.')
  const assets = await readerAssets(langs)
  const cache = await caches.open('ocr-assets')
  for (const url of assets.urls) {
    if (await cache.match(url)) continue
    const response = await fetch(url)
    if (!response.ok) throw new Error('Could not download the text reader. Try again on Wi-Fi.')
    await cache.put(url, response)
  }
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 32
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 64, 32)
  await ocrCanvas(canvas, langs)
  await db._meta.put({ key: readerKey(langs), value: JSON.stringify({ version: 1, urls: assets.urls, preparedAt: new Date().toISOString() }) })
}
