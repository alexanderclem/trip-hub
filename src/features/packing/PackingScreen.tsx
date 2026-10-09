import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Backpack, ChevronDown, Plus, Sparkles } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useMembers, useTrip } from '@/data/hooks'
import type { PackingItem } from '@/data/types'
import { useWeather } from '@/features/itinerary/weather'
import { Button, ErrorNote, PageHeader } from '@/ui'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/ui/collection'
import { addStarters, claim, setMyCheck, setPacked, tally, usePacking } from './data'
import { suggestedStarters } from './starters'

const CHIP = 'min-h-11 rounded-xl border px-3 text-sm font-medium'
const chip = (on: boolean) => `${CHIP} ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'}`

export function PackingScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const me = useMyMemberId(tripId)
  const members = useMembers(tripId) ?? []
  const data = usePacking(tripId)
  const weather = useWeather(tripId)
  const [filter, setFilter] = useState<'all' | 'todo'>('all')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const items = data?.items ?? []
  const checks = data?.checks ?? []
  const memberIds = members.map((m) => m.id)
  const myState = (id: string) => checks.find((c) => c.item_id === id && c.member_id === me)?.state ?? null
  const everyone = items.filter((i) => i.kind === 'everyone')
  const group = items.filter((i) => i.kind === 'group')
  const mine = items.filter((i) => i.kind === 'personal' && i.owner_id === me)
  // What I personally still have to pack.
  const myJobs = [
    ...everyone.filter((i) => myState(i.id) !== 'skip').map((i) => myState(i.id) === 'packed'),
    ...group.filter((i) => i.owner_id === me).map((i) => i.packed),
    ...mine.map((i) => i.packed),
  ]
  const myDone = myJobs.filter(Boolean).length
  const todo = filter === 'todo'
  const show = {
    everyone: everyone.filter((i) => !todo || !myState(i.id)),
    group: group.filter((i) => !todo || !i.owner_id || (i.owner_id === me && !i.packed)),
    mine: mine.filter((i) => !todo || !i.packed),
  }

  const tripDays = useMemo(() => {
    const inTrip = (d: string) => (!trip?.start_date || d >= trip.start_date) && (!trip?.end_date || d <= trip.end_date)
    return (weather ?? []).flatMap((r) => Object.entries(r.days).filter(([d]) => inTrip(d)).map(([, w]) => w))
  }, [weather, trip?.start_date, trip?.end_date])

  async function act(fn: () => Promise<unknown>) {
    setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Try again.') }
  }
  async function suggest() {
    await act(async () => {
      const n = await addStarters(tripId, suggestedStarters(tripDays), me)
      setNote(n ? `Added ${n} suggested item${n > 1 ? 's' : ''}. Remove any you don’t need.` : 'All the suggestions are already on the list (or were removed on purpose).')
    })
  }
  const name = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? 'Former member'

  return (
    <div className="min-h-full pb-24">
      <PageHeader title="Packing" back={`/t/${tripId}/more`} action={<Link to="new" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 font-medium text-brand-700 hover:bg-brand-50"><Plus aria-hidden="true" className="size-4" />Add item</Link>} />
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Pack together</h2>
          <p className="mt-1 text-sm text-stone-600">Tick what you’ve packed, claim the shared gear, and keep your own list. Works offline.</p>
        </div>
        {!me && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Choose who you are in this trip to tick items off.</p>}
        {me && myJobs.length > 0 && (
          <div className="rounded-2xl border border-stone-200 bg-surface p-3">
            <p className="text-sm font-medium">You’ve packed {myDone} of {myJobs.length}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-label="Your packing" aria-valuemin={0} aria-valuemax={myJobs.length} aria-valuenow={myDone}>
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${(100 * myDone) / myJobs.length}%` }} />
            </div>
          </div>
        )}
        <div role="group" aria-label="Filter packing" className="flex flex-wrap gap-2">
          <button aria-pressed={!todo} onClick={() => setFilter('all')} className={chip(!todo)}>Everything</button>
          <button aria-pressed={todo} onClick={() => setFilter('todo')} className={chip(todo)}>Still to pack</button>
        </div>
        <ErrorNote error={error} />
        {note && <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">{note}</p>}

        {data === undefined ? <p role="status" className="py-8 text-center text-stone-500">Loading packing list…</p> : items.length === 0 ? (
          <Empty>
            <Backpack aria-hidden="true" className="size-8 text-brand-700" />
            <EmptyHeader>
              <EmptyTitle>Nothing on the list yet</EmptyTitle>
              <EmptyDescription>Start with the usual things (passport, chargers, a first-aid kit), then add your own.{tripDays.length ? ' Suggestions include extras for the forecast.' : ''}</EmptyDescription>
            </EmptyHeader>
            <Button onClick={() => void suggest()} className="flex items-center gap-2"><Sparkles aria-hidden="true" className="size-4" />Add suggested items</Button>
          </Empty>
        ) : (
          <>
            <Section id="pack-everyone" title="Everyone brings" hint="Each person ticks their own." count={show.everyone.length}>
              {show.everyone.map((i) => {
                const t = tally(i.id, checks, memberIds)
                const state = myState(i.id)
                return (
                  <li key={i.id} className="border-b border-stone-100 py-1 last:border-0">
                    <div className="flex items-center gap-1">
                      <Tick checked={state === 'packed'} disabled={!me || state === 'skip'} label={i.title} onChange={(v) => void act(() => setMyCheck(tripId, i.id, me!, v ? 'packed' : null))} />
                      <Title item={i} tripId={tripId} skipped={state === 'skip'} />
                      <button aria-expanded={open === i.id} aria-controls={`who-${i.id}`} onClick={() => setOpen(open === i.id ? null : i.id)}
                        className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-sm tabular-nums text-stone-600 hover:bg-stone-50">
                        {t.packed.length}/{t.needed}<span className="sr-only"> packed, show who</span><ChevronDown aria-hidden="true" className={`size-4 transition ${open === i.id ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {open === i.id && (
                      <div id={`who-${i.id}`} className="mb-2 ml-12 space-y-1 text-sm text-stone-600">
                        <Who label="Packed" ids={t.packed} name={name} />
                        <Who label="Not yet" ids={t.waiting} name={name} />
                        <Who label="Not needed" ids={t.skipped} name={name} />
                        {me && (
                          <button onClick={() => void act(() => setMyCheck(tripId, i.id, me, state === 'skip' ? null : 'skip'))} className="min-h-11 rounded-xl px-2 font-medium text-brand-700 hover:bg-brand-50">
                            {state === 'skip' ? 'I do need this' : 'I don’t need this'}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </Section>

            <Section id="pack-group" title="Group gear" hint="One person brings it for everyone." count={show.group.length}>
              {show.group.map((i) => (
                <li key={i.id} className="flex items-center gap-1 border-b border-stone-100 py-1 last:border-0">
                  <Tick checked={i.packed} disabled={!me || i.owner_id !== me} label={i.title} onChange={(v) => void act(() => setPacked(i.id, v, me))} />
                  <Title item={i} tripId={tripId} sub={i.owner_id ? `${name(i.owner_id)}${i.owner_id === me ? ' (you)' : ''} is bringing it${i.packed ? ' · packed' : ''}` : 'Nobody yet'} />
                  {me && (i.owner_id === me
                    ? <button onClick={() => void act(() => claim(i.id, null, me))} className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-medium text-stone-600 hover:bg-stone-50">Hand back</button>
                    : !i.owner_id && <button onClick={() => void act(() => claim(i.id, me, me))} className="min-h-11 shrink-0 rounded-xl border border-brand-700 px-3 text-sm font-medium text-brand-700 hover:bg-brand-50">I’ll bring it</button>)}
                </li>
              ))}
            </Section>

            <Section id="pack-mine" title="My items" hint="Only you see these here (they still sync with the trip, so they aren’t secret)." count={show.mine.length}>
              {show.mine.map((i) => (
                <li key={i.id} className="flex items-center gap-1 border-b border-stone-100 py-1 last:border-0">
                  <Tick checked={i.packed} label={i.title} onChange={(v) => void act(() => setPacked(i.id, v, me))} />
                  <Title item={i} tripId={tripId} />
                </li>
              ))}
            </Section>

            <button onClick={() => void suggest()} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
              <Sparkles aria-hidden="true" className="size-4" /> Add suggested items
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ id, title, hint, count, children }: { id: string; title: string; hint: string; count: number; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-sm font-semibold text-stone-700">{title} · {count}</h2>
      <p className="mb-2 text-xs text-stone-500">{hint}</p>
      {count ? <ul className="rounded-2xl border border-stone-200 bg-surface px-2">{children}</ul> : <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">Nothing here.</p>}
    </section>
  )
}

function Tick({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl hover:bg-stone-50">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={`Packed ${label}`} className="size-5 accent-brand-700" />
    </label>
  )
}

function Title({ item, tripId, sub, skipped }: { item: PackingItem; tripId: string; sub?: string; skipped?: boolean }) {
  const done = item.kind === 'everyone' ? skipped : item.packed
  return (
    <Link to={`/t/${tripId}/more/packing/${item.id}`} className="min-h-11 min-w-0 flex-1 rounded-xl px-2 py-1.5 hover:bg-stone-50">
      <p className={`break-words font-medium ${done ? 'text-stone-500 line-through' : 'text-stone-900'}`}>{item.title}{item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ''}</p>
      {(sub || item.category || skipped) && <p className="text-xs text-stone-500">{[skipped ? 'Not needed' : null, sub, item.category].filter(Boolean).join(' · ')}</p>}
    </Link>
  )
}

function Who({ label, ids, name }: { label: string; ids: string[]; name: (id: string) => string }) {
  if (!ids.length) return null
  return <p><span className="font-medium text-stone-700">{label}:</span> {ids.map(name).join(', ')}</p>
}

