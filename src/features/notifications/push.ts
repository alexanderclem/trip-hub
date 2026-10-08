// Turning push notifications on and off for one trip on this phone. The browser subscription is
// shared by every trip; the server keeps one row per (phone, trip) with what to send.
// Everything here needs signal: notifications are sent by the server.

import { useDevice, type PushPrefs } from '@/data/device'
import { ensureSession, supabase } from '@/lib/supabase'
import { isIOS, isStandalone } from '@/features/map/offline/OfflineMapCard'

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''

export const DEFAULT_PREFS: PushPrefs = { leave: true, vote: true, expense: true, task: true, comment: true }

export type PushSupport = 'ok' | 'install' | 'unsupported' | 'blocked'

/** Can this phone get notifications right now? iPhones need the Home Screen app (iOS 16.4+). */
export function pushSupport(): PushSupport {
  if (isIOS() && !isStandalone()) return 'install'
  if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  return 'ok'
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function browserSubscription(prompt: boolean): Promise<PushSubscription> {
  if (prompt && Notification.permission !== 'granted') {
    // Must run straight from a tap on iPhone.
    const result = await Notification.requestPermission()
    if (result !== 'granted') throw new Error(result === 'denied' ? 'Notifications are blocked. Allow them in Settings → Notifications → Stowaway.' : 'Notifications weren’t allowed.')
  }
  const reg = await navigator.serviceWorker.ready
  return (await reg.pushManager.getSubscription()) ?? reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) })
}

/** Turns notifications on for this trip (asking permission if needed) or saves new preferences. */
export async function savePush(tripId: string, memberId: string | null, prefs: PushPrefs): Promise<void> {
  if (!memberId) throw new Error('Choose who you are in this trip first.')
  if (!navigator.onLine) throw new Error('Connect to the internet to change notifications.')
  const sub = await browserSubscription(true)
  const json = sub.toJSON()
  await ensureSession()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_trip_id: tripId, p_member_id: memberId, p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '', p_auth: json.keys?.auth ?? '', p_prefs: prefs,
  })
  if (error) throw new Error(error.message)
  useDevice.getState().setPush(tripId, { endpoint: sub.endpoint, prefs })
}

/** Stops notifications for this trip. The browser subscription stays for any other trips. */
export async function disablePush(tripId: string): Promise<void> {
  const setting = useDevice.getState().push[tripId]
  if (!setting) return
  if (!navigator.onLine) throw new Error('Connect to the internet to turn notifications off.')
  await ensureSession()
  const { error } = await supabase.rpc('disable_push_subscription', { p_trip_id: tripId, p_endpoint: setting.endpoint })
  if (error) throw new Error(error.message)
  useDevice.getState().setPush(tripId, null)
  const others = Object.keys(useDevice.getState().push).length
  if (!others) await (await navigator.serviceWorker.ready).pushManager.getSubscription().then((s) => s?.unsubscribe())
}
