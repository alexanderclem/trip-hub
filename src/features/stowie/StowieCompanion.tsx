import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { RotateCcw, X } from 'lucide-react'
import { usePlace } from '@/data/hooks'
import { screenOf } from './screen'
import { Stowie } from './Stowie'
import { StowieChat } from './StowieChat'

/** True while a finger or the mouse is down on the map, so Stowie can step aside for the drag. */
function useMapDrag(active: boolean) {
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    if (!active) { setDragging(false); return }
    const down = (e: PointerEvent) => { if (e.target instanceof Element && e.target.closest('.maplibregl-canvas-container')) setDragging(true) }
    const up = () => setDragging(false)
    document.addEventListener('pointerdown', down)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
    }
  }, [active])
  return dragging
}

/**
 * Stowie on every trip tab: a small button in the corner that opens the trip's conversation in a
 * sheet, with suggestions that fit the screen underneath. It is the same thread as More → Trip ideas.
 */
export function StowieCompanion({ tripId }: { tripId: string }) {
  const { pathname } = useLocation()
  const here = screenOf(pathname)
  const place = usePlace(here?.placeId)
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const dragging = useMapDrag(here?.screen === 'map')

  // Following a link from the chat goes to that screen, so the sheet gets out of the way.
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
    return () => { if (el.open) el.close() }
  }, [open])

  if (!here) return null
  return (
    <>
      {!open && (
        <button
          type="button" aria-label="Ask Stowie" onClick={() => setOpen(true)}
          className={`fixed left-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-10 flex size-14 items-center justify-center rounded-2xl border border-stone-200 bg-surface shadow-md transition-opacity duration-150 hover:bg-brand-50 lg:left-[17rem] lg:bottom-6 ${dragging ? 'pointer-events-none opacity-0' : ''}`}
        >
          <Stowie size={38} />
        </button>
      )}
      <dialog ref={dialog} aria-label="Stowie" className="stowie-sheet" onCancel={() => setOpen(false)} onClose={() => { if (!dialog.current?.open) setOpen(false) }}>
        {open && (
          <StowieChat tripId={tripId} screen={here.screen} subject={place?.name ?? null} sheet header={(restart) => (
            <div className="flex min-h-14 shrink-0 items-center gap-1 border-b border-stone-200 py-1 pl-5 pr-2">
              <h2 className="min-w-0 flex-1 text-xl font-semibold text-brand-900">Stowie</h2>
              <button type="button" className="ui-icon-button" aria-label="Start a new chat" onClick={restart}><RotateCcw aria-hidden="true" className="size-5" /></button>
              <button type="button" className="ui-icon-button" aria-label="Close Stowie" onClick={() => setOpen(false)}><X aria-hidden="true" className="size-5" /></button>
            </div>
          )} />
        )}
      </dialog>
    </>
  )
}
