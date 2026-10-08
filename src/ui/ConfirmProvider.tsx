import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/ui'
import { Dialog } from './Dialog'

type Confirm = (message: string) => Promise<boolean>
const ConfirmContext = createContext<Confirm | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const resolver = useRef<((answer: boolean) => void) | null>(null)
  const finish = useCallback((answer: boolean) => {
    resolver.current?.(answer)
    resolver.current = null
    setMessage(null)
  }, [])
  const confirm = useCallback<Confirm>((text) => new Promise((resolve) => {
    resolver.current?.(false)
    resolver.current = resolve
    setMessage(text)
  }), [])
  useEffect(() => () => { resolver.current?.(false) }, [])
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={message !== null} onClose={() => finish(false)} title="Confirm this change">
        <p className="break-words leading-relaxed text-stone-700">{message}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => finish(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => finish(true)}>Confirm change</Button>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm requires ConfirmProvider')
  return confirm
}
