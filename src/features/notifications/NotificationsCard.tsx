import { useState } from 'react'
import { BellOff, BellRing } from 'lucide-react'
import { useDevice, useMyMemberId, type PushPrefs } from '@/data/device'
import { Button, Card, ErrorNote } from '@/ui'
import { DEFAULT_PREFS, disablePush, pushSupport, savePush } from './push'
import { publishReminders } from './reminders'

const KINDS: { key: keyof PushPrefs; label: string; hint: string }[] = [
  { key: 'leave', label: 'Time to leave', hint: 'Before plans you’re going to, using travel times' },
  { key: 'vote', label: 'Votes', hint: 'New votes, and a reminder if you haven’t voted' },
  { key: 'expense', label: 'Expenses', hint: 'When someone logs one that includes you' },
  { key: 'task', label: 'Tasks', hint: 'When you’re given one, and on the day it’s due' },
]

/** Settings card: turn this trip's push notifications on or off on this phone. */
export function NotificationsCard({ tripId }: { tripId: string }) {
  const me = useMyMemberId(tripId)
  const setting = useDevice((s) => s.push[tripId])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const support = pushSupport()
  const prefs = setting?.prefs ?? DEFAULT_PREFS

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'Could not change notifications. Try again.') }
    finally { setBusy(false) }
  }
  const turnOn = () => run(async () => { await savePush(tripId, me, prefs); await publishReminders(tripId) })
  const toggle = (key: keyof PushPrefs) => run(async () => { await savePush(tripId, me, { ...prefs, [key]: !prefs[key] }); if (key === 'leave') await publishReminders(tripId) })

  return (
    <Card>
      <h2 className="font-semibold">Notifications</h2>
      {support === 'install' ? (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          On iPhone, notifications only work in the Home Screen app. In Safari tap Share → Add to Home Screen, open Stowaway from there, then come back here.
        </p>
      ) : support === 'unsupported' ? (
        <p className="mt-2 text-sm text-stone-500">This browser can’t receive notifications.</p>
      ) : support === 'blocked' && !setting ? (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Notifications are blocked for Stowaway. Allow them in your phone’s Settings → Notifications (or the browser’s site settings), then come back here.</p>
      ) : !setting ? (
        <>
          <p className="mt-1 text-sm text-stone-500">Get a nudge when it’s time to leave, when there’s a new vote, and when an expense or task involves you. Needs signal to arrive.</p>
          <Button className="mt-3 flex w-full items-center justify-center gap-2" disabled={busy || !me} onClick={() => void turnOn()}>
            <BellRing aria-hidden="true" className="size-4" /> {busy ? 'Turning on…' : 'Turn on notifications'}
          </Button>
          {!me && <p className="mt-2 text-xs text-stone-500">Choose who you are in this trip first.</p>}
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-stone-500">On for this trip on this phone.</p>
          <fieldset disabled={busy} className="mt-3 space-y-1">
            <legend className="sr-only">What to be notified about</legend>
            {KINDS.map((k) => (
              <label key={k.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-1 py-1 hover:bg-stone-50">
                <input type="checkbox" checked={prefs[k.key]} onChange={() => void toggle(k.key)} className="size-5 shrink-0 accent-brand-700" />
                <span><span className="block text-sm font-medium">{k.label}</span><span className="block text-xs text-stone-500">{k.hint}</span></span>
              </label>
            ))}
          </fieldset>
          <Button variant="secondary" className="mt-3 flex w-full items-center justify-center gap-2" disabled={busy} onClick={() => void run(() => disablePush(tripId))}>
            <BellOff aria-hidden="true" className="size-4" /> Turn off for this trip
          </Button>
        </>
      )}
      <ErrorNote error={error} />
    </Card>
  )
}
