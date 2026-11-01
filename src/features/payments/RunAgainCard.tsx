// "Run this trip again" (Pro): a new trip with the same places, plan (shifted to the new dates),
// notes, packing list, open tasks, settings and a draft trip page. People, votes, money and tickets
// stay behind. Offered on a trip someone organizes, never as a banner.

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useDevice } from '@/data/device'
import { Button, Card, DateInput, ErrorNote, Field, Input, SectionTitle } from '@/ui'
import { cloneTrip } from './api'
import { ProBadge, useMyOrganizer } from './pro'

export function RunAgainCard({ tripId, tripName }: { tripId: string; tripName: string }) {
  const me = useMyOrganizer()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(() => tripName.replace(/\b(20\d\d)\b/, (y) => String(Number(y) + 1)))
  const [start, setStart] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (me && !me.pro) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const made = await cloneTrip(tripId, name.trim(), start)
      useDevice.getState().rememberTrip(made.trip_id, made.member_id)
      navigate(`/t/${made.trip_id}`)
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false) }
  }

  return (
    <Card>
      <SectionTitle>Run this trip again<ProBadge beta={me?.beta ?? true} /></SectionTitle>
      <p className="mt-1 text-sm text-muted">Copies places, the plan moved to your new dates, notes, the packing list, open tasks and a draft trip page. People, votes, money and tickets aren’t copied.</p>
      {!open ? <Button variant="secondary" className="mt-3 w-full" onClick={() => setOpen(true)}>Run it again</Button> : (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <Field label="New trip name"><Input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="First day"><DateInput required value={start} onValue={setStart} /></Field>
          <ErrorNote error={error} />
          <Button type="submit" variant="secondary" className="w-full" disabled={busy || !start || !name.trim()}>{busy ? 'Copying…' : 'Make the new trip'}</Button>
        </form>
      )}
    </Card>
  )
}
