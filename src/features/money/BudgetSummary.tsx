import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { formatMoney, minorUnits } from '@/lib/money'
import { Button, ErrorNote, Field, Input } from '@/ui'
import { budgetKey, budgetPosition, readBudget, saveBudget, type PersonalBudget } from './budget'

export function usePersonalBudget(tripId: string, me: string | null, currency: string) {
  return useLiveQuery(async () => me ? readBudget((await db._meta.get(budgetKey(tripId, me)))?.value, currency) : null, [tripId, me, currency])
}

export function BudgetSummary({ tripId, me, currency, totalMinor, incomplete }: { tripId: string; me: string; currency: string; totalMinor: number; incomplete: boolean }) {
  const budget = usePersonalBudget(tripId, me, currency)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  if (budget === undefined) return <p role="status" className="mt-3 text-sm text-muted">Loading your budget…</p>
  const position = budget ? budgetPosition(totalMinor, budget.amountMinor) : null
  return <section aria-label="Your private budget" className="mt-4 border-t border-line pt-3">
    <div className="flex flex-wrap items-center justify-between gap-x-3">
      <h3 className="text-sm font-semibold">Your budget{budget ? ` · ${formatMoney(budget.amountMinor, currency)}` : ''}</h3>
      {!editing && <Button variant="ghost" onClick={() => { setMessage(''); setEditing(true) }}>{budget ? 'Edit budget' : 'Set a budget'}</Button>}
    </div>
    {position && <>
      <p className={`mt-1 text-sm tabular-nums ${position.over ? 'text-danger-ink' : 'text-ink'}`}>≈ {formatMoney(Math.abs(position.remainingMinor), currency)} {position.over ? 'over your budget' : 'left in your budget'}{incomplete ? ' before unpriced plans' : ''}</p>
      <progress className="progress progress-neutral mt-2 h-2 w-full" aria-label="Estimated budget used" max={1} value={position.used} />
    </>}
    <p className="mt-1 text-xs text-muted">Private · Saved on this phone only. Budget uses {currency}.</p>
    {editing && <BudgetEditor tripId={tripId} me={me} currency={currency} budget={budget} onDone={(text) => { setEditing(false); setMessage(text) }} />}
    <p role="status" className="mt-1 text-xs text-muted empty:hidden">{message}</p>
  </section>
}

function BudgetEditor({ tripId, me, currency, budget, onDone }: { tripId: string; me: string; currency: string; budget: PersonalBudget | null; onDone: (message: string) => void }) {
  const [text, setText] = useState(() => budget ? (budget.amountMinor / 10 ** minorUnits(currency)).toFixed(minorUnits(currency)) : '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  async function persist(remove = false) {
    if (lock.current) return
    lock.current = true; setSaving(true); setError(null)
    try {
      if (remove) await db._meta.delete(budgetKey(tripId, me))
      else await saveBudget(tripId, me, text, currency)
      onDone(remove ? 'Budget removed from this phone.' : 'Budget saved on this phone.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your budget. Try again.'); lock.current = false; setSaving(false) }
  }
  return <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); void persist() }}>
    <Field label={`Trip budget (${currency})`} hint="Your share of the whole trip, including spending and planned costs."><Input inputMode="decimal" value={text} onChange={(event) => setText(event.target.value)} disabled={saving} required autoFocus /></Field>
    <ErrorNote error={error} />
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save budget'}</Button>
      <Button variant="secondary" type="button" disabled={saving} onClick={() => onDone('')}>Cancel</Button>
      {budget && <Button variant="ghost" type="button" disabled={saving} onClick={() => void persist(true)}>Remove budget</Button>}
    </div>
  </form>
}
