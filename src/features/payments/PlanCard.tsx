// Payments → "Payment plan": the dated payments after the deposit (up to 4), and the refund steps
// shown with the policy. Both stay on the 1%; they're part of collecting money, not Pro.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { TripOffer } from '@/data/types'
import { syncNow } from '@/data/sync/controller'
import { Button, Card, DateInput, ErrorNote, Input, SectionTitle } from '@/ui'
import { saveOfferPlan } from './api'

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const cents = (text: string) => Math.round((Number.parseFloat(text) || 0) * 100)

interface Row { date: string; amount: string }
interface Tier { days: string; percent: string }

export function PlanCard({ tripId, offer }: { tripId: string; offer: TripOffer }) {
  const loaded = useRef(false)
  const [rows, setRows] = useState<Row[]>([])
  const [tiers, setTiers] = useState<Tier[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    setRows((offer.schedule ?? []).map((s) => ({ date: s.due_date, amount: String(s.amount_minor / 100) })))
    setTiers((offer.refund_tiers ?? []).map((t) => ({ days: String(t.days_before), percent: String(t.percent) })))
  }, [offer])

  const left = offer.price_minor - offer.deposit_minor
  const planned = rows.reduce((a, r) => a + cents(r.amount), 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setMsg(null)
    try {
      await saveOfferPlan(tripId,
        rows.filter((r) => r.date && cents(r.amount) > 0).map((r) => ({ due_date: r.date, amount_minor: cents(r.amount) })),
        tiers.filter((t) => t.days !== '' && t.percent !== '').map((t) => ({ days_before: Math.max(0, Math.floor(Number(t.days))), percent: Math.min(100, Math.max(0, Math.round(Number(t.percent)))) }))
          .sort((a, b) => b.days_before - a.days_before))
      await syncNow(tripId)
      setMsg('Saved.')
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) } finally { setBusy(false) }
  }

  return (
    <Card>
      <SectionTitle>Payment plan and refunds</SectionTitle>
      <form onSubmit={submit} className="mt-3 space-y-4">
        <fieldset>
          <legend className="text-sm font-[550] text-ink">Payments after the deposit</legend>
          <p className="mt-1 text-xs text-muted">Leave empty for one balance payment{offer.balance_due_date ? ` by ${offer.balance_due_date}` : ''}. Up to 4; they must add up to {usd(left)}.</p>
          <ul className="mt-2 space-y-2">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <DateInput aria-label={`Payment ${i + 1} due`} value={r.date} onValue={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, date: v } : x)))} className="w-40" />
                <Input aria-label={`Payment ${i + 1} amount ($)`} inputMode="decimal" value={r.amount} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} className="w-28" />
                <button type="button" className="ui-icon-button text-muted" aria-label={`Remove payment ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" className="size-4" /></button>
              </li>
            ))}
          </ul>
          {rows.length < 4 && <button type="button" className="ui-link mt-1 inline-flex min-h-11 items-center gap-1" onClick={() => setRows([...rows, { date: '', amount: rows.length ? '' : String(left / 100) }])}><Plus aria-hidden="true" className="size-4" />Add a payment</button>}
          {rows.length > 0 && <p role="status" className={`text-sm ${planned === left ? 'text-success-ink' : 'text-warning-ink'}`}>{planned === left ? 'Adds up.' : `${usd(planned)} of ${usd(left)} planned.`}</p>}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-[550] text-ink">Refund steps</legend>
          <p className="mt-1 text-xs text-muted">Shown with your policy, and suggested when you refund. For example: 100% back 60 or more days before, 50% back 30 or more.</p>
          {tiers.length > 0 && <div className="mt-2 flex gap-2 text-xs text-muted" aria-hidden="true"><span className="w-24">Back (%)</span><span className="w-28">Days or more before</span></div>}
          <ul className="mt-1 space-y-2">
            {tiers.map((t, i) => (
              <li key={i} className="flex items-center gap-2">
                <Input aria-label={`Step ${i + 1}: percent back`} inputMode="numeric" value={t.percent} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))} className="w-24" />
                <Input aria-label={`Step ${i + 1}: days or more before the trip`} inputMode="numeric" value={t.days} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, days: e.target.value } : x)))} className="w-28" />
                <button type="button" className="ui-icon-button text-muted" aria-label={`Remove step ${i + 1}`} onClick={() => setTiers(tiers.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" className="size-4" /></button>
              </li>
            ))}
          </ul>
          {tiers.length < 6 && <button type="button" className="ui-link mt-1 inline-flex min-h-11 items-center gap-1" onClick={() => setTiers([...tiers, { days: '', percent: '' }])}><Plus aria-hidden="true" className="size-4" />Add a step</button>}
        </fieldset>
        <ErrorNote error={error} />
        {msg && <p role="status" className="text-sm text-success-ink">{msg}</p>}
        <Button type="submit" variant="secondary" className="w-full" disabled={busy || (rows.length > 0 && planned !== left)}>{busy ? 'Saving…' : 'Save plan'}</Button>
      </form>
    </Card>
  )
}
