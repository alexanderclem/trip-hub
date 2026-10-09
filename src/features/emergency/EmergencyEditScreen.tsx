import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Plus, Trash2 } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useTrip } from '@/data/hooks'
import { Button, ErrorNote, Field, Input, PageHeader, Textarea } from '@/ui'
import { EMPTY_SAFETY, saveMySafety, saveTripEmergency, safetyId, tripEmergency, useSafety, type Contact, type SafetyFields, type TripEmergency } from './data'
import { ListSkeleton } from '@/ui/collection'

/** My own emergency card. Fills itself once, so background sync never undoes typing. */
export function EmergencyEditScreen() {
  const { tripId } = useParams() as { tripId: string }
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const rows = useSafety(tripId)
  const [fields, setFields] = useState<SafetyFields>(EMPTY_SAFETY)
  const loaded = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const back = `/t/${tripId}/more/emergency`

  useEffect(() => {
    if (loaded.current || rows === undefined || !me) return
    loaded.current = true
    const mine = rows.find((r) => r.id === safetyId(tripId, me))
    if (mine) setFields(Object.fromEntries(Object.keys(EMPTY_SAFETY).map((k) => [k, mine[k as keyof SafetyFields]])) as unknown as SafetyFields)
  }, [rows, me, tripId])

  const set = (k: keyof SafetyFields) => (e: { target: { value: string } }) => setFields((f) => ({ ...f, [k]: e.target.value }))
  const v = (k: keyof SafetyFields) => fields[k] ?? ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try { await saveMySafety(tripId, me, fields); navigate(back) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Try again.'); setBusy(false) }
  }

  return (
    <div className="min-h-full pb-24">
      <PageHeader title="My emergency card" back={back} />
      {!me ? <p className="p-4 text-stone-600">Choose who you are in this trip first.</p> : (
        <form onSubmit={submit} className="mx-auto max-w-md space-y-4 p-4">
          <p className="text-sm text-stone-600">Everyone on the trip can see this, even offline. Leave out anything you’d rather not share.</p>
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <legend className="font-semibold">Who to call</legend>
            <Field label="Name"><Input value={v('emergency_name')} onChange={set('emergency_name')} maxLength={120} autoComplete="off" /></Field>
            <div className="flex gap-3">
              <div className="min-w-0 flex-1"><Field label="Relationship"><Input value={v('emergency_relation')} onChange={set('emergency_relation')} maxLength={60} placeholder="Mom" /></Field></div>
              <div className="min-w-0 flex-1"><Field label="Phone"><Input type="tel" value={v('emergency_phone')} onChange={set('emergency_phone')} maxLength={40} placeholder="+1 555 123 4567" /></Field></div>
            </div>
          </fieldset>
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <legend className="font-semibold">Health</legend>
            <Field label="Allergies"><Textarea value={v('allergies')} onChange={set('allergies')} maxLength={500} placeholder="Penicillin, peanuts" /></Field>
            <Field label="Conditions and medication"><Textarea value={v('medical')} onChange={set('medical')} maxLength={1000} /></Field>
            <Field label="Blood type"><Input className="w-28" value={v('blood_type')} onChange={set('blood_type')} maxLength={10} placeholder="O+" /></Field>
          </fieldset>
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <legend className="font-semibold">Travel insurance</legend>
            <Field label="Provider"><Input value={v('insurance_provider')} onChange={set('insurance_provider')} maxLength={120} /></Field>
            <div className="flex gap-3">
              <div className="min-w-0 flex-1"><Field label="Policy number"><Input value={v('insurance_policy')} onChange={set('insurance_policy')} maxLength={80} /></Field></div>
              <div className="min-w-0 flex-1"><Field label="Assistance phone"><Input type="tel" value={v('insurance_phone')} onChange={set('insurance_phone')} maxLength={40} /></Field></div>
            </div>
            <Field label="Anything else"><Textarea value={v('notes')} onChange={set('notes')} maxLength={1000} /></Field>
          </fieldset>
          <ErrorNote error={error} />
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Saving…' : 'Save my card'}</Button>
        </form>
      )}
    </div>
  )
}

const blankContact: Contact = { name: '', phone: null, address: null }

/** Trip-wide numbers: police, ambulance, tourist assistance, hospital, embassy. */
export function EmergencyNumbersScreen() {
  const { tripId } = useParams() as { tripId: string }
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const trip = useTrip(tripId)
  const [info, setInfo] = useState<TripEmergency | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const back = `/t/${tripId}/more/emergency`

  useEffect(() => {
    if (info || !trip) return
    const current = tripEmergency(trip)
    setInfo({ ...current, numbers: current.numbers.length ? current.numbers : [{ label: '', phone: '' }] })
  }, [trip, info])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!trip || !info) return
    setBusy(true); setError(null)
    try { await saveTripEmergency(trip, info, me); navigate(back) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Try again.'); setBusy(false) }
  }

  const contactFields = (key: 'hospital' | 'embassy', title: string) => {
    const c = info?.[key] ?? blankContact
    const update = (patch: Partial<Contact>) => setInfo((i) => i && ({ ...i, [key]: { ...c, ...patch } }))
    return (
      <fieldset className="min-w-0 space-y-3">
        <legend className="font-semibold">{title}</legend>
        <Field label="Name"><Input value={c.name} onChange={(e) => update({ name: e.target.value })} maxLength={120} /></Field>
        <Field label="Phone"><Input type="tel" value={c.phone ?? ''} onChange={(e) => update({ phone: e.target.value || null })} maxLength={40} /></Field>
        <Field label="Address"><Input value={c.address ?? ''} onChange={(e) => update({ address: e.target.value || null })} maxLength={200} /></Field>
      </fieldset>
    )
  }

  return (
    <div className="min-h-full pb-24">
      <PageHeader title="Emergency numbers" back={back} />
      {!info ? <ListSkeleton label="Loading…" className="p-4" /> : (
        <form onSubmit={submit} className="mx-auto max-w-md space-y-5 p-4">
          <p className="text-sm text-stone-600">Shared with the whole trip. Look these up for your destination while you have signal.</p>
          <fieldset disabled={busy} className="min-w-0 space-y-2">
            <legend className="font-semibold">Phone numbers</legend>
            {info.numbers.map((n, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="min-w-0 flex-1"><Field label={i === 0 ? 'What' : ''}><Input aria-label={`Number ${i + 1} name`} value={n.label} placeholder="Police" maxLength={60} onChange={(e) => setInfo({ ...info, numbers: info.numbers.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /></Field></div>
                <div className="w-32"><Field label={i === 0 ? 'Number' : ''}><Input aria-label={`Number ${i + 1} phone`} type="tel" value={n.phone} placeholder="110" maxLength={40} onChange={(e) => setInfo({ ...info, numbers: info.numbers.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)) })} /></Field></div>
                <button type="button" aria-label={`Remove number ${i + 1}`} onClick={() => setInfo({ ...info, numbers: info.numbers.filter((_, j) => j !== i) })} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"><Trash2 aria-hidden="true" className="size-4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setInfo({ ...info, numbers: [...info.numbers, { label: '', phone: '' }] })} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-brand-700 hover:bg-brand-50"><Plus aria-hidden="true" className="size-4" />Add a number</button>
          </fieldset>
          <div className="space-y-5" aria-disabled={busy}>
            {contactFields('hospital', 'Nearest good hospital')}
            {contactFields('embassy', 'Embassy or consulate')}
          </div>
          <ErrorNote error={error} />
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Saving…' : 'Save for everyone'}</Button>
        </form>
      )}
    </div>
  )
}
