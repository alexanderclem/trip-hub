import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { Link } from 'react-router'
import type { Trip } from '@/data/types'
import { dateRange } from '@/lib/time'

/**
 * The desktop rail's trip picker. A native <select> clipped long names and, in Safari, ignored our
 * min-height, so this is a small listbox built on the same tokens (no component library).
 * Keyboard: Enter/Space/↓ opens, ↑/↓/Home/End move, Enter picks, Escape or Tab closes.
 */
export function TripSwitcher({ current, currentName, trips, onPick }: {
  current: string
  currentName: string
  trips: Pick<Trip, 'id' | 'name' | 'start_date' | 'end_date'>[]
  onPick: (tripId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const id = useId()
  const options = trips.some((trip) => trip.id === current) ? trips : [{ id: current, name: currentName, start_date: null, end_date: null }, ...trips]
  const selected = options.find((trip) => trip.id === current)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const show = () => { setActive(Math.max(0, options.findIndex((trip) => trip.id === current))); setOpen(true); requestAnimationFrame(() => list.current?.focus()) }
  const pick = (tripId: string) => { setOpen(false); button.current?.focus(); if (tripId !== current) onPick(tripId) }
  const onButtonKey = (event: KeyboardEvent) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show() } }
  const onListKey = (event: KeyboardEvent) => {
    const last = options.length - 1
    const move: Record<string, number> = { ArrowDown: Math.min(active + 1, last), ArrowUp: Math.max(active - 1, 0), Home: 0, End: last }
    if (event.key in move) { event.preventDefault(); setActive(move[event.key]!) }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); const trip = options[active]; if (trip) pick(trip.id) }
    else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); button.current?.focus() }
    else if (event.key === 'Tab') setOpen(false)
  }

  return <div ref={root} className="relative">
    <p id={`${id}-label`} className="text-xs font-semibold text-muted">Your trips</p>
    <button ref={button} type="button" aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${id}-label ${id}-value`}
      onClick={() => (open ? setOpen(false) : show())} onKeyDown={onButtonKey}
      className="trip-switcher mt-2 flex min-h-11 w-full min-w-0 items-center gap-2 rounded-control border border-control bg-surface px-3 py-2 text-left text-ink hover:bg-mist">
      <span className="min-w-0 flex-1">
        <span id={`${id}-value`} className="block truncate font-semibold" title={selected?.name ?? currentName}>{selected?.name ?? currentName}</span>
        {selected && dateRange(selected.start_date, selected.end_date) && <span className="block truncate text-xs text-muted">{dateRange(selected.start_date, selected.end_date)}</span>}
      </span>
      <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted" />
    </button>
    {open && <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-surface border border-ink/10 bg-surface shadow-lg">
      <ul ref={list} role="listbox" tabIndex={-1} aria-labelledby={`${id}-label`} aria-activedescendant={`${id}-${active}`} onKeyDown={onListKey}
        className="max-h-72 overflow-y-auto overscroll-contain py-1 outline-none">
        {options.map((trip, index) => {
          const range = dateRange(trip.start_date, trip.end_date)
          const isCurrent = trip.id === current
          return <li key={trip.id} id={`${id}-${index}`} data-index={index} role="option" aria-selected={isCurrent}
            onPointerEnter={() => setActive(index)} onClick={() => pick(trip.id)}
            className={`flex min-h-11 cursor-pointer items-start gap-2 px-3 py-2 ${index === active ? 'bg-mist' : ''}`}>
            <span className="min-w-0 flex-1">
              {/* Long names wrap to two lines here instead of being cut. */}
              <span className="line-clamp-2 font-medium text-ink wrap-anywhere">{trip.name}</span>
              {range && <span className="block text-xs text-muted">{range}</span>}
            </span>
            {isCurrent && <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-action" />}
          </li>
        })}
      </ul>
      <Link to="/app" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 border-t border-line px-3 text-sm font-medium text-muted hover:bg-mist hover:text-ink">
        <Plus aria-hidden="true" className="size-4" />All trips and new trip
      </Link>
    </div>}
  </div>
}
