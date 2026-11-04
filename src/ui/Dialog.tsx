import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useAnimate } from 'motion/react'
import { useMotionPreference } from './MotionProvider'
import { motionTiming } from './motion'
import { useSwipeDismiss } from './useSwipeDismiss'

function closeDialog(dialog: HTMLDialogElement, opener: HTMLElement | null) {
  dialog.close()
  // Navigation can remove the opener before dismissal finishes. Restore reading context.
  const remaining = document.querySelector('dialog:modal')
  if (opener?.isConnected && opener.getClientRects().length && !opener.matches(':disabled')) {
    if (!remaining || remaining.contains(opener)) opener.focus({ preventScroll: true })
    return
  }
  if (remaining) return
  const heading = document.querySelector<HTMLElement>('#trip-content h1, main h1')
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
}

/** Native modal behavior supplies focus containment, Escape, and focus restoration. */
export function Dialog({ open, onClose, title, children, dismissible = true, sheet = false }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; dismissible?: boolean; sheet?: boolean
}) {
  const titleId = useId()
  const [scope, animate] = useAnimate<HTMLDialogElement>()
  const requestedOpen = useRef(open)
  const opener = useRef<HTMLElement | null>(null)
  const reducedMotion = useMotionPreference()
  const swipe = useSwipeDismiss(onClose, open && sheet && dismissible)
  useLayoutEffect(() => {
    requestedOpen.current = open
    swipe.panel.current = scope.current
    if (open && !scope.current?.open) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }, [open, scope, swipe.panel])
  useEffect(() => {
    const dialog = scope.current
    if (!dialog) return
    let cancelled = false
    if (open) {
      const entering = !dialog.open
      delete dialog.dataset.closing
      if (entering) {
        dialog.style.translate = ''
        dialog.showModal()
      }
      const animation = animate(dialog, reducedMotion || !entering
        ? { opacity: 1, y: 0 }
        : { opacity: [0.8, 1], y: [8, 0] }, reducedMotion ? { duration: 0 } : motionTiming.enter)
      return () => animation.stop()
    }
    if (!dialog.open) return
    if (reducedMotion) { closeDialog(dialog, opener.current); return }
    dialog.dataset.closing = ''
    const animation = animate(dialog, { opacity: 0, y: 6 }, motionTiming.exit)
    void animation.then(() => {
      if (!cancelled && !requestedOpen.current && dialog.open) closeDialog(dialog, opener.current)
    })
    return () => { cancelled = true; animation.stop() }
  }, [open, reducedMotion, animate, scope])
  useEffect(() => {
    const dialog = scope.current
    return () => { if (dialog?.open) closeDialog(dialog, opener.current) }
  }, [scope])
  return (
    <dialog ref={scope} aria-labelledby={titleId} className={`ui-dialog${sheet ? ' ui-dialog-sheet' : ''}`} onCancel={(event) => { event.preventDefault(); if (dismissible) onClose() }} onClose={() => {
      // Ignore a queued close event if StrictMode has already reopened the dialog.
      if (!scope.current?.open && requestedOpen.current) onClose()
    }}>
      <div>
      {sheet && <div className="sheet-drag-handle" aria-hidden="true" {...swipe.handle}><span /></div>}
      <div className="flex items-start justify-between gap-4 border-b border-line pb-3">
        <h2 id={titleId} className="min-w-0 flex-1 wrap-anywhere pt-2 text-xl font-semibold text-ink">{title}</h2>
        <button type="button" onClick={onClose} disabled={!dismissible} aria-label="Close dialog" className="ui-icon-button shrink-0 disabled:opacity-40"><X aria-hidden="true" className="size-5" /></button>
      </div>
      <div className="pt-4">{children}</div>
      </div>
    </dialog>
  )
}
