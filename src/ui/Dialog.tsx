import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useAnimate } from 'motion/react'
import { useMotionPreference } from './MotionProvider'
import { motionTiming } from './motion'

/** Native modal behavior supplies focus containment, Escape, and focus restoration. */
export function Dialog({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const reducedMotion = useMotionPreference()
  useEffect(() => {
    const dialog = ref.current!
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    return () => { if (dialog.open) dialog.close() }
  }, [open])
  useEffect(() => {
    if (!open) return
    const animation = animate(scope.current, reducedMotion
      ? { opacity: 1, y: 0 }
      : { opacity: [0.8, 1], y: [10, 0] }, reducedMotion ? { duration: 0 } : motionTiming.enter)
    return () => animation.stop()
  }, [open, reducedMotion, animate, scope])
  return (
    <dialog ref={ref} aria-labelledby={titleId} className="ui-dialog" onCancel={onClose} onClose={() => {
      // Ignore a queued close event if StrictMode has already reopened the dialog.
      if (!ref.current?.open) onClose()
    }}>
      <div ref={scope}>
      <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-3">
        <h2 id={titleId} className="min-w-0 flex-1 wrap-anywhere pt-2 text-xl font-semibold text-brand-900">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close dialog" className="ui-icon-button shrink-0"><X aria-hidden="true" className="size-5" /></button>
      </div>
      <div className="pt-4">{children}</div>
      </div>
    </dialog>
  )
}
