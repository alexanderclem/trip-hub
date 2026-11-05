import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { ItineraryItem, Place, Trip } from '@/data/types'
import type { LegContext } from '@/features/routing/legs'
import { MODE_LABEL, SOURCE_LABEL, formatRange } from '@/features/routing/legs'
import { Button, ErrorNote } from '@/ui'
import { Dialog } from '@/ui/Dialog'
import { useToast } from '@/ui/ToastProvider'
import { applyScheduleFix, scheduleFixes, scheduleTime, type ScheduleIssue } from './fixes'

export function ScheduleFixDialog({ issue, items, places, ctx, trip, zone, members, me, onClose }: {
  issue: ScheduleIssue; items: ItineraryItem[]; places: Place[]; ctx: LegContext; trip: Trip; zone: string; members: string[]; me: string | null; onClose: () => void
}) {
  // Freeze the reviewed schedule. New incoming edits are rejected when the preview is applied.
  const [snapshot] = useState(() => ({ issue, items, places, ctx, members, trip }))
  const choices = useMemo(() => scheduleFixes(snapshot.issue, snapshot.items, snapshot.places, snapshot.ctx, snapshot.trip.timezone, snapshot.members, { start: snapshot.trip.start_date, end: snapshot.trip.end_date }), [snapshot])
  const [selected, setSelected] = useState(() => choices.find((fix) => !fix.blocked)?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lock = useRef(false)
  const notify = useToast()
  const chosen = choices.find((fix) => fix.id === selected && !fix.blocked)
  const t = snapshot.issue.transfer
  return <Dialog open onClose={onClose} dismissible={!saving} title="Review schedule fixes">
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault()
      if (!chosen || lock.current) return
      lock.current = true; setSaving(true); setError(null)
      try {
        const undo = await applyScheduleFix(snapshot.issue, chosen, me)
        notify({ message: 'Schedule updated.', undo })
        onClose()
      } catch (error) { setError(error instanceof Error ? error.message : 'Could not save. Try again.'); lock.current = false; setSaving(false) }
    }}>
      <p className="break-words text-sm font-medium">{snapshot.issue.from.title} → {snapshot.issue.to.title}</p>
      {t && <p className="text-sm text-muted">{t.fromPlace.id === t.toPlace.id ? `${t.toPlace.name} · ${t.bufferS / 60} min check-in / waiting.` : `${MODE_LABEL[t.option.mode].label}: ${formatRange(t.option.minS, t.option.maxS)}${t.bufferS ? ` + ${t.bufferS / 60} min check-in / waiting` : ''}. ${SOURCE_LABEL[t.option.source]}.`}</p>}
      <p className="text-xs text-muted">Flights and plans with confirmation codes stay in place. Activity durations are preserved.</p>
      <p className="text-xs text-muted">Times shown in {zone.replaceAll('_', ' ')}.</p>
      <fieldset className="space-y-2" disabled={saving}>
        <legend className="mb-2 text-sm font-semibold">Choose a change</legend>
        {choices.map((fix) => <label key={fix.id} className="flex min-h-11 items-start gap-3 rounded-control border border-line p-3">
          <input type="radio" name="schedule-fix" className="ui-check mt-1 shrink-0" checked={selected === fix.id} disabled={!!fix.blocked} onChange={() => setSelected(fix.id)} />
          <span className="min-w-0 text-sm"><span className="block break-words font-medium">{fix.title}</span><span className="mt-1 block tabular-nums"><del>{scheduleTime(fix.preview.before[0]!, zone)}</del><span className="block">→ {scheduleTime(fix.preview.after[0]!, zone)}</span></span>{fix.blocked && <span className="mt-1 block text-warning-ink">{fix.blocked}</span>}</span>
        </label>)}
      </fieldset>
      {!choices.length && <p role="status" className="text-sm text-muted">{!snapshot.issue.from.end_at ? 'Add an end time to the earlier activity before calculating a fix.' : 'These plans are fixed bookings. Review their times or attendees manually.'}</p>}
      {chosen && <section aria-label="Schedule preview" className="schedule-preview"><h3 className="ui-section-title">After this change</h3><p className="mt-1 text-sm">Resolves this warning. No new overlaps or travel warnings in the saved plan.</p></section>}
      <div className="flex flex-wrap gap-x-4"><Link className="ui-link" to={`/t/${trip.id}/plan/${issue.from.id}/edit`}>Edit {issue.from.title}</Link><Link className="ui-link" to={`/t/${trip.id}/plan/${issue.to.id}/edit`}>Edit {issue.to.title}</Link></div>
      <ErrorNote error={error} />
      <Button type="submit" className="w-full" disabled={!chosen || saving}>{saving ? 'Saving…' : 'Apply this fix'}</Button>
    </form>
  </Dialog>
}
