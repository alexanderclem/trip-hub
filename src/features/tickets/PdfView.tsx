import { useEffect, useRef, useState } from 'react'

/**
 * Renders every page of a PDF to canvases with pdf.js (loaded on demand; precached for offline).
 * Opening blob PDFs in a new tab is unreliable in iPhone Home Screen apps, so we draw them ourselves.
 */
export function PdfView({ blob, title }: { blob: Blob; title: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ pages: number } | { error: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    const el = host.current!
    el.replaceChildren()
    ;(async () => {
      const [pdfjs, { default: workerUrl }] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ])
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
      if (cancelled) return
      setState({ pages: doc.numPages })
      const width = el.clientWidth || 360
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const page = await doc.getPage(n)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: (width / base.width) * dpr })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = '100%'
        canvas.className = 'rounded-lg bg-white shadow-sm'
        canvas.setAttribute('role', 'img')
        canvas.setAttribute('aria-label', `${title}, page ${n} of ${doc.numPages}`)
        el.appendChild(canvas)
        await page.render({ canvas, viewport }).promise
      }
    })().catch((e) => !cancelled && setState({ error: e instanceof Error ? e.message : String(e) }))
    return () => {
      cancelled = true
    }
  }, [blob, title])

  return (
    <div>
      {state && 'error' in state && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Couldn't show this PDF: {state.error}</p>}
      {!state && <p className="p-4 text-center text-sm text-stone-500">Opening…</p>}
      <div ref={host} className="space-y-3" />
    </div>
  )
}
