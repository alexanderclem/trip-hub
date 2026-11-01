// Payments cards for Phase 2b: what travelers are asked at booking (on the 1%), room choices and the
// waitlist (Pro), and everyone's answers. Questions and rooms are saved on the server (signal needed);
// answers arrive with the synced bookings, so they read offline.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Download, Plus, Trash2 } from 'lucide-react'
import type { Booking, RoomOption, TripOffer } from '@/data/types'
import { syncNow } from '@/data/sync/controller'
import { Dialog } from '@/ui/Dialog'
import { Button, Card, ErrorNote, Input, SectionTitle } from '@/ui'
import { listWaitlist, offerWaitlistPlace, removeWaitlistEntry, saveOfferQuestions, saveRoomOptions, type WaitlistRow } from './api'
import { answersCsv, downloadText, questionList } from './data'
import { ProBadge, useMyOrganizer } from './pro'

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const slugify = (text: string, taken: string[]) => {
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 16) || 'q'
  let id = base
  for (let n = 2; taken.includes(id) || ['dietary', 'accessibility', 'emergency_contact'].includes(id); n++) id = `${base}-${n}`
  return id
}
const fileName = (trip: string, what: string) => `${trip.replace(/[^\w-]+/g, '-').toLowerCase()}-${what}.csv`

// ─── Questions ──────────────────────────────────────────────────────────────

export function QuestionsCard({ tripId, offer }: { tripId: string; offer: TripOffer }) {
  const loaded = useRef(false)
  const [std, setStd] = useState({ dietary: false, accessibility: false, emergency_contact: false })
  const [custom, setCustom] = useState<{ id: string; label: string; required: boolean }[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    const q = offer.questions ?? {}
    setStd({ dietary: !!q.dietary, accessibility: !!q.accessibility, emergency_contact: !!q.emergency_contact })
    setCustom(q.custom ?? [])
  }, [offer])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setMsg(null)
    try {
      const ids: string[] = []
      const list = custom.filter((c) => c.label.trim()).map((c) => {
        const id = c.id || slugify(c.label, ids)
        ids.push(id)
        return { ...c, id, label: c.label.trim() }
      })
      await saveOfferQuestions(tripId, { ...std, custom: list })
      await syncNow(tripId)
      setMsg('Saved. New bookings are asked these.')
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) } finally { setBusy(false) }
  }

  const box = (key: keyof typeof std, label: string) => (
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5" checked={std[key]} onChange={(e) => setStd({ ...std, [key]: e.target.checked })} />{label}</label>
  )
  return (
    <Card>
      <SectionTitle>Questions at booking</SectionTitle>
      <p className="mt-1 text-sm text-muted">Asked before travelers pay. Only you and each traveler see their answers; they can change them later.</p>
      <form onSubmit={submit} className="mt-2 space-y-1">
        {box('dietary', 'Dietary needs')}
        {box('accessibility', 'Accessibility needs')}
        {box('emergency_contact', 'Emergency contact')}
        <ul className="space-y-2 pt-2">
          {custom.map((c, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <Input aria-label={`Your question ${i + 1}`} maxLength={120} value={c.label} placeholder="T-shirt size" onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="w-auto min-w-0 flex-1" />
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={c.required} onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} />Required</label>
              <button type="button" className="ui-icon-button text-muted" aria-label={`Remove question ${i + 1}`} onClick={() => setCustom(custom.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" className="size-4" /></button>
            </li>
          ))}
        </ul>
        {custom.length < 5 && <button type="button" className="ui-link inline-flex min-h-11 items-center gap-1" onClick={() => setCustom([...custom, { id: '', label: '', required: false }])}><Plus aria-hidden="true" className="size-4" />Add your own question</button>}
        <ErrorNote error={error} />
        {msg && <p role="status" className="text-sm text-success-ink">{msg}</p>}
        <Button type="submit" variant="secondary" className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Save questions'}</Button>
      </form>
    </Card>
  )
}

