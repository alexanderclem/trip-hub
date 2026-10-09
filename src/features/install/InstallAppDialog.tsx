import { useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router'
import { Share } from 'lucide-react'
import { Button, ErrorNote } from '@/ui'
import { Dialog } from '@/ui/Dialog'
import { consumeInstallPrompt, getInstallPrompt, isStandalone, mobilePlatform, subscribeInstallPrompt } from './installPrompt'

const dismissalKey = 'stowaway-install-dismissed'

function wasDismissed() {
  try { return sessionStorage.getItem(dismissalKey) === '1' }
  catch { return false }
}

export function InstallAppDialog() {
  const { pathname, hash } = useLocation()
  const { prompt, installed } = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt)
  const [dismissed, setDismissed] = useState(wasDismissed)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const platform = mobilePlatform()
  const open = pathname === '/app' && !!platform && !installed && !isStandalone() && !dismissed

  function dismiss() {
    setDismissed(true)
    try { sessionStorage.setItem(dismissalKey, '1') } catch { /* In-memory dismissal still works. */ }
    if (hash === '#join') {
      requestAnimationFrame(() => document.getElementById('trip-link')?.focus({ preventScroll: true }))
    }
  }

  async function install() {
    if (!prompt || busy) return
    setBusy(true)
    setError(null)
    // A captured browser event can only be used once, even if installation is declined.
    consumeInstallPrompt(prompt)
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') dismiss()
    } catch {
      setError('Installation couldn’t open. Use your browser’s menu to add Stowaway to your Home Screen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={dismiss} title="Take Stowaway with you">
      <div className="flex items-center gap-3">
        <img src="/apple-touch-icon.png" alt="" width="56" height="56" className="size-[56px] shrink-0 rounded-xl" />
        <p className="min-w-0 flex-1 wrap-anywhere text-base leading-relaxed text-stone-600">Add Stowaway to your Home Screen to open your trips with a tap.</p>
      </div>

      {platform === 'ios' ? (
        <ol className="mt-5 list-decimal space-y-3 pl-6 text-base text-stone-700">
          <li>Open this page in <strong>Safari</strong>.</li>
          <li>Tap <strong>Share</strong> <Share aria-hidden="true" className="inline size-4 align-text-bottom" /> in the browser menu. You may need to tap <strong>More (…)</strong> first.</li>
          <li>Choose <strong>Add to Home Screen</strong>. If shown, turn on <strong>Open as Web App</strong>, then tap <strong>Add</strong>.</li>
        </ol>
      ) : !prompt && !busy ? (
        <p className="mt-5 text-base leading-relaxed text-stone-700">Open your browser’s menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. If that option is missing, open this page in Chrome.</p>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-stone-600">Before you travel, use “Ready for offline” in your trip settings to save your essentials.</p>
      <div className="mt-4"><ErrorNote error={error} /></div>
      <div className="mt-5 flex flex-col gap-2">
        {platform !== 'ios' && (prompt || busy) && <Button type="button" onClick={() => void install()} disabled={busy} className="w-full">{busy ? 'Opening installation…' : 'Install Stowaway'}</Button>}
        <Button type="button" variant={prompt || busy ? 'secondary' : 'primary'} onClick={dismiss} className="w-full">Continue in browser</Button>
      </div>
    </Dialog>
  )
}
