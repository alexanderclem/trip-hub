import { useId } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { setAppearance, useAppearance } from './appearance'

const options = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
] as const

/** Native radios supply arrow-key navigation and a single tab stop. */
export function AppearancePicker({ showLabel = true }: { showLabel?: boolean }) {
  const name = useId()
  const appearance = useAppearance()
  return (
    <fieldset className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <legend className="sr-only">Appearance</legend>
      {showLabel && <span aria-hidden="true" className="text-sm text-muted">Appearance</span>}
      <div className="join gap-0.5 rounded-control border border-line bg-surface p-1">
        {options.map(({ value, label, Icon }) => (
          <label key={value} className="relative flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control px-2.5 text-sm text-muted has-checked:bg-mist has-checked:text-ink has-checked:font-semibold hover:bg-mist has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-action">
            <input className={`absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 ${value === 'system' ? '' : 'theme-controller'}`} type="radio" name={name} value={value === 'system' ? 'system' : `stowaway-${value}`} checked={appearance === value} onChange={() => setAppearance(value)} />
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