/** Everyone's answers, readable on the phone (offline too) and as CSV. */
export function AnswersButton({ bookings, offer, tripName }: { bookings: Booking[]; offer: TripOffer; tripName: string }) {
  const [open, setOpen] = useState(false)
  const questions = questionList(offer.questions)
  if (!questions.length) return null
  const live = bookings.filter((b) => b.status === 'active' || b.status === 'paid').sort((a, z) => a.traveler_name.localeCompare(z.traveler_name))
  return (
    <>
      <button type="button" className="ui-link inline-flex min-h-11 items-center" onClick={() => setOpen(true)}>Travelers’ answers</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Travelers’ answers">
        {live.length === 0 ? <p className="text-sm text-muted">No bookings yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {live.map((b) => (
              <li key={b.id} className="py-2">
                <p className="font-semibold">{b.traveler_name}</p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  {questions.map((q) => <div key={q.id} className="contents"><dt className="text-muted">{q.label}</dt><dd className="break-words">{b.answers?.[q.id] || '–'}</dd></div>)}
                </dl>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="ui-link mt-2 inline-flex min-h-11 items-center gap-2" onClick={() => downloadText(fileName(tripName, 'answers'), answersCsv(bookings, offer.questions))}><Download aria-hidden="true" className="size-4" />Download as CSV</button>
      </Dialog>
    </>
  )
}

// ─── Rooms (Pro) ────────────────────────────────────────────────────────────

interface RoomRow { id: string; label: string; extra: string; count: string }

export function RoomsCard({ tripId, offer }: { tripId: string; offer: TripOffer }) {
  const me = useMyOrganizer()
  const loaded = useRef(false)
  const [rows, setRows] = useState<RoomRow[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    setRows((offer.room_options ?? []).map((r) => ({ id: r.id, label: r.label, extra: String(r.price_delta_minor / 100), count: String(r.count) })))
  }, [offer])
  if (me && !me.pro) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setMsg(null)
    try {
      const ids: string[] = []
      const list: RoomOption[] = rows.filter((r) => r.label.trim()).map((r) => {
        const id = r.id || slugify(r.label, ids)
        ids.push(id)
        return { id, label: r.label.trim(), price_delta_minor: Math.round((Number.parseFloat(r.extra) || 0) * 100), count: Math.max(1, Math.floor(Number(r.count) || 1)) }
      })
      await saveRoomOptions(tripId, list)
      await syncNow(tripId)
      setMsg('Saved.')
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) } finally { setBusy(false) }
  }

  return (
    <Card>
      <SectionTitle>Rooms<ProBadge beta={me?.beta ?? true} /></SectionTitle>
      <p className="mt-1 text-sm text-muted">Let travelers choose a room type at booking, for example a single room for {usd(40000)} more. Leave empty if everyone is booked the same way.</p>
      <form onSubmit={submit} className="mt-2 space-y-2">
        {rows.length > 0 && <div className="flex gap-2 text-xs text-muted" aria-hidden="true"><span className="min-w-0 flex-1">Room type</span><span className="w-20">Extra ($)</span><span className="w-16">How many</span><span className="w-11" /></div>}
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input aria-label={`Room type ${i + 1}`} maxLength={60} value={r.label} placeholder="Single" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="w-auto min-w-0 flex-1" />
              <Input aria-label={`Room type ${i + 1}: extra price ($)`} inputMode="decimal" value={r.extra} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, extra: e.target.value } : x)))} className="w-20" />
              <Input aria-label={`Room type ${i + 1}: how many places`} inputMode="numeric" value={r.count} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)))} className="w-16" />
              <button type="button" className="ui-icon-button text-muted" aria-label={`Remove room type ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" className="size-4" /></button>
            </li>
          ))}
        </ul>
        {rows.length < 8 && <button type="button" className="ui-link inline-flex min-h-11 items-center gap-1" onClick={() => setRows([...rows, { id: '', label: '', extra: '0', count: '1' }])}><Plus aria-hidden="true" className="size-4" />Add a room type</button>}
        <ErrorNote error={error} />
        {msg && <p role="status" className="text-sm text-success-ink">{msg}</p>}
        <Button type="submit" variant="secondary" className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Save rooms'}</Button>
      </form>
      <Link className="ui-link mt-2 inline-flex min-h-11 items-center" to={`/t/${tripId}/more/payments/rooming`}>Rooming board: who sleeps where</Link>
    </Card>
  )
}

// ─── Waitlist (Pro) ─────────────────────────────────────────────────────────

export function WaitlistCard({ tripId, full }: { tripId: string; full: boolean }) {
  const me = useMyOrganizer()
  const [rows, setRows] = useState<WaitlistRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = () => (navigator.onLine ? listWaitlist(tripId).then(setRows, (e: unknown) => setError(e instanceof Error ? e.message : String(e))) : Promise.resolve())
  useEffect(() => { void load() }, [tripId])
  if (me && !me.pro) return null
  if (!full && (!rows || rows.length === 0)) return null

  async function act(fn: () => Promise<void>) {
    setBusy(true); setError(null)
    try { await fn(); await load() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  const waiting = (rows ?? []).filter((r) => r.status !== 'booked')
  return (
    <Card>
      <SectionTitle>Waitlist<ProBadge beta={me?.beta ?? true} /></SectionTitle>
      <p className="mt-1 text-sm text-muted">When a place frees up, the next person gets an email and 48 hours to book it. Then it passes on.</p>
      <ErrorNote error={error} />
      {!rows && !error && !navigator.onLine && <p className="mt-2 text-sm text-muted">The waitlist shows here when you’re online.</p>}
      {rows && waiting.length === 0 && <p className="mt-2 text-sm">Nobody is waiting. Your trip page offers the waitlist while the trip is full.</p>}
      {waiting.length > 0 && (
        <ol className="mt-2 divide-y divide-line text-sm">
          {waiting.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 break-words">{r.name} <span className="text-muted">· {r.email}{r.status === 'offered' && r.hold_until ? ` · held until ${new Date(r.hold_until).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}</span></span>
              <span className="flex gap-2">
                {r.status === 'waiting' && <Button variant="secondary" className="px-3 text-sm" disabled={busy} onClick={() => void act(() => offerWaitlistPlace(r.id))}>Offer a place</Button>}
                <Button variant="ghost" className="px-3 text-sm" disabled={busy} onClick={() => void act(() => removeWaitlistEntry(r.id))}>Remove</Button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
