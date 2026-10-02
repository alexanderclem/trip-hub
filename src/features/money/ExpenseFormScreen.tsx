import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { DateTime } from 'luxon'
import { Trash2 } from 'lucide-react'
import { db } from '@/data/db'
import { useMyMemberId } from '@/data/device'
import { useMembers, useTrip } from '@/data/hooks'
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseRow } from '@/data/types'
import { rateFor } from '@/lib/fx'
import { newId } from '@/lib/ids'
import { computeShares, formatMoney, minorUnits, type SplitMethod } from '@/lib/money'
import { Avatar, Button, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/ui'
import { buildExpense, parseMinor, type ExpenseDraft } from './build'
import { deleteExpense, saveExpense, useExpense, useMoney } from './data'

const METHODS: { id: SplitMethod; label: string }[] = [
  { id: 'equal', label: 'Equally' },
  { id: 'shares', label: 'Shares' },
  { id: 'exact', label: 'Exact' },
  { id: 'percent', label: '%' },
]
const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  food: 'Food', drinks: 'Drinks', lodging: 'Lodging', transport: 'Transport', activities: 'Activities',
  groceries: 'Groceries', shopping: 'Shopping', tips: 'Tips', fees: 'Fees', other: 'Other',
}
const major = (minor: number, ccy: string) => (minor / 10 ** minorUnits(ccy)).toFixed(minorUnits(ccy))

type Draft = Omit<ExpenseDraft, 'rate'> & { rateText: string; rateEdited: boolean; multiPay: boolean }

