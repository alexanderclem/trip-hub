import { useState } from 'react'
import { useConfirm } from '@/ui/ConfirmProvider'
import { supabase } from '@/lib/supabase'
import { Button, Card, ErrorNote, Field, Input, SectionTitle } from '@/ui'

export function CalendarFeedCard({ tripId }: { tripId: string }) {
  const confirm = useConfirm()
  const [url, setUrl] = useState(''), [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null), [message, setMessage] = useState('')
  async function change(revoke: boolean) {
    if (busy) return
    setBusy(true); setError(null); setMessage('')
    try {
      if (!navigator.onLine) throw new Error('Connect to the internet to manage your calendar link.')
      const { data, error } = await supabase.rpc(revoke ? 'revoke_calendar_feed' : 'create_calendar_feed', { p_trip_id: tripId })
      if (error) throw new Error('Could not update the calendar link. Try again when the server is available.')
      if (!revoke && (typeof data !== 'string' || !/^[a-f0-9]{64}$/.test(data))) throw new Error('Could not create a calendar link.')
      setUrl(revoke ? '' : `${location.origin}/api/calendar.ics?token=${data}`)
      setMessage(revoke ? 'Your calendar link has been disabled. Events already copied into a calendar may remain there.' : 'Your new link is ready. Any previous link for this trip and sign-in is disabled.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the link.') }
    finally { setBusy(false) }
  }
  return <Card><SectionTitle>Keep your calendar updated</SectionTitle>
    <p className="mt-2 text-sm text-muted">Subscribe in Apple Calendar, Google Calendar, or another calendar app. Includes shared plans and activities assigned to you. Your calendar app chooses when to refresh.</p>
    <p className="mt-2 text-sm text-muted">Anyone with this separate link can read event names, times, and locations. Notes, booking codes, documents, and the trip invite are excluded. Links expire after one year and stop working when trip access changes.</p>
    <div className="mt-3 space-y-3">
      <Button variant="secondary" disabled={busy} onClick={async () => {
        if (await confirm('Create a read-only calendar subscription link? Any previous link for this trip and sign-in will stop working.')) await change(false)
      }}>{busy ? 'Updating…' : 'Create or replace my calendar link'}</Button>
      {url && <><a className="btn btn-primary ui-button ui-button-primary min-h-11" href={url.replace(/^https?:/, 'webcal:')}>Subscribe on this phone</a>
        <Field label="Private calendar subscription URL"><Input readOnly value={url} onFocus={(e) => e.target.select()} /></Field>
        <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage('Calendar link copied. Add it as a calendar subscription.') } catch { setMessage('Select and copy the link above.') } }}>Copy calendar link</Button></>}
      <button type="button" disabled={busy} className="ui-link min-h-11 text-danger-ink" onClick={async () => {
        if (await confirm('Disable your calendar link? Your calendar will stop receiving updates. Events it already copied may remain.')) await change(true)
      }}>Disable my calendar link</button>
      <ErrorNote error={error} />{message && <p role="status" className="text-sm">{message}</p>}
    </div>
  </Card>
}
