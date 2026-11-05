import { useMemo, useRef, useState } from 'react'
import { DateTime } from 'luxon'
import type { ItineraryItem } from '@/data/types'
import { Button, DateInput, ErrorNote, Field, Input } from '@/ui'
import { Dialog } from '@/ui/Dialog'
import { useToast } from '@/ui/ToastProvider'
import { applySchedule, previewSchedule } from './reschedule'

export function RescheduleDialog({ item, items, zone, me, onClose, onSaved }: { item: ItineraryItem; items: ItineraryItem[]; zone: string; me: string | null; onClose: () => void; onSaved: (day: string) => void }) {
  const [date, setDate] = useState(item.start_local.slice(0, 10))
  const [time, setTime] = useState(item.start_local.slice(11, 16))
  const [later, setLater] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lock = useRef(false)
  const notify = useToast()
  const result = useMemo(() => {
    try { return { preview: previewSchedule(items, item.id, date, time, later, zone), error: null } }
    catch (error) { return { preview: null, error: error instanceof Error ? error.message : 'Invalid time.' } }
  }, [items, item.id, date, time, later, zone])
  const changed = date !== item.start_local.slice(0, 10) || !item.all_day && time !== item.start_local.slice(11, 16)
  const label = (value: ItineraryItem) => value.all_day ? `${value.start_local.slice(0, 10)} · All day` : DateTime.fromISO(value.start_at, { zone: 'utc' }).setZone(value.start_tz).toFormat('ccc d LLL, HH:mm ZZZZ')
  return <Dialog open onClose={onClose} dismissible={!saving} title="Reschedule">
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault()
      if (lock.current || !result.preview || !changed) return
      lock.current = true; setSaving(true); setError(null)
      try {
        const undo = await applySchedule(result.preview, me)
        notify({ message: result.preview.after.length === 1 ? 'Item rescheduled.' : `${result.preview.after.length} items rescheduled.`, undo })
        onSaved(DateTime.fromISO(result.preview.after[0]!.start_at, { zone: 'utc' }).setZone(zone).toISODate()!)
        onClose()
      } catch (error) { setError(error instanceof Error ? error.message : 'Could not save.'); lock.current = false; setSaving(false) }
    }}>
      <Field label="Date"><DateInput value={date} onValue={setDate} required disabled={saving} /></Field>
      {!item.all_day && <Field label={`Start time · ${item.start_tz.replaceAll('_', ' ')}`}><Input type="time" value={time} onChange={event => setTime(event.target.value)} required disabled={saving} /></Field>}
      {!item.all_day && <label className="flex min-h-11 items-center gap-3 text-sm"><input className="ui-check" type="checkbox" checked={later} onChange={event => setLater(event.target.checked)} disabled={saving} />Shift later activities on this day</label>}
      {result.preview && <section aria-label="Schedule preview" className="schedule-preview"><h3 className="ui-section-title">Changes</h3><ul>{result.preview.after.map((next, index) => <li key={next.id}><strong>{next.title}</strong><span><del>{label(result.preview!.before[index]!)}</del> → {label(next)}</span></li>)}</ul></section>}
      {result.preview && result.preview.conflicts > 0 && <p role="status" className="text-sm text-warning-ink">{result.preview.conflicts} overlapping {result.preview.conflicts === 1 ? 'pair' : 'pairs'} after this change.</p>}
      {(error || result.error) && <ErrorNote error={error ?? result.error} />}
      <Button type="submit" className="w-full" disabled={saving || !changed || !result.preview}>{saving ? 'Saving…' : 'Save changes'}</Button>
    </form>
  </Dialog>
}
