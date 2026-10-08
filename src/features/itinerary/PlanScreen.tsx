import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { DateTime } from 'luxon'
import { AlertTriangle, BedDouble, CalendarDays, CalendarPlus, Map, Plus, StickyNote } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useLegContext, useMembers, usePlaces, useTrip } from '@/data/hooks'
import type { Place } from '@/data/types'
import { formatInZone } from '@/lib/time'
import { Card, Textarea } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/ui/collection'
import { itemsFor, planIcs, shareCalendar } from './calendar'
import { saveDayNote, useDayNote, useDisplayZone, useItems } from './data'
import { KIND_STYLE } from './kinds'
import { layoutDay, planDays, type Block } from './layout'
import { TimeToggle } from './TimeToggle'
import { UpNextCard } from './UpNextCard'
import { TravelWarnings } from './TravelWarnings'
import { planTransfers } from './travel'
import { dayKey } from '@/lib/time'
import { describeCode, formatTemp } from '@/lib/weather'
import { useDevice } from '@/data/device'
import { dayLocations, useWeather, useWeatherRefresh, weatherFor } from './weather'
import { WeatherGlyph, WeatherLine } from './WeatherLine'

const HOUR_PX = 60
const GUTTER = '3.25rem'

export function PlanScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const items = useItems(tripId)
  const places = usePlaces(tripId) ?? []
  const members = useMembers(tripId) ?? []
  const me = useMyMemberId(tripId)
  const legCtx = useLegContext(tripId)
  const { zone } = useDisplayZone(trip)
  const [params, setParams] = useSearchParams()

  const days = useMemo(() => planDays(trip?.start_date ?? null, trip?.end_date ?? null, items ?? [], zone), [trip, items, zone])
  const today = DateTime.now().setZone(zone).toISODate()!
  const day = params.get('day') && days.includes(params.get('day')!) ? params.get('day')! : days.includes(today) ? today : days[0]!
  const layout = useMemo(() => layoutDay(items ?? [], day, zone), [items, day, zone])
  const perDay = useMemo(() => Object.fromEntries(days.map((d) => {
    const l = layoutDay(items ?? [], d, zone)
    return [d, { count: l.blocks.length + l.allDay.length, conflict: l.blocks.some((b) => b.conflict) }]
  })), [days, items, zone])
  const placeOf = (id: string | null) => (id ? places.find((p) => p.id === id) : undefined)
  const conflicts = layout.blocks.filter((b) => b.conflict).length
  const mine = useMemo(() => itemsFor(items ?? [], me), [items, me])
  const transfers = useMemo(() => legCtx ? planTransfers(items ?? [], places, legCtx, trip?.timezone ?? zone, members.map((m) => m.id)) : [], [items, places, legCtx, trip?.timezone, zone, members])
  const tempUnit = useDevice((s) => s.tempUnit)
  const weatherRows = useWeather(tripId)
  const locs = useMemo(() => (trip ? dayLocations(days, items ?? [], places, trip, trip.timezone) : {}), [days, items, places, trip])
  useWeatherRefresh(items ? trip : undefined, JSON.stringify(locs))
  const weatherOf = (d: string) => weatherFor(weatherRows, d, locs[d])

  // Keep the selected day visible in the strip.
  const stripRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>('[aria-current="date"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [day])

  if (!trip || !items) return <LoadingState fullScreen title="Loading your itinerary…" />

  return (
    <div className="min-h-full pb-28">
      <header className="pt-safe sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-stone-500">{trip?.name}</p>
            <h1 className="text-xl font-semibold tracking-tight">Plan</h1>
          </div>
          <TimeToggle trip={trip} />
        </div>
        <div ref={stripRef} role="tablist" aria-label="Days" className="flex gap-1.5 overflow-x-auto px-4 pt-3 pb-3">
          {days.map((d) => {
            const dt = DateTime.fromISO(d)
            const on = d === day
            const w = weatherOf(d)
            return (
              <button
                key={d}
                role="tab"
                aria-selected={on}
                aria-current={on ? 'date' : undefined}
                aria-label={`${dt.toFormat('cccc d LLLL')}, ${perDay[d]?.count ?? 0} items${perDay[d]?.conflict ? ', has overlaps' : ''}${w ? `, ${describeCode(w.weather.code).label}, high ${formatTemp(w.weather.hi, tempUnit)}` : ''}`}
                onClick={() => setParams({ day: d }, { replace: true })}
                className={`relative flex min-h-14 min-w-12 shrink-0 flex-col items-center justify-center rounded-xl px-2 ${on ? 'bg-brand-700 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}
              >
                <span className="text-[11px] uppercase">{dt.toFormat('ccc')}</span>
                <span className="text-base font-semibold tabular-nums">{dt.toFormat('d')}</span>
                {w && (
                  <span aria-hidden="true" className={`flex items-center gap-0.5 text-[10px] tabular-nums ${on ? 'text-white' : 'text-stone-600'}`}>
                    <WeatherGlyph code={w.weather.code} className="size-3" />{formatTemp(w.weather.hi, tempUnit)}
                  </span>
                )}
                {(perDay[d]?.count ?? 0) > 0 && <span aria-hidden="true" className={`absolute top-1.5 right-1.5 size-1.5 rounded-full ${perDay[d]?.conflict ? 'bg-red-500' : on ? 'bg-white' : 'bg-brand-600'}`} />}
                {d === today && !on && <span aria-hidden="true" className="absolute -top-1 rounded bg-brand-100 px-1 text-[9px] font-semibold text-brand-900">TODAY</span>}
              </button>
            )
          })}
        </div>
      </header>

      <div className="trip-page-grid mx-auto max-w-2xl p-4 lg:p-6">
        <aside className="trip-side mb-4 space-y-4 lg:mb-0" aria-label="Trip planning context">
          <UpNextCard tripId={tripId} items={items} places={places} members={members} me={me} zone={zone} transfers={transfers} />
          <Card className="hidden lg:block"><h2 className="text-lg font-semibold text-brand-900">This day at a glance</h2><p className="mt-2 text-sm text-stone-600">{perDay[day]?.count ?? 0} planned items · {conflicts} overlaps</p><p className="mt-3 text-sm leading-relaxed text-stone-600">Time zone: {zone.replaceAll('_', ' ')}</p><Link to={`/t/${tripId}/overview`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-brand-700">Back to trip overview</Link></Card>
        </aside>
        <div className="trip-main space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <Link to={`/t/${tripId}/more/ideas`} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-medium text-brand-700 hover:bg-brand-50">Explore trip ideas →</Link>
          <Link to={`/t/${tripId}/more/tasks`} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-medium text-brand-700 hover:bg-brand-50">Shared tasks →</Link>
          {mine.length > 0 && (
            <button
              onClick={() => void shareCalendar(trip?.name ?? 'Trip', planIcs(mine, places, members, trip?.name ?? 'Trip', location.origin))}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              <CalendarPlus aria-hidden="true" className="size-4" /> Add my plan to calendar
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{DateTime.fromISO(day).toFormat('cccc, d LLLL')}</h2>
          {layout.blocks.some((b) => b.item.place_id) && (
            <Link to={`/t/${tripId}/map?day=${day}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-50">
              <Map aria-hidden="true" className="size-4" /> On map
            </Link>
          )}
        </div>

        <WeatherLine day={weatherOf(day)} />
        <DayNoteEditor tripId={tripId} day={day} />

        {layout.stays.map((s) => (
          <Link key={s.id} to={`/t/${tripId}/plan/${s.id}`} className="flex min-h-11 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
            <BedDouble aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 truncate">Staying at <b>{placeOf(s.place_id)?.name ?? s.title}</b></span>
          </Link>
        ))}
        {layout.allDay.map((i) => (
          <Link key={i.id} to={`/t/${tripId}/plan/${i.id}`} className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-brand-700" />
            <span className="min-w-0 truncate font-medium">{i.title}</span>
            <span className="ml-auto text-xs text-stone-500">All day</span>
          </Link>
        ))}
        {conflicts > 0 && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0" /> {conflicts} items overlap for the same people
          </p>
        )}
        <TravelWarnings tripId={tripId} transfers={transfers.filter((t) => dayKey(t.to.start_at, zone) === day)} />

        {items && layout.blocks.length === 0 && layout.allDay.length === 0 && layout.stays.length === 0 ? (
          <Empty>
            <CalendarDays aria-hidden="true" className="size-8 text-brand-700" />
            <EmptyHeader>
              <EmptyTitle>Nothing planned yet</EmptyTitle>
              <EmptyDescription>Add flights, tours, meals and stays. Everyone sees the same plan, even offline.</EmptyDescription>
            </EmptyHeader>
            <Link to={`/t/${tripId}/plan/new?day=${day}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 font-medium text-white">
              <Plus aria-hidden="true" className="size-4" /> Add to this day
            </Link>
          </Empty>
        ) : (
          <Timeline blocks={layout.blocks} fromHour={layout.fromHour} toHour={layout.toHour} zone={zone} day={day} tripId={tripId} placeOf={placeOf} />
        )}
        </div>
      </div>

      <Link
        to={`/t/${tripId}/plan/new?day=${day}`}
        aria-label="Add to plan"
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-20 flex size-14 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-lg hover:bg-brand-900"
      >
        <Plus aria-hidden="true" className="size-7" />
      </Link>
    </div>
  )
}

function Timeline({ blocks, fromHour, toHour, zone, day, tripId, placeOf }: {
  blocks: Block[]; fromHour: number; toHour: number; zone: string; day: string; tripId: string; placeOf: (id: string | null) => Place | undefined
}) {
  const hours = Array.from({ length: toHour - fromHour }, (_, i) => fromHour + i)
  const top = (min: number) => ((min - fromHour * 60) / 60) * HOUR_PX
  const now = DateTime.now().setZone(zone)
  const nowMin = now.toISODate() === day ? now.hour * 60 + now.minute : null

  return (
    <div className="relative" style={{ height: hours.length * HOUR_PX }} aria-label="Timeline">
      {hours.map((h) => (
        <div key={h} className="absolute inset-x-0 border-t border-stone-200" style={{ top: (h - fromHour) * HOUR_PX }}>
          <span className="absolute -top-2.5 left-0 bg-stone-50 pr-1 text-xs tabular-nums text-stone-400">{String(h).padStart(2, '0')}:00</span>
        </div>
      ))}
      {nowMin != null && nowMin >= fromHour * 60 && nowMin <= toHour * 60 && (
        <div aria-label="Now" className="absolute right-0 z-10 border-t-2 border-red-500" style={{ top: top(nowMin), left: GUTTER }}>
          <span className="absolute -top-1.5 -left-1.5 size-3 rounded-full bg-red-500" />
        </div>
      )}
      <ol>
        {blocks.map((b) => <BlockCard key={b.item.id} block={b} top={top(b.startMin)} height={Math.max(30, ((b.endMin - b.startMin) / 60) * HOUR_PX) - 2} zone={zone} tripId={tripId} place={placeOf(b.item.place_id)} to={placeOf(b.item.to_place_id)} />)}
      </ol>
    </div>
  )
}

function BlockCard({ block, top, height, zone, tripId, place, to }: { block: Block; top: number; height: number; zone: string; tripId: string; place?: Place; to?: Place }) {
  const { item, lane, lanes, conflict } = block
  const k = KIND_STYLE[item.kind]
  const dashed = item.status === 'idea' || item.status === 'tentative'
  const time = `${formatInZone(item.start_at, zone)}${item.end_at ? `–${formatInZone(item.end_at, zone)}` : ''}`
  const where = to ? `${place?.name ?? ''} → ${to.name}` : place?.name
  return (
    <li
      className="absolute"
      style={{ top, height, left: `calc(${GUTTER} + (100% - ${GUTTER}) * ${lane} / ${lanes})`, width: `calc((100% - ${GUTTER}) / ${lanes} - 4px)` }}
    >
      <Link
        to={`/t/${tripId}/plan/${item.id}`}
        aria-label={`${item.title}, ${time}${where ? `, ${where}` : ''}${conflict ? ', overlaps another item' : ''}`}
        className={`flex h-full flex-col overflow-hidden rounded-xl border-l-4 px-2 py-1 text-left shadow-sm ${k.bg} ${k.border} ${k.text} ${dashed ? 'border-dashed opacity-80' : ''} ${conflict ? 'ring-2 ring-red-500' : ''}`}
      >
        <span className="flex items-center gap-1 text-xs font-medium opacity-80">
          <k.Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="tabular-nums">{block.continuesBefore ? '…' : ''}{time}{block.continuesAfter ? '…' : ''}</span>
        </span>
        <span className="truncate text-sm font-semibold">{item.title}</span>
        {where && height > 54 && <span className="truncate text-xs opacity-80">{where}</span>}
        {conflict && height > 72 && <span className="mt-auto text-[11px] font-semibold text-red-700">Overlaps</span>}
      </Link>
    </li>
  )
}

function DayNoteEditor({ tripId, day }: { tripId: string; day: string }) {
  const me = useMyMemberId(tripId)
  const note = useDayNote(tripId, day)
  const saved = note?.notes ?? ''
  const [text, setText] = useState(saved)
  const [open, setOpen] = useState(false)
  const editing = useRef(false)
  useEffect(() => {
    if (!editing.current) setText(saved)
  }, [saved, day])

  if (!open && !saved) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-brand-700">
        <StickyNote aria-hidden="true" className="size-4" /> Add a note for this day
      </button>
    )
  }
  return (
    <Textarea
      value={text}
      rows={2}
      autoFocus={open && !saved}
      aria-label="Notes for this day"
      placeholder="e.g. Pack swimsuits, last lancha 5 pm"
      onFocus={() => (editing.current = true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        editing.current = false
        setOpen(false)
        if (text.trim() !== saved) void saveDayNote(tripId, day, text, me)
      }}
      className="bg-amber-50/60"
    />
  )
}
