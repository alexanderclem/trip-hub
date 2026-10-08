import { registerSW } from 'virtual:pwa-register'

let started = false

/** Download the full offline app when a traveler enters it, not on a marketing visit. */
export function prepareOfflineApp() {
  if (started || !('serviceWorker' in navigator)) return
  started = true
  // Preserve automatic update/reload recovery when a deployment replaces lazy chunks.
  registerSW({ immediate: true, onRegisterError: () => { started = false } })
}
