import { useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Share } from 'lucide-react'
import { Button, ErrorNote } from '@/ui'
import { Dialog } from '@/ui/Dialog'
import { consumeInstallPrompt, getInstallPrompt, isStandalone, mobilePlatform, subscribeInstallPrompt } from './installPrompt'

/** Installation is always an explicit choice, never a gate before creating or joining. */
export function InstallAppButton() {
  const [params] = useSearchParams()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const { installed } = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt)
  if (!mobilePlatform() || installed || isStandalone()) return null
  return <button type="button" className="ui-link" onClick={() => {
    const next = new URLSearchParams(params)
    next.set('install', '1')
    void navigate({ search: `?${next}`, hash }, { replace: true, preventScrollReset: true })
  }}>Add to Home Screen</button>
}

export function InstallAppDialog() {
  const [params] = useSearchParams()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const { prompt, installed } = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const platform = mobilePlatform()
  const open = params.get('install') === '1' && !!platform && !installed && !isStandalone()

  function dismiss() {
    const next = new URLSearchParams(params)
    next.delete('install')
    void navigate({ search: next.size ? `?${next}` : '', hash }, { replace: true, preventScrollReset: true })
    setError(null)
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
