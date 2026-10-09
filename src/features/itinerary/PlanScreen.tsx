import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { DateTime } from 'luxon'
import { AlertTriangle, BedDouble, CalendarDays, CalendarPlus, Map, Plus, StickyNote } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useLegContext, useMembers, usePlaces, useTrip } from '@/data/hooks'
import type { Place } from '@/data/types'
import { formatInZone } from '@/lib/time'
import { Fab, LinkButton, PageHeader, SectionTitle, Textarea } from '@/ui'
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
import { useDaySuggestions } from '@/features/suggest/data'
import { SuggestionsCard } from '@/features/suggest/SuggestionsCard'

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
  const ideas = useDaySuggestions({ tripId, day, places, items: items ?? [], layout, anchor: locs[day] ?? null, rainPct: weatherOf(day)?.weather.rainPct ?? null })

  // Keep the selected day visible in the strip.
  const stripRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>('[aria-current="date"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [day])

  if (!trip || !items) return <LoadingState fullScreen title="Loading your itinerary…" />
  const empty = layout.blocks.length === 0 && layout.allDay.length === 0 && layout.stays.length === 0

  return (
    <div className="min-h-full pb-28">
      <PageHeader title="Plan" below={
        <div ref={stripRef} role="tablist" aria-label="Days" className="flex gap-1.5 overflow-x-auto px-4 pb-3 pt-1 lg:px-6">
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
                aria-label={`${dt.toFormat('cccc d LLLL')}${d === today ? ', today' : ''}, ${perDay[d]?.count ?? 0} items${perDay[d]?.conflict ? ', has overlaps' : ''}${w ? `, ${describeCode(w.weather.code).label}, high ${formatTemp(w.weather.hi, tempUnit)}` : ''}`}
                onClick={() => setParams({ day: d }, { replace: true })}
                className={`plan-day ${on ? 'bg-brand-700 text-white' : `bg-surface text-stone-700 ${d === today ? 'border-2 border-brand-700' : 'border border-stone-200'}`}`}
              >
                <span className="text-xs">{dt.toFormat('ccc')}</span>
                <span className="text-base font-semibold tabular-nums">{dt.toFormat('d')}</span>
                {w && (
                  <span aria-hidden="true" className={`flex items-center gap-0.5 text-xs tabular-nums ${on ? 'text-white' : 'text-stone-600'}`}>
                    <WeatherGlyph code={w.weather.code} className="size-3.5" />{formatTemp(w.weather.hi, tempUnit)}
                  </span>
                )}
                {(perDay[d]?.count ?? 0) > 0 && <span aria-hidden="true" className={`absolute top-1.5 right-1.5 size-1.5 rounded-full ${perDay[d]?.conflict ? 'bg-red-500' : on ? 'bg-white' : 'bg-brand-600'}`} />}
              </button>
            )
          })}
        </div>
      } />

      <div className="mx-auto max-w-2xl space-y-3 p-4 lg:p-6">
        <UpNextCard tripId={tripId} items={items} places={places} members={members} me={me} zone={zone} transfers={transfers} withinHours={24} />
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>{DateTime.fromISO(day).toFormat('cccc, d LLLL')}</SectionTitle>
          {layout.blocks.some((b) => b.item.place_id) && (
            <Link to={`/t/${tripId}/map?day=${day}`} className="ui-link shrink-0">
              <Map aria-hidden="true" className="size-4" /> On map
            </Link>
          )}
        </div>

        <WeatherLine day={weatherOf(day)} />
        <DayNoteEditor tripId={tripId} day={day} />

        {layout.stays.map((s) => (
          <Link key={s.id} to={`/t/${tripId}/plan/${s.id}`} className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
            <BedDouble aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 truncate">Staying at <b>{placeOf(s.place_id)?.name ?? s.title}</b></span>
          </Link>
        ))}
        {layout.allDay.map((i) => (
          <Link key={i.id} to={`/t/${tripId}/plan/${i.id}`} className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-surface px-3 py-2 text-sm">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-brand-700" />
            <span className="min-w-0 truncate font-medium">{i.title}</span>
            <span className="ml-auto text-xs text-stone-600">All day</span>
          </Link>
        ))}
        {conflicts > 0 && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0" /> {conflicts} items overlap for the same people
          </p>
        )}
        <TravelWarnings tripId={tripId} transfers={transfers.filter((t) => dayKey(t.to.start_at, zone) === day)} />
        {/* A day that has passed has nothing left to fill. */}
        {day >= today && ideas && <SuggestionsCard tripId={tripId} day={day} suggestions={ideas} me={me} />}

        {empty ? (
          <Empty>
            <CalendarDays aria-hidden="true" className="size-8 text-brand-700" />
            <EmptyHeader>
              <EmptyTitle>Know what’s next</EmptyTitle>
              <EmptyDescription>Start with the flight you booked, a dinner everyone picked, or a day you want to explore. Add it to the plan so your friends can follow along, even offline.</EmptyDescription>
            </EmptyHeader>
            <LinkButton to={`/t/${tripId}/plan/new?day=${day}`}>
              <Plus aria-hidden="true" className="size-4" /> Add to this day
            </LinkButton>
          </Empty>
        ) : (
          <Timeline blocks={layout.blocks} fromHour={layout.fromHour} toHour={layout.toHour} zone={zone} day={day} tripId={tripId} placeOf={placeOf} />
        )}

        {/* Things about the whole plan, not this day, sit after it. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-stone-200 pt-3">
          <TimeToggle trip={trip} />
          {mine.length > 0 && (
            <button type="button" className="ui-link" onClick={() => void shareCalendar(trip?.name ?? 'Trip', planIcs(mine, places, members, trip?.name ?? 'Trip', location.origin))}>
              <CalendarPlus aria-hidden="true" className="size-4" /> Add my plan to calendar
            </button>
          )}
        </div>
      </div>

      {/* An empty day already offers the same action in the middle of the screen. */}
      {!empty && <Fab to={`/t/${tripId}/plan/new?day=${day}`} label="Add to plan" />}
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
          <span className="absolute -top-2.5 left-0 bg-canvas pr-1 text-xs tabular-nums text-stone-600">{String(h).padStart(2, '0')}:00</span>
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
        className={`flex h-full flex-col overflow-hidden rounded-xl border-l-4 px-2 py-1 text-left ${k.bg} ${k.border} ${k.text} ${dashed ? 'border-dashed opacity-80' : ''} ${conflict ? 'ring-2 ring-red-500' : ''}`}
      >
        <span className="flex items-center gap-1 text-xs font-medium opacity-80">
          <k.Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="tabular-nums">{block.continuesBefore ? '…' : ''}{time}{block.continuesAfter ? '…' : ''}</span>
        </span>
        <span className="truncate text-sm font-semibold">{item.title}</span>
        {where && height > 54 && <span className="truncate text-xs opacity-80">{where}</span>}
        {conflict && height > 72 && <span className="mt-auto text-xs font-semibold text-red-700">Overlaps</span>}
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
      <button type="button" onClick={() => setOpen(true)} className="ui-link">
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
