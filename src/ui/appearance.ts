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
  const dark = appearance === 'dark' || (appearance === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'stowaway-dark' : 'stowaway-light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#10212a' : '#f7f9f9')
}

/** One app-wide listener keeps system changes and other tabs in sync. */
export function initializeAppearance() {
  applyAppearance()
  const media = matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', applyAppearance)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey && event.key !== null) return
    appearance = readAppearance()
    applyAppearance()
    listeners.forEach((listener) => listener())
  }
  window.addEventListener('storage', onStorage)
  return () => {
    media.removeEventListener('change', applyAppearance)
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
