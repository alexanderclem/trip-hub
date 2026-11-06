import { useState } from 'react'
import { DateTime, Info } from 'luxon'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Pick a trip's start and end on one calendar: tap the first day, then the last.
 * A third tap starts a new range. Two months show side by side when there is room.
 * Dates are 'yyyy-MM-dd' strings, like the rest of the app; '' means not chosen.
 */
export function DateRangePicker({ start, end, onChange, min, label = 'Trip dates', fixedLength }: {
  start: string
  end: string
  onChange(start: string, end: string): void
  min?: string
  label?: string
  /** When the length is already decided (a drafted itinerary), one tap picks the whole range. */
  fixedLength?: number
}) {
  const today = DateTime.local().startOf('day')
  const [month, setMonth] = useState(() => (start ? DateTime.fromISO(start) : today).startOf('month'))
  const [hover, setHover] = useState<string | null>(null)
  const firstDay = weekStart()

  function pick(day: string) {
    if (fixedLength) return onChange(day, DateTime.fromISO(day).plus({ days: fixedLength - 1 }).toISODate()!)
    if (!start || end) return onChange(day, '')
    if (day < start) return onChange(day, '')
    onChange(start, day)
  }

  // While choosing the end, show the range up to the day under the pointer.
  const previewEnd = start && !end && hover && hover >= start ? hover : end
  const nights = start && end ? Math.round(DateTime.fromISO(end).diff(DateTime.fromISO(start), 'days').days) : null
  const show = (d: string) => DateTime.fromISO(d).toFormat('ccc d LLL')

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-brand-50 px-3 py-2 text-sm" aria-live="polite">
        <span>
          {!start ? <span className="text-muted">{fixedLength ? 'Tap the day you arrive' : 'Tap the first day of the trip'}</span>
            : !end ? <><strong>{show(start)}</strong><span className="text-muted"> → now tap the last day</span></>
            : <><strong>{show(start)} → {show(end)}</strong><span className="text-muted"> · {nights === 0 ? 'day trip' : `${nights} ${nights === 1 ? 'night' : 'nights'}`}</span></>}
        </span>
        {start && <button type="button" onClick={() => onChange('', '')} className="min-h-9 font-medium text-action underline">Clear</button>}
      </div>
      <div className="flex items-center justify-between">
        <button type="button" className="ui-icon-button" aria-label="Previous month" onClick={() => setMonth((m) => m.minus({ months: 1 }))}><ChevronLeft aria-hidden="true" className="size-5" /></button>
        <button type="button" onClick={() => setMonth(today.startOf('month'))} className="min-h-9 text-sm text-muted hover:text-action">Today</button>
        <button type="button" className="ui-icon-button" aria-label="Next month" onClick={() => setMonth((m) => m.plus({ months: 1 }))}><ChevronRight aria-hidden="true" className="size-5" /></button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2" onPointerLeave={() => setHover(null)}>
        {[month, month.plus({ months: 1 })].map((m, i) => (
          <Month key={m.toISODate()} month={m} firstDay={firstDay} className={i ? 'hidden sm:block' : ''}
            start={start} end={previewEnd} min={min} today={today.toISODate()!} onPick={pick} onHover={setHover} />
        ))}
      </div>
    </div>
  )
}

function weekStart(): number {
  try { return Info.getStartOfWeek() } catch { return 7 }
}

function Month({ month, firstDay, start, end, min, today, onPick, onHover, className }: {
  month: DateTime; firstDay: number; start: string; end: string; min?: string; today: string
  onPick(day: string): void; onHover(day: string): void; className?: string
}) {
  const lead = (month.weekday - firstDay + 7) % 7
  const days = Array.from({ length: month.daysInMonth! }, (_, i) => month.plus({ days: i }))
  const names = Array.from({ length: 7 }, (_, i) => Info.weekdays('narrow')[(firstDay - 1 + i) % 7]!)
  return (
    <div className={className}>
      <p className="mb-2 text-center font-semibold text-ink">{month.toFormat('LLLL yyyy')}</p>
      <div className="grid grid-cols-7 text-center text-xs text-muted" aria-hidden="true">{names.map((n, i) => <span key={i} className="py-1">{n}</span>)}</div>
      <div className="grid grid-cols-7">
        {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} />)}
        {days.map((d) => {
          const iso = d.toISODate()!
          const isStart = iso === start, isEnd = iso === end
          const inside = !!start && !!end && iso > start && iso < end
          const disabled = !!min && iso < min
          const ends = isStart || isEnd
          return (
            <div key={iso} className={`py-0.5 ${inside || (isStart && end && end > start) ? 'bg-brand-50' : ''} ${isStart && end && end > start ? 'rounded-l-full' : ''} ${isEnd && start && end > start ? 'rounded-r-full bg-brand-50' : ''}`}>
              <button
                type="button" disabled={disabled} onClick={() => onPick(iso)} onPointerEnter={() => onHover(iso)} onFocus={() => onHover(iso)}
                aria-label={d.toFormat('cccc d LLLL yyyy')} aria-pressed={ends || inside}
                className={`mx-auto flex size-10 items-center justify-center rounded-full text-sm tabular-nums disabled:opacity-35 ${ends ? 'bg-action font-semibold text-on-action' : 'hover:bg-brand-50'} ${iso === today && !ends ? 'font-semibold text-action underline underline-offset-4' : ''}`}
              >{d.day}</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
