import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { DateTime } from 'luxon'
import { Share2, X } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { RadarChart } from '@/features/discovery/RadarChart'
import { formatMoney } from '@/lib/money'
import { Input } from '@/ui'
import { albumUrl, saveAlbumUrl, useWrappedData } from './data'
import { computeWrapped, isRecapTime } from './stats'
import { shareSlide } from './share'

const SLIDE_MS = 6500
const THEMES: [string, string][] = [
  ['#183e4b', '#396673'], ['#ef9477', '#b9573a'], ['#0f2a33', '#295361'], ['#517f8a', '#183e4b'], ['#c45a3c', '#7a2f1d'], ['#295361', '#ef9477'],
]
const PLACE_WORD: Record<string, string> = { food: 'places to eat', drink: 'bars and cafés', activity: 'activities', sight: 'sights', shopping: 'shops', reservation: 'bookings', other: 'other spots' }
const SPEND_WORD: Record<string, string> = { food: 'food', drinks: 'drinks', lodging: 'places to stay', transport: 'getting around', activities: 'activities', groceries: 'groceries', shopping: 'shopping', tips: 'tips', fees: 'fees', other: 'other things' }

export interface Slide {
  key: string
  kicker: string
  big: string
  /** Animates the big number from 0 when set. */
  count?: { value: number; format: (n: number) => string }
  lines: string[]
  extra?: ReactNode
}

function useReducedMotion() {
  const [reduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  return reduced
}

function CountUp({ value, format, run }: { value: number; format: (n: number) => string; run: boolean }) {
  const [shown, setShown] = useState(run ? 0 : value)
  useEffect(() => {
    if (!run) { setShown(value); return }
    let frame = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1200)
      setShown(Math.round(value * (1 - (1 - p) ** 3)))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, run])
  return <>{format(shown)}</>
}

