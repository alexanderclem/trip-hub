import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Notice = { message: string; undo?: () => Promise<void>; undoLabel?: string }
type Toast = Notice & { id: number; busy?: boolean; error?: string }
const ToastContext = createContext<((notice: Notice) => void) | null>(null)

/** Actionable notices stay until dismissed, undone, or replaced by three newer notices. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const sequence = useRef(0)
  const locks = useRef(new Set<number>())
  const notify = useCallback((notice: Notice) => {
    const id = ++sequence.current
    setToasts((previous) => [...previous.slice(-2), { ...notice, id }])
  }, [])
  async function undo(toast: Toast) {
    if (!toast.undo || locks.current.has(toast.id)) return
    locks.current.add(toast.id)
    setToasts((previous) => previous.map((item) => item.id === toast.id ? { ...item, busy: true, error: undefined } : item))
    try {
      await toast.undo()
      setToasts((previous) => previous.map((item) => item.id === toast.id ? { id: item.id, message: 'Change undone on this device.' } : item))
    } catch (error) {
      setToasts((previous) => previous.map((item) => item.id === toast.id ? { ...item, busy: false, error: error instanceof Error ? error.message : 'Could not undo. Try again.' } : item))
    } finally { locks.current.delete(toast.id) }
  }
  return <ToastContext value={notify}>{children}<section className="ui-toast-region" aria-label="Recent changes" aria-relevant="additions text" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className="ui-toast"><div className="min-w-0 flex-1"><p>{toast.message}</p>{toast.error && <p className="mt-1 text-danger-ink">{toast.error}</p>}</div>{toast.undo && <button type="button" className="ui-button ui-button-ghost" aria-label={toast.undoLabel ?? `Undo: ${toast.message}`} disabled={toast.busy} onClick={() => void undo(toast)}>{toast.busy ? 'Undoing…' : 'Undo'}</button>}<button type="button" className="ui-icon-button shrink-0" aria-label={`Dismiss: ${toast.message}`} disabled={toast.busy} onClick={() => setToasts((previous) => previous.filter((item) => item.id !== toast.id))}><X aria-hidden="true" className="size-4" /></button></div>)}</section></ToastContext>
}

export function useToast() {
  const notify = useContext(ToastContext)
  if (!notify) throw new Error('useToast requires ToastProvider')
  return notify
}
