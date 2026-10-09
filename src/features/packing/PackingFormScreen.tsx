import { useConfirm } from '@/ui/ConfirmProvider'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMyMemberId } from '@/data/device'
import { useMembers } from '@/data/hooks'
import type { PackingKind } from '@/data/types'
import { Button, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/ui'
import { deletePackingItem, savePackingItem, usePacking, usePackingItem, type PackingFields } from './data'

const KINDS: { value: PackingKind; label: string; hint: string }[] = [
  { value: 'everyone', label: 'Everyone brings', hint: 'Each person ticks their own' },
  { value: 'group', label: 'Group gear', hint: 'One person brings it for all' },
  { value: 'personal', label: 'Just me', hint: 'On your own list only' },
]

export function PackingFormScreen() {
  const { tripId, itemId } = useParams() as { tripId: string; itemId?: string }
  const item = usePackingItem(itemId)
  const back = `/t/${tripId}/more/packing`
  return <div className="min-h-full pb-24"><PageHeader title={itemId ? 'Edit item' : 'Add to packing'} back={back} />
    {itemId && item === undefined ? <p role="status" className="p-4 text-stone-600">Loading item…</p>
      : (itemId && item === null) || item?.deleted_at || (item && item.trip_id !== tripId) ? <p className="p-4 text-stone-600">This item is no longer on the list.</p>
        : <PackingEditor key={itemId ?? 'new'} tripId={tripId} itemId={itemId} initial={item ?? { title: '', kind: 'everyone', category: null, owner_id: null, quantity: null, notes: null }} />}
  </div>
}

function PackingEditor({ tripId, itemId, initial }: { tripId: string; itemId?: string; initial: PackingFields }) {
  const confirm = useConfirm()
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const members = useMembers(tripId) ?? []
  const categories = [...new Set((usePacking(tripId)?.items ?? []).flatMap((i) => (i.category ? [i.category] : [])))].sort()
  // Initial state is captured once; background sync must not replace an in-progress edit.
  const [fields, setFields] = useState<PackingFields>(() => ({ title: initial.title, kind: initial.kind, category: initial.category, owner_id: initial.owner_id, quantity: initial.quantity, notes: initial.notes }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const back = `/t/${tripId}/more/packing`
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    try { await savePackingItem(tripId, itemId, fields, me); navigate(back) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Try again.'); setBusy(false) }
  }
  async function remove() {
    if (!itemId || !await confirm(fields.kind === 'personal' ? 'Remove this from your list?' : 'Remove this item for everyone?')) return
    setBusy(true); setError(null)
    try { await deletePackingItem(itemId, me); navigate(back) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not remove. Try again.'); setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 p-4">
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <Field label="Item"><Input required maxLength={200} value={fields.title} onChange={(e) => setFields({ ...fields, title: e.target.value })} placeholder="Bug spray" /></Field>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-stone-700">Who packs it</legend>
          {KINDS.map((k) => (
            <label key={k.value} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${fields.kind === k.value ? 'border-brand-700 bg-brand-50' : 'border-stone-200 bg-white'}`}>
              <input type="radio" name="kind" value={k.value} checked={fields.kind === k.value} onChange={() => setFields({ ...fields, kind: k.value })} className="size-4 accent-brand-700" />
              <span><span className="block font-medium">{k.label}</span><span className="block text-xs text-stone-600">{k.hint}</span></span>
            </label>
          ))}
        </fieldset>
        {fields.kind === 'group' && (
          <Field label="Who’s bringing it">
            <Select value={fields.owner_id ?? ''} onChange={(e) => setFields({ ...fields, owner_id: e.target.value || null })}>
              <option value="">Nobody yet</option>
              {fields.owner_id && !members.some((m) => m.id === fields.owner_id) && <option value={fields.owner_id}>Former member — choose someone else</option>}
              {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}{m.id === me ? ' (you)' : ''}</option>)}
            </Select>
          </Field>
        )}
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <Field label="Category" hint="Optional">
              <Input list="packing-categories" maxLength={40} value={fields.category ?? ''} onChange={(e) => setFields({ ...fields, category: e.target.value })} placeholder="Clothes" />
            </Field>
            <datalist id="packing-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <Field label="How many">
            <Input type="number" inputMode="numeric" min={1} max={99} className="w-24" value={fields.quantity ?? ''} onChange={(e) => setFields({ ...fields, quantity: e.target.value ? Number(e.target.value) : null })} />
          </Field>
        </div>
        <Field label="Notes"><Textarea value={fields.notes ?? ''} onChange={(e) => setFields({ ...fields, notes: e.target.value })} placeholder="Brand, size, or where to buy it" /></Field>
      </fieldset>
      <ErrorNote error={error} />
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Saving…' : 'Save item'}</Button>
      {itemId && <Button type="button" variant="danger" disabled={busy} onClick={() => void remove()} className="w-full">Remove item</Button>}
    </form>
  )
}
