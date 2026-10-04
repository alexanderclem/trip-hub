import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { DateTime } from 'luxon'
import { ArrowRight, Check, HandCoins, Plus, Receipt, ScanLine, Undo2 } from 'lucide-react'
import { useDevice, useMyMemberId } from '@/data/device'
import { useMembers, useTrip } from '@/data/hooks'
import { PAYMENT_METHODS, type Member, type SettlementRow } from '@/data/types'
import { convertMinor, FX_ATTRIBUTION, rateFor } from '@/lib/fx'
import { newId } from '@/lib/ids'
import { balances, computeShares, formatMoney, minorUnits, simplifyDebts, toBaseMinor, type Transfer } from '@/lib/money'
import { Avatar, Button, Card, ErrorNote, Input, Select } from '@/ui'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/ui/collection'
import { parseMinor } from './build'
import { deleteSettlement, saveSettlement, useFxRefresh, useMoney } from './data'
import { useMoneyFormat } from './format'
import { TripCostCard } from './TripCostCard'

export function MoneyScreen() {
  const { tripId } = useParams() as { tripId: string }
  const me = useMyMemberId(tripId)
  const trip = useTrip(tripId)
  const members = useMembers(tripId) ?? []
  const money = useMoney(tripId)
  useFxRefresh(tripId, money === undefined ? undefined : (money.snapshot?.fetched_at ?? null), me)
  const { fmt, base, local, showLocal } = useMoneyFormat(trip, money?.snapshot ?? null)
  const setMoneyView = useDevice((s) => s.setMoneyView)
  const [recording, setRecording] = useState<Transfer | null>(null)

  const net = useMemo(() => (money ? balances(money.expenses, money.settlements) : new Map<string, number>()), [money])
  const transfers = useMemo(() => simplifyDebts(net), [net])
  const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? 'Someone'
  const memberOf = (id: string) => members.find((m) => m.id === id)
  const mine = me ? (net.get(me) ?? 0) : 0
  const total = money?.expenses.reduce((a, e) => a + e.base_amount_minor, 0) ?? 0

  // History: expenses and payments together, newest day first.
  const history = useMemo(() => {
    if (!money) return []
    const rows = [
      ...money.expenses.map((e) => ({ kind: 'expense' as const, day: e.spent_on, at: e.created_at ?? '', e })),
      ...money.settlements.map((s) => ({ kind: 'payment' as const, day: s.paid_on, at: s.created_at ?? '', s })),
    ].sort((a, b) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at))
    const byDay = new Map<string, typeof rows>()
    for (const r of rows) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r])
    return [...byDay]
  }, [money])

  return (
    <div className="min-h-full pb-28">
      <header className="pt-safe sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-stone-500">{trip?.name}</p>
            <h1 className="text-xl font-semibold tracking-tight">Money</h1>
          </div>
          {local && local !== base && (
            <div role="radiogroup" aria-label="Show amounts in" className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-sm">
              {([['base', base], ['local', `≈ ${local}`]] as const).map(([v, label]) => (
                <button key={v} role="radio" aria-checked={(v === 'local') === showLocal} onClick={() => setMoneyView(v)}
                  className={`min-h-9 rounded-lg px-3 ${(v === 'local') === showLocal ? 'bg-white font-medium shadow-sm' : 'text-stone-600'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 p-4">
        {trip && me && money && (
          <TripCostCard trip={trip} me={me} memberIds={members.map((m) => m.id)} expenses={money.expenses} snapshot={money.snapshot} fmt={(v) => fmt(v)} />
        )}
        {money && money.expenses.length === 0 && money.settlements.length === 0 ? (
          <Empty>
            <Receipt aria-hidden="true" className="size-8 text-brand-700" />
            <EmptyHeader>
              <EmptyTitle>No expenses yet</EmptyTitle>
              <EmptyDescription>Log who paid for what, in quetzales or dollars. Stowaway works out who owes whom with the fewest payments.</EmptyDescription>
            </EmptyHeader>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 font-medium text-white"><Plus aria-hidden="true" className="size-4" />Add an expense</Link>
              <Link to={`/t/${tripId}/tickets/new?kind=receipt&expense=1`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 font-medium text-brand-700"><ScanLine aria-hidden="true" className="size-4" />Scan a receipt</Link>
            </div>
          </Empty>
        ) : (
          <>
            <Card>
              <p className="text-sm text-stone-500">Your balance</p>
              <p className={`mt-1 text-3xl font-semibold tabular-nums ${mine > 0 ? 'text-green-700' : mine < 0 ? 'text-red-700' : 'text-stone-900'}`}>
                {mine === 0 ? 'All settled' : `${mine > 0 ? "You're owed" : 'You owe'} ${fmt(Math.abs(mine))}`}
              </p>
              <p className="mt-1 text-sm text-stone-500">Group spending so far: {fmt(total)}</p>
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 font-semibold"><HandCoins aria-hidden="true" className="size-5 text-brand-700" />Settle up</h2>
              {transfers.length === 0 ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-green-800"><Check aria-hidden="true" className="size-4" />Everyone is square.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {transfers.map((t) => (
                    <li key={`${t.from}-${t.to}`}>
                      <div className="flex items-center gap-2">
                        <Avatar name={name(t.from)} color={memberOf(t.from)?.color ?? null} size="sm" />
                        <span className="min-w-0 flex-1 text-sm">
                          <b>{t.from === me ? 'You' : name(t.from)}</b> pay{t.from === me ? '' : 's'} <b>{t.to === me ? 'you' : name(t.to)}</b>
                        </span>
                        <span className="font-semibold tabular-nums">{fmt(t.amount_minor)}</span>
                        <Button variant="secondary" className="min-h-9 px-3 text-sm" onClick={() => setRecording(t)} aria-label={`Record ${name(t.from)} paying ${name(t.to)}`}>Record</Button>
                      </div>
                      {recording === t && trip && (
                        <RecordPayment transfer={t} base={base} local={local} snapshot={money?.snapshot ?? null} me={me} tripId={tripId} onDone={() => setRecording(null)} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-stone-500">The fewest payments that clear everyone's balance.</p>
            </Card>

            <Card>
              <h2 className="mb-3 font-semibold">Balances</h2>
              <ul className="space-y-2">
                {members.map((m) => <BalanceRow key={m.id} member={m} value={net.get(m.id) ?? 0} max={Math.max(1, ...[...net.values()].map(Math.abs))} fmt={fmt} you={m.id === me} />)}
              </ul>
            </Card>

            <section aria-label="History" className="space-y-4">
              {history.map(([day, rows]) => (
                <div key={day}>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{DateTime.fromISO(day).toFormat('cccc d LLLL')}</h3>
                  <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
                    {rows.map((r) =>
                      r.kind === 'expense' ? (
                        <li key={r.e.id}>
                          <Link to={r.e.id} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-stone-50">
                            <Receipt aria-hidden="true" className="size-5 shrink-0 text-stone-400" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{r.e.description}</p>
                              <p className="truncate text-xs text-stone-500">
                                {r.e.payers.map((p) => (p.member_id === me ? 'You' : name(p.member_id))).join(' & ')} paid
                                {me && computeShares(r.e).get(me)?.owed ? ` · your share ${fmt(computeShares(r.e).get(me)!.owed)}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold tabular-nums">{formatMoney(r.e.amount_minor, r.e.currency)}</p>
                              {r.e.currency !== base && <p className="text-xs text-stone-500 tabular-nums">≈ {formatMoney(r.e.base_amount_minor, base)}</p>}
                            </div>
                          </Link>
                        </li>
                      ) : (
                        <li key={r.s.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                          <HandCoins aria-hidden="true" className="size-5 shrink-0 text-green-700" />
                          <p className="min-w-0 flex-1 text-sm">
                            <b>{r.s.from_member_id === me ? 'You' : name(r.s.from_member_id)}</b> paid <b>{r.s.to_member_id === me ? 'you' : name(r.s.to_member_id)}</b>
                            <span className="text-stone-500"> · {r.s.method}</span>
                          </p>
                          <span className="font-semibold tabular-nums">{formatMoney(r.s.amount_minor, r.s.currency)}</span>
                          <button onClick={() => confirm('Undo this payment?') && deleteSettlement(r.s.id, me)} aria-label="Undo payment" className="flex size-11 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100">
                            <Undo2 aria-hidden="true" className="size-4" />
                          </button>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ))}
            </section>
          </>
        )}

        <p className="pt-2 text-center text-xs text-stone-400">
          {money?.snapshot ? `Exchange rates from ${DateTime.fromISO(money.snapshot.as_of).toFormat('d LLL yyyy')}. ` : 'Using approximate built-in exchange rates until online. '}
          <a href={FX_ATTRIBUTION.url} target="_blank" rel="noreferrer" className="underline">{FX_ATTRIBUTION.text}</a>
        </p>
      </div>

      <Link to={`/t/${tripId}/tickets/new?kind=receipt&expense=1`} aria-label="Scan a receipt" className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+9.5rem)] z-20 flex size-12 items-center justify-center rounded-2xl border border-stone-200 bg-white text-brand-700 shadow-md hover:bg-stone-50">
        <ScanLine aria-hidden="true" className="size-6" />
      </Link>
      <Link to="new" aria-label="Add expense" className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-20 flex size-14 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-lg hover:bg-brand-900">
        <Plus aria-hidden="true" className="size-7" />
      </Link>
    </div>
  )
}

