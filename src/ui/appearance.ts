import { useSyncExternalStore } from 'react'

export type Appearance = 'system' | 'light' | 'dark'
const storageKey = 'stowaway-appearance'
const listeners = new Set<() => void>()

function readAppearance(): Appearance {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

let appearance = readAppearance()

function applyAppearance() {
  const dark = appearanceMode() === 'dark'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#10262e' : '#f1f4f5')
}

function appearanceMode(): 'light' | 'dark' {
  return appearance === 'dark' || (appearance === 'system' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
}

/** One app-wide listener keeps system changes and other tabs in sync. */
export function initializeAppearance() {
  applyAppearance()
  const media = matchMedia('(prefers-color-scheme: dark)')
  const onSystemChange = () => { applyAppearance(); listeners.forEach((listener) => listener()) }
  media.addEventListener('change', onSystemChange)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey && event.key !== null) return
    appearance = readAppearance()
    applyAppearance()
    listeners.forEach((listener) => listener())
  }
  window.addEventListener('storage', onStorage)
  return () => {
    media.removeEventListener('change', onSystemChange)
    window.removeEventListener('storage', onStorage)
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function setAppearance(next: Appearance) {
  appearance = next
  try { localStorage.setItem(storageKey, next) } catch { /* The choice still works for this session. */ }
  applyAppearance()
  listeners.forEach((listener) => listener())
}

export function useAppearance() {
  return useSyncExternalStore(subscribe, () => appearance, () => 'system' as const)
}

/** Theme is the only runtime writer of html[data-theme]; first paint uses appearance.js. */
export function useAppearanceMode() {
  return useSyncExternalStore<'light' | 'dark' | 'system'>(subscribe, appearanceMode, () => 'system')
}
