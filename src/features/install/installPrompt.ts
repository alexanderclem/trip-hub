export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function mobilePlatform(): 'ios' | 'android' | null {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(navigator.userAgent)) return 'android'
  return null
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && navigator.standalone === true)
}

let snapshot: { prompt: InstallPromptEvent | null; installed: boolean } = { prompt: null, installed: false }
const listeners = new Set<() => void>()
let initialized = false

function update(next: typeof snapshot) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

// Capture the browser event before React renders or a lazy app route finishes loading.
export function initializeInstallPrompt() {
  if (initialized) return
  initialized = true
  snapshot = { prompt: null, installed: isStandalone() }
  if (!mobilePlatform()) return
  window.addEventListener('beforeinstallprompt', (event) => {
    if (snapshot.installed || isStandalone()) return
    event.preventDefault()
    update({ prompt: event as InstallPromptEvent, installed: false })
  })
  window.addEventListener('appinstalled', () => update({ prompt: null, installed: true }))
  window.matchMedia('(display-mode: standalone)').addEventListener('change', () => {
    if (isStandalone()) update({ prompt: null, installed: true })
  })
}

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const getInstallPrompt = () => snapshot

export function consumeInstallPrompt(event: InstallPromptEvent) {
  if (snapshot.prompt === event) update({ ...snapshot, prompt: null })
}