export function WrappedScreen() {
  const { tripId } = useParams() as { tripId: string }
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const data = useWrappedData(tripId)
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)

  const slides = useMemo<Slide[]>(() => {
    if (!data) return []
    const w = computeWrapped(data, me)
    const base = data.trip.base_currency
    const money = (n: number) => formatMoney(n, base)
    const name = (id: string) => data.members.find((m) => m.id === id)?.display_name ?? 'Someone'
    const dates = data.trip.start_date && data.trip.end_date
      ? `${DateTime.fromISO(data.trip.start_date).toFormat('d LLL')} – ${DateTime.fromISO(data.trip.end_date).toFormat('d LLL yyyy')}`
      : ''
    const out: Slide[] = [{
      key: 'intro', kicker: isRecapTime(data.trip, Date.now()) ? 'Your trip, wrapped' : 'Your trip so far', big: data.trip.name,
      lines: [[w.days ? `${w.days} days` : null, `${w.people} ${w.people === 1 ? 'traveller' : 'travellers'}`].filter(Boolean).join(' · '), dates].filter(Boolean),
    }]
    if (w.km > 0 || w.stops > 1) out.push({
      key: 'distance', kicker: 'Together you covered', big: `${w.km.toLocaleString('en-US')} km`, count: { value: w.km, format: (n) => `${n.toLocaleString('en-US')} km` },
      lines: [`${w.stops} stops on the plan`, w.flights ? `${w.flights} ${w.flights === 1 ? 'flight' : 'flights'}` : '', w.rides ? `${w.rides} shuttles, boats and rides` : ''].filter(Boolean),
    })
    if (w.placesVisited) out.push({
      key: 'places', kicker: 'You made it to', big: `${w.placesVisited} places`, count: { value: w.placesVisited, format: (n) => `${n} places` },
      lines: w.topCategory ? [`Including ${w.topCategory.count} ${PLACE_WORD[w.topCategory.category] ?? 'spots'}`] : [],
    })
    if (w.favourite) out.push({
      key: 'favourite', kicker: 'The group’s favourite', big: w.favourite.place.name,
      lines: [`★ ${w.favourite.average.toFixed(1)} from ${w.favourite.count} ratings`, w.divisive ? `Most divisive: ${w.divisive.place.name} (ratings ${w.divisive.spread} stars apart)` : ''].filter(Boolean),
    })
    if (w.pollsHeld) out.push({
      key: 'votes', kicker: 'Democracy in action', big: `${w.votesCast} votes`, count: { value: w.votesCast, format: (n) => `${n} votes` },
      lines: [`across ${w.pollsHeld} ${w.pollsHeld === 1 ? 'poll' : 'polls'}`, w.closest ? `Closest call: ${w.closest.winner} edged out ${w.closest.runnerUp} (“${w.closest.poll.title}”)` : ''].filter(Boolean),
    })
    if (w.totalMinor) out.push({
      key: 'money', kicker: 'Together you spent', big: money(w.totalMinor), count: { value: w.totalMinor, format: money },
      lines: [
        w.dailyMinor ? `≈ ${money(w.dailyMinor)} a day` : '',
        w.topSpend ? `Mostly on ${SPEND_WORD[w.topSpend.category] ?? w.topSpend.category}` : '',
        w.biggest ? `Biggest bill: ${w.biggest.description} (${money(w.biggest.base_amount_minor)})` : '',
        w.banker ? `${name(w.banker.memberId)} paid the most up front: ${money(w.banker.paidMinor)}` : '',
      ].filter(Boolean),
    })
    if (w.you && (w.you.shareMinor || w.you.favourite || w.you.ratings || w.you.tasksDone)) out.push({
      key: 'you', kicker: 'Your trip', big: w.you.shareMinor ? money(w.you.shareMinor) : name(me!),
      count: w.you.shareMinor ? { value: w.you.shareMinor, format: money } : undefined,
      lines: [
        w.you.shareMinor ? 'was your share' : '',
        w.you.favourite ? `Your top pick: ${w.you.favourite.name}` : '',
        w.you.ratings ? `${w.you.ratings} places rated` : '',
        w.you.tasksDone ? `${w.you.tasksDone} tasks done` : '',
        w.you.receipts ? `${w.you.receipts} receipts scanned` : '',
      ].filter(Boolean),
    })
    if (w.awards.length) out.push({
      key: 'awards', kicker: 'And the awards go to', big: `${w.awards.length} awards`,
      lines: w.awards.map((a) => `${a.title}: ${name(a.memberId)} (${a.count} ${a.why})`),
    })
    const album = albumUrl(data.trip)
    out.push({
      key: 'outro', kicker: 'Where to next?', big: 'Same again?',
      lines: w.groupTaste ? ['Your group’s travel taste'] : ['Thanks for travelling together'],
      extra: (
        <div className="mt-4 space-y-3">
          {w.groupTaste && <div className="rounded-2xl bg-white/90 p-2 text-brand-900"><RadarChart scores={w.groupTaste.mean} range={{ low: w.groupTaste.low, high: w.groupTaste.high }} label="The group’s travel taste" /></div>}
          {album ? (
            <a href={album} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex min-h-11 items-center justify-center rounded-xl bg-white px-4 font-semibold text-brand-900">Open the photo album<span className="sr-only"> (opens in a new tab)</span></a>
          ) : (
            <AlbumForm tripId={tripId} me={me} />
          )}
        </div>
      ),
    })
    return out
  }, [data, me, tripId])

  const slide = slides[Math.min(index, slides.length - 1)]
  const last = index >= slides.length - 1

  // Auto-advance unless paused, holding, or the person prefers less motion.
  useEffect(() => { setElapsed(0) }, [index])
  useEffect(() => {
    if (paused || reduced || last || !slides.length) return
    const startedAt = performance.now() - elapsed
    let frame = 0
    const tick = (t: number) => {
      const e = t - startedAt
      if (e >= SLIDE_MS) { setIndex((i) => Math.min(i + 1, slides.length - 1)); return }
      setElapsed(e)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused, reduced, last, slides.length, index]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, slides.length - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
      if (e.key === 'Escape') navigate(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length, navigate])

  if (data === undefined) return null
  if (!data || !slide) return <p className="p-6 text-stone-600">This trip isn’t on this phone.</p>
  const [from, to] = THEMES[index % THEMES.length]!

  function onPointerDown() {
    held.current = false
    holdTimer.current = setTimeout(() => { held.current = true; setPaused(true) }, 250)
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    if (held.current) { setPaused(false); return }
    if ((e.target as HTMLElement).closest('a,button,input,form')) return
    const x = e.clientX / window.innerWidth
    setIndex((i) => (x < 0.33 ? Math.max(i - 1, 0) : Math.min(i + 1, slides.length - 1)))
  }

  async function share() {
    setNote(null)
    try {
      const done = await shareSlide(slide!, [from, to], data!.trip.name)
      if (done === 'downloaded') setNote('Saved the picture to your downloads.')
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') setNote('Couldn’t share this one. Try a screenshot.')
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Trip recap" className="fixed inset-0 z-50 flex flex-col text-white select-none" style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}>
      <style>{'@keyframes wrapped-in { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }'}</style>
      <div className="pt-safe flex gap-1 px-3 pt-3" aria-hidden="true">
        {slides.map((s, i) => (
          <div key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div className="h-full bg-white" style={{ width: i < index ? '100%' : i > index ? '0%' : reduced || last ? '100%' : `${(elapsed / SLIDE_MS) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-3 pt-2">
        <p className="text-sm font-medium text-white/80" aria-live="polite">{index + 1} of {slides.length}{paused ? ' · paused' : ''}</p>
        <button onClick={() => navigate(-1)} aria-label="Close recap" className="flex size-11 items-center justify-center rounded-full bg-white/15"><X aria-hidden="true" className="size-6" /></button>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-7 pb-6"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { if (holdTimer.current) clearTimeout(holdTimer.current); setPaused(false) }}
      >
        <section key={slide.key} aria-roledescription="slide" aria-label={slide.kicker} className={reduced ? '' : 'animate-[wrapped-in_500ms_ease-out]'}>
          <p className="text-lg font-semibold tracking-wide text-white/80 uppercase">{slide.kicker}</p>
          <h1 className="mt-3 text-[clamp(2.5rem,13vw,5rem)] leading-[1.02] font-black tracking-tight break-words">
            {slide.count ? <CountUp value={slide.count.value} format={slide.count.format} run={!reduced} /> : slide.big}
          </h1>
          <ul className="mt-6 space-y-2 text-xl leading-snug font-medium">
            {slide.lines.map((l) => <li key={l}>{l}</li>)}
          </ul>
          {slide.extra}
        </section>
      </div>

      <div className="pb-safe flex flex-col items-center gap-2 px-6 pb-6">
        {note && <p role="status" className="text-sm text-white/90">{note}</p>}
        <button onClick={() => void share()} className="flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-stone-900">
          <Share2 aria-hidden="true" className="size-5" />Share this slide
        </button>
        <p className="text-xs text-white/70">Tap the right side for next, left for back. Hold to pause.</p>
      </div>
    </div>
  )
}

function AlbumForm({ tripId, me }: { tripId: string; me: string | null }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      onSubmit={async (e) => { e.preventDefault(); try { await saveAlbumUrl(tripId, url, me); setError(null) } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t save.') } }}
      className="space-y-2 rounded-2xl bg-white/15 p-3"
    >
      <label htmlFor="album-url" className="block text-sm font-medium">Add the group’s shared photo album link</label>
      <div className="flex gap-2">
        <Input id="album-url" type="url" inputMode="url" placeholder="https://photos.app.goo.gl/…" value={url} onChange={(e) => setUrl(e.target.value)} className="min-w-0 flex-1 text-stone-900" />
        <button type="submit" className="min-h-11 shrink-0 rounded-xl bg-white px-4 font-semibold text-brand-900">Save</button>
      </div>
      {error && <p role="alert" className="text-sm font-medium">{error}</p>}
    </form>
  )
}
