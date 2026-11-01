// /unsubscribe#t=… : one tap stops an organizer's campaign emails. No sign-in; the token stays in the
// URL fragment. Booking emails (receipts, reminders) are separate and keep coming.

import { useState } from 'react'
import { WebsiteFrame } from '@/features/website/WebsiteFrame'
import { tokenFromHash, unsubscribe } from './api'

export function UnsubscribeScreen() {
  const [token] = useState(() => tokenFromHash(location.hash))
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    if (!token) return
    setBusy(true); setError(null)
    try { setDone((await unsubscribe(token)).organizer) } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  return (
    <WebsiteFrame>
      <section className="marketing-hero website-container" aria-labelledby="page-title">
        <h1 id="page-title">{done ? 'You’re unsubscribed' : 'Stop trip emails'}</h1>
        <div className="mt-6 max-w-2xl space-y-6">
          {!token ? <p>This link is incomplete. Use the unsubscribe link at the end of the email.</p>
            : done ? <p role="status">{done} won’t email you about future trips any more. Emails about a trip you’ve booked (receipts and payment reminders) still arrive.</p>
            : <>
              <p>Stop emails about future trips from this organizer. Emails about a trip you’ve booked still arrive.</p>
              <button type="button" className="website-button website-button-primary" disabled={busy} onClick={() => void go()}>{busy ? 'Unsubscribing…' : 'Unsubscribe'}</button>
            </>}
          {error && <p role="alert" className="marketing-status">{error}</p>}
        </div>
      </section>
    </WebsiteFrame>
  )
}
