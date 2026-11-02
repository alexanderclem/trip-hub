import type { KeyboardEvent } from 'react'

/**
 * Pasta UI's Follow-up Suggestions keyboard pattern, adapted to native action buttons.
 * https://pastaui.com/r/follow-up-suggestions.json (MIT)
 * Retains Stowaway's compact reply row without a second component runtime.
 */
export function ReplySuggestions<T extends { id: string; label: string }>({ items, disabled, onPick }: {
  items: T[]; disabled?: boolean; onPick: (item: T) => void
}) {
  if (!items.length) return null

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (current < 0 || !buttons.length) return
    event.preventDefault()
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const forward = event.key === 'ArrowDown' || event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (forward ? 1 : -1) + buttons.length) % buttons.length
    buttons[index]?.focus({ preventScroll: true })
    buttons[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  return (
    <div role="group" aria-label="Suggested replies" onKeyDown={navigate} className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1">
      {items.map((item) => (
        <button key={item.id} type="button" disabled={disabled} onClick={() => onPick(item)} className="btn btn-outline min-h-11 h-auto shrink-0 rounded-control border-control bg-surface px-4 py-2 text-sm font-medium whitespace-nowrap text-ink shadow-none hover:bg-mist disabled:opacity-60">
          {item.label}
        </button>
      ))}
    </div>
  )
}