export function ExpenseFormScreen() {
  const { tripId, expenseId } = useParams() as { tripId: string; expenseId?: string }
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const trip = useTrip(tripId)
  const members = useMembers(tripId)
  const money = useMoney(tripId)
  const existing = useExpense(expenseId)
  const [d, setD] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const loaded = useRef(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((c) => (c ? { ...c, [k]: v } : c))

  const base = trip?.base_currency ?? 'USD'
  const local = trip?.local_currency ?? null
  const currencies = [...new Set([local, base].filter(Boolean) as string[])]

  // Fill the form once (sync keeps refreshing rows in the background; see CLAUDE.md).
  useEffect(() => {
    if (loaded.current || !trip || !members || !money) return
    if (expenseId && !existing) return
    const rowsFor = (split?: ExpenseRow['split'], method?: SplitMethod, ccy?: string) =>
      members.map((m) => {
        const s = split?.find((x) => x.member_id === m.id)
        const value = !s || method === 'equal' ? '' : method === 'exact' ? major(s.value, ccy!) : method === 'percent' ? String(s.value / 100) : String(s.value)
        return { memberId: m.id, included: split ? !!s : true, value }
      })
    if (existing) {
      setD({
        id: existing.id, tripId, description: existing.description, category: existing.category, spentOn: existing.spent_on,
        amount: major(existing.amount_minor, existing.currency), currency: existing.currency, baseCurrency: existing.base_currency,
        rateText: String(existing.fx_rate), rateEdited: existing.fx_source === 'manual',
        payers: existing.payers.map((p) => ({ memberId: p.member_id, amount: major(p.amount_minor, existing.currency) })),
        multiPay: existing.payers.length > 1, splitMethod: existing.split_method,
        rows: rowsFor(existing.split, existing.split_method, existing.currency), notes: existing.notes ?? '',
        itemId: existing.item_id, placeId: existing.place_id,
      })
    } else {
      const ccy = local ?? base
      setD({
        id: newId(), tripId, description: '', category: 'food', spentOn: DateTime.now().setZone(trip.timezone).toISODate()!,
        amount: '', currency: ccy, baseCurrency: base, rateText: '', rateEdited: false,
        payers: [{ memberId: me ?? members[0]!.id, amount: '' }], multiPay: false, splitMethod: 'equal',
        rows: rowsFor(), notes: '', itemId: null, placeId: null,
      })
      // Logging the cost of something on the plan.
      const itemId = search.get('item')
      if (itemId) {
        void db.itinerary_items.get(itemId).then((it) => {
          if (!it) return
          setD((c) => c && {
            ...c, description: it.title, itemId: it.id, placeId: it.place_id, spentOn: it.start_local.slice(0, 10),
            category: it.kind === 'lodging' ? 'lodging' : it.kind === 'meal' ? 'food' : it.kind === 'flight' || it.kind === 'transport' ? 'transport' : 'activities',
            ...(it.est_cost_minor != null && it.est_cost_currency ? { amount: major(it.est_cost_minor, it.est_cost_currency), currency: it.est_cost_currency } : {}),
          })
        })
      }
    }
    loaded.current = true
  }, [trip, members, money, existing, expenseId, tripId, me, base, local, search])

  // Default rate from the latest snapshot (or the built-in table), unless the person typed one.
  const autoRate = d ? rateFor(d.currency, base, money?.snapshot ?? null) : null
  const rate = d && d.rateEdited && Number(d.rateText) > 0
    ? { value: Number(d.rateText), source: 'manual' as const, asOf: null }
    : autoRate
      ? { value: autoRate.rate, source: autoRate.source === 'same' ? ('same' as const) : autoRate.source, asOf: autoRate.asOf }
      : { value: 0, source: 'manual' as const, asOf: null }

  const result = useMemo(() => (d ? buildExpense({ ...d, rate, payers: d.multiPay ? d.payers : d.payers.slice(0, 1) }) : null), [d, rate.value, rate.source]) // eslint-disable-line react-hooks/exhaustive-deps
  const shares = result && 'expense' in result ? computeShares(result.expense) : null
  const amountMinor = d ? (parseMinor(d.amount, d.currency) ?? 0) : 0
  const assigned = d
    ? d.splitMethod === 'exact'
      ? d.rows.filter((r) => r.included).reduce((a, r) => a + (parseMinor(r.value || '0', d.currency) ?? 0), 0)
      : d.splitMethod === 'percent'
        ? d.rows.filter((r) => r.included).reduce((a, r) => a + Math.round(Number(r.value || 0) * 100), 0)
        : 0
    : 0

  if (!d || !members) return <PageHeader title={expenseId ? 'Edit expense' : 'Add expense'} back={`/t/${tripId}/money`} />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!result) return
    if ('error' in result) return setError(result.error)
    setSaving(true)
    await saveExpense(result.expense, me)
    navigate(`/t/${tripId}/money`, { replace: true })
  }

  const setRow = (i: number, patch: Partial<Draft['rows'][number]>) => set('rows', d.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? '?'

  return (
    <div className="min-h-full pb-10">
      <PageHeader title={expenseId ? 'Edit expense' : 'Add expense'} back={`/t/${tripId}/money`} />
      <form onSubmit={submit} className="mx-auto max-w-md space-y-4 p-4">
        <Field label="What for?">
          <Input value={d.description} onChange={(e) => set('description', e.target.value)} maxLength={200} placeholder="Dinner at Café Sky" />
        </Field>
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <Field label="Amount">
            <Input inputMode="decimal" value={d.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" className="text-lg font-semibold" />
          </Field>
          <Field label="Currency">
            <Select value={d.currency} onChange={(e) => setD((c) => c && { ...c, currency: e.target.value, rateEdited: false })}>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        {d.currency !== base && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
            <span>1 {base} =</span>
            <Input inputMode="decimal" aria-label="Exchange rate" value={d.rateEdited ? d.rateText : rate.value ? String(Number(rate.value.toFixed(4))) : ''}
              onChange={(e) => setD((c) => c && { ...c, rateText: e.target.value, rateEdited: true })} className="w-24 px-2 py-1.5" />
            <span>{d.currency}</span>
            <span className="text-xs text-stone-500">
              {rate.source === 'manual' ? 'your rate' : rate.source === 'fallback' ? 'approximate (offline)' : `rates from ${rate.asOf}`}
              {amountMinor > 0 && result && 'expense' in result && ` · ≈ ${formatMoney(result.expense.base_amount_minor, base)}`}
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">
            <Input type="date" value={d.spentOn} onChange={(e) => set('spentOn', e.target.value)} />
          </Field>
          <Field label="Category">
            <Select value={d.category} onChange={(e) => set('category', e.target.value as ExpenseCategory)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </Select>
          </Field>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-stone-700">Paid by</legend>
          {!d.multiPay ? (
            <div className="mt-1 flex gap-2">
              <Select aria-label="Paid by" value={d.payers[0]!.memberId} onChange={(e) => set('payers', [{ memberId: e.target.value, amount: '' }])} className="flex-1">
                {members.map((m) => <option key={m.id} value={m.id}>{m.id === me ? `${m.display_name} (you)` : m.display_name}</option>)}
              </Select>
              <Button type="button" variant="ghost" className="text-sm" onClick={() => setD((c) => c && { ...c, multiPay: true, payers: members.map((m) => ({ memberId: m.id, amount: m.id === c.payers[0]!.memberId ? c.amount : '' })) })}>
                Several people
              </Button>
            </div>
          ) : (
            <div className="mt-1 space-y-1">
              {d.payers.map((p, i) => (
                <label key={p.memberId} className="flex min-h-11 items-center gap-2 text-sm">
                  <span className="flex-1">{name(p.memberId)}</span>
                  <Input inputMode="decimal" aria-label={`${name(p.memberId)} paid`} value={p.amount} placeholder="0" className="w-28 px-2 py-1.5"
                    onChange={(e) => set('payers', d.payers.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                </label>
              ))}
              <Button type="button" variant="ghost" className="text-sm" onClick={() => setD((c) => c && { ...c, multiPay: false, payers: [c.payers.find((p) => p.amount) ?? c.payers[0]!] })}>
                One person paid
              </Button>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-stone-700">Split</legend>
          <div role="radiogroup" aria-label="Split method" className="mt-1 grid grid-cols-4 gap-1 rounded-xl bg-stone-100 p-1 text-sm">
            {METHODS.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={d.splitMethod === m.id} onClick={() => set('splitMethod', m.id)}
                className={`min-h-10 rounded-lg ${d.splitMethod === m.id ? 'bg-white font-medium shadow-sm' : 'text-stone-600'}`}>{m.label}</button>
            ))}
          </div>
          <ul className="mt-2 divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {d.rows.map((r, i) => {
              const m = members.find((x) => x.id === r.memberId)!
              const share = shares?.get(r.memberId)?.owed
              return (
                <li key={r.memberId} className="flex min-h-12 items-center gap-2 px-3 py-1.5">
                  <input type="checkbox" checked={r.included} onChange={(e) => setRow(i, { included: e.target.checked })} aria-label={`Include ${m.display_name}`} className="size-5 accent-brand-600" />
                  <Avatar name={m.display_name} color={m.color} size="sm" />
                  <span className={`min-w-0 flex-1 truncate text-sm ${r.included ? '' : 'text-stone-400 line-through'}`}>{m.display_name}</span>
                  {r.included && d.splitMethod !== 'equal' && (
                    <Input inputMode="decimal" aria-label={`${m.display_name} ${d.splitMethod}`} value={r.value} onChange={(e) => setRow(i, { value: e.target.value })}
                      placeholder={d.splitMethod === 'shares' ? '1' : d.splitMethod === 'percent' ? '%' : '0.00'} className="w-20 px-2 py-1.5 text-right" />
                  )}
                  <span className="w-20 text-right text-sm text-stone-600 tabular-nums">{r.included && share != null ? formatMoney(share, base) : ''}</span>
                </li>
              )
            })}
          </ul>
          {d.splitMethod === 'exact' && amountMinor > 0 && assigned !== amountMinor && (
            <p className="mt-1 text-sm text-amber-800">{formatMoney(Math.abs(amountMinor - assigned), d.currency)} {assigned < amountMinor ? 'left to assign' : 'too much'}</p>
          )}
          {d.splitMethod === 'percent' && assigned !== 10000 && (
            <p className="mt-1 text-sm text-amber-800">{Math.abs(10000 - assigned) / 100}% {assigned < 10000 ? 'left to assign' : 'too much'}</p>
          )}
        </fieldset>

        <Field label="Notes">
          <Textarea value={d.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Optional" />
        </Field>
        <ErrorNote error={error} />
        <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Saving…' : 'Save expense'}</Button>
        {existing && (
          <Button type="button" variant="danger" className="w-full" onClick={async () => {
            if (!confirm(`Delete "${existing.description}" for everyone?`)) return
            await deleteExpense(existing.id, me)
            navigate(`/t/${tripId}/money`, { replace: true })
          }}>
            <Trash2 aria-hidden="true" className="size-4" /> Delete expense
          </Button>
        )}
      </form>
    </div>
  )
}
