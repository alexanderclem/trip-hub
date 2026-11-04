import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Search } from 'lucide-react'
import { can } from '@/data/access'
import { useTripAccess } from '@/data/device'
import { Dialog } from './Dialog'

const destinations = [
  ['overview', 'Trip home', 'overview group'], ['plan', 'Day-by-day plan', 'itinerary schedule'],
  ['map', 'Trip map', 'directions location'], ['more/vote', 'Group votes', 'poll decide'],
  ['tickets', 'Tickets & documents', 'files booking'], ['money', 'Shared expenses', 'money balances'],
  ['more/places', 'Saved places', 'ideas shortlist'], ['more/tasks', 'Tasks', 'checklist todo'],
  ['more/packing', 'Packing list', 'bag prepare'], ['more/settings', 'Settings & sharing', 'invite offline'],
] as const

export function CommandMenu({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const access = useTripAccess(tripId)
  const commands = useMemo(() => [
    ...destinations.map(([path, label, keywords]) => ({ path: `/t/${tripId}/${path}`, label, keywords })),
    ...(can(access, 'plan') ? [{ path: `/t/${tripId}/plan/new`, label: 'Add to plan', keywords: 'create activity event' }, { path: `/t/${tripId}/more/tasks/new`, label: 'Add a task', keywords: 'create todo' }] : []),
    ...(can(access, 'participate') ? [{ path: `/t/${tripId}/money/new`, label: 'Add an expense', keywords: 'create money cost' }] : []),
    { path: '/app', label: 'All your trips', keywords: 'switch home' }, { path: '/help', label: 'Help & contact', keywords: 'support shortcuts' },
  ], [tripId, access])
  const results = commands.filter((command) => `${command.label} ${command.keywords}`.toLowerCase().includes(query.trim().toLowerCase()))
  const active = Math.min(selected, Math.max(0, results.length - 1))
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.altKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]')
      const commandKey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (!commandKey && !(event.key === '/' && !event.metaKey && !event.ctrlKey && !typing)) return
      if (document.querySelector('dialog:modal')) return
      event.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  useEffect(() => { setOpen(false) }, [location.key])
  useEffect(() => {
    if (!open) { setQuery(''); setSelected(0); return }
    input.current?.focus()
  }, [open])
  useEffect(() => { if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' }) }, [active, open, listId])
  function choose(index: number) {
    const command = results[index]
    if (!command) return
    setOpen(false)
    navigate(command.path)
  }
  return <>
    <button type="button" className="ui-icon-button command-trigger" aria-label="Search trip commands" aria-keyshortcuts="Meta+K Control+K /" aria-haspopup="dialog" onClick={() => setOpen(true)}><Search aria-hidden="true" className="size-5" /><kbd className="shortcut-hint">⌘/Ctrl K</kbd></button>
    <Dialog open={open} onClose={() => setOpen(false)} title="Go anywhere in your trip">
      <label className="sr-only" htmlFor={`${listId}-search`}>Search trip commands</label>
      <input ref={input} id={`${listId}-search`} role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={results.length ? `${listId}-${active}` : undefined} autoComplete="off" placeholder="Try “tickets”, “tasks”, or “add”…" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0) }} className="command-input" onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSelected((value) => results.length ? (value + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length : 0) }
        else if (event.key === 'Enter') { event.preventDefault(); choose(active) }
      }} />
      <ul id={listId} role="listbox" aria-label="Trip commands" className="command-results">{results.map((command, index) => <li key={command.path} id={`${listId}-${index}`} role="option" aria-selected={index === active} onPointerMove={(event) => { if (event.pointerType === 'mouse') setSelected(index) }} onClick={() => choose(index)} className="command-option">{command.label}<span aria-hidden="true">↵</span></li>)}</ul>
      {!results.length && <p role="status" className="py-4 text-sm text-muted">No matching commands. Try “plan” or “tickets”.</p>}
      <p className="command-help"><span><kbd>↑</kbd> <kbd>↓</kbd> to browse · <kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span></p>
    </Dialog>
  </>
}