function BalanceRow({ member, value, max, fmt, you }: { member: Member; value: number; max: number; fmt: (n: number, o?: { signed?: boolean }) => string; you: boolean }) {
  const pct = (Math.abs(value) / max) * 50
  return (
    <li className="flex items-center gap-3">
      <Avatar name={member.display_name} color={member.color} size="sm" />
      <span className="w-20 shrink-0 truncate text-sm">{member.display_name}{you ? ' (you)' : ''}</span>
      <div className="relative h-2 flex-1 rounded-full bg-stone-100" aria-hidden="true">
        <div className={`absolute top-0 h-2 rounded-full ${value >= 0 ? 'left-1/2 bg-green-500' : 'right-1/2 bg-red-400'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-24 shrink-0 text-right text-sm font-medium tabular-nums ${value > 0 ? 'text-green-700' : value < 0 ? 'text-red-700' : 'text-stone-500'}`}>
        {value === 0 ? 'settled' : fmt(value, { signed: true })}
      </span>
    </li>
  )
}

function RecordPayment({ transfer, base, local, snapshot, me, tripId, onDone }: {
  transfer: Transfer; base: string; local: string | null; snapshot: Parameters<typeof rateFor>[2]; me: string | null; tripId: string; onDone: () => void
}) {
  const [currency, setCurrency] = useState(base)
  const rate = rateFor(currency, base, snapshot)
  /** The suggested amount in a currency, as the text a person would type ("58.98", "450.02"). */
  const suggest = (c: string) => {
    const r = rateFor(c, base, snapshot)
    const minor = r ? convertMinor(transfer.amount_minor, base, c, r.rate) : transfer.amount_minor
    return (minor / 10 ** minorUnits(c)).toFixed(minorUnits(c))
  }
  const [amount, setAmount] = useState(() => suggest(base))
  const [method, setMethod] = useState<SettlementRow['method']>('cash')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const minor = parseMinor(amount, currency)
    if (!minor || !rate) return setError('Enter the amount paid.')
    const row: SettlementRow = {
      id: newId(), trip_id: tripId, from_member_id: transfer.from, to_member_id: transfer.to,
      amount_minor: minor, currency, fx_rate: rate.rate, base_amount_minor: toBaseMinor(minor, currency, rate.rate, base),
      paid_on: DateTime.now().toISODate()!, method, note: null,
    }
    await saveSettlement(row, me)
    onDone()
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-2xl bg-stone-50 p-3">
      <div className="grid grid-cols-[1fr_5.5rem_6.5rem] gap-2">
        <Input inputMode="decimal" aria-label="Amount paid" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select aria-label="Currency" value={currency} onChange={(e) => {
          const c = e.target.value
          setCurrency(c)
          setAmount(suggest(c))
        }}>
          {[base, ...(local && local !== base ? [local] : [])].map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select aria-label="Paid by" value={method} onChange={(e) => setMethod(e.target.value as SettlementRow['method'])}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
      </div>
      {currency !== base && rate && <p className="text-xs text-stone-500">Converted at 1 {base} = {rate.rate.toFixed(2)} {currency}{rate.source === 'fallback' ? ' (approximate)' : ''}</p>}
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button type="submit" className="flex-1"><ArrowRight aria-hidden="true" className="size-4" />Mark as paid</Button>
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}
