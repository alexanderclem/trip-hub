import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import type { ItineraryItem, Member, Poll, PollOption } from '@/data/types'
import { useMyMemberId } from '@/data/device'
import { useTasks } from '@/features/tasks/data'
import { useAttachments } from '@/features/tickets/files'
import { Button, DateInput, ErrorNote, Field, Input, LinkButton, Select } from '@/ui'
import { assignBooking, bookingTaskId, decisionItem, finishBooking, linkDecisionItem } from './handoff'

export function DecisionHandoff({ poll, option, items, members, mayPlan }: { poll: Poll; option: PollOption; items: ItineraryItem[] | undefined; members: Member[]; mayPlan: boolean }) {
  const me = useMyMemberId(poll.trip_id)
  const tasks = useTasks(poll.trip_id)
  const attachments = useAttachments(poll.trip_id)
  const [assignee, setAssignee] = useState<string | null>(null)
  const [due, setDue] = useState<string | null>(null)
  const [existingId, setExistingId] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const item = items && decisionItem(items, poll, option)
  const task = tasks?.find((t) => t.id === bookingTaskId(poll.trip_id, option.id))
  const tickets = attachments?.filter((a) => a.att.item_id === item?.id) ?? []
  const done = !!item && item.status === 'confirmed' && (item.details?.decision_booking === 'not_required' || !!item.confirmation_code || tickets.length > 0)
  const owner = members.find((m) => m.id === task?.assignee_id)
  const existingOptions = (items ?? []).filter((i) => !i.deleted_at && i.status !== 'cancelled' && !i.details?.decision_poll_id)
  const root = `/t/${poll.trip_id}`
  async function run(action: () => Promise<unknown>) {
    if (inFlight.current || !me || !mayPlan) return
    inFlight.current = true; setBusy(true); setError(null); setMessage('')
    try { await action(); setMessage('Saved on this phone. Changes will sync when connected.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Your entries are kept; try again.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  async function assign(e: FormEvent) {
    e.preventDefault()
    await run(() => assignBooking(poll.trip_id, poll.id, option.id, { assignee_id: assignee ?? task?.assignee_id ?? null, due_date: (due ?? task?.due_date) || null }, me!))
  }
  if (items === undefined || tasks === undefined || attachments === undefined) return <p role="status" className="mt-3 text-sm text-muted">Checking the next steps…</p>
  if (poll.status !== 'closed') return <p className="mt-3 text-sm text-muted">The vote will be finalized when connected. Then you can plan the chosen option.</p>
  return <section className="mt-4 border-t border-line pt-4" aria-label="Finish this decision">
    <h2 className="ui-section-title">Make it happen</h2>
    <p className="mt-1 text-sm text-muted">The group has chosen. Nothing is booked automatically.</p>
    <ol className="mt-4 space-y-5">
      <li><h3 className="font-semibold">1. Put it on the plan</h3>{item ? <Link className="ui-link mt-2" to={`${root}/plan/${item.id}`}>{item.title} · View in the plan</Link> : mayPlan ? <LinkButton className="mt-2" to={`${root}/plan/new?${new URLSearchParams({ ...(option.place_id ? { place: option.place_id } : { title: option.label }), decision: poll.id, option: option.id })}`}>Schedule the chosen option</LinkButton> : <p className="mt-1 text-sm text-muted">An organizer can schedule this choice.</p>}{!item && mayPlan && existingOptions.length > 0 && <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); void run(() => linkDecisionItem(poll.trip_id, poll.id, option.id, existingId, me!)) }}><Field label="Or link an existing plan item"><Select required disabled={busy} value={existingId} onChange={(e) => setExistingId(e.target.value)}><option value="">Choose from the plan</option>{existingOptions.map((i) => <option key={i.id} value={i.id}>{i.title} · {i.start_local.slice(0, 10)}</option>)}</Select></Field><Button type="submit" disabled={busy} variant="secondary">Link to this decision</Button></form>}</li>
      <li><h3 className="font-semibold">2. Give the booking an owner</h3>{task && <p className="mt-1 text-sm">{owner?.display_name ?? 'Owner to be chosen'}{task.due_date && ` · due ${task.due_date}`} · <Link className="ui-link" to={`${root}/more/tasks/${task.id}`}>View task</Link>{task.completed && <span className="block text-muted">Task marked complete. Booking confirmation is checked separately.</span>}</p>}
        {mayPlan && !done && <form className="mt-2 space-y-3" onSubmit={assign}><fieldset disabled={busy} className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Booking owner"><Select required value={assignee ?? task?.assignee_id ?? ''} onChange={(e) => setAssignee(e.target.value)}><option value="">Choose someone</option>{members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</Select></Field><Field label="Book by (optional)"><DateInput value={due ?? task?.due_date ?? ''} onValue={setDue} /></Field></fieldset><Button disabled={busy} type="submit" variant="secondary">{task ? 'Update booking task' : 'Assign booking task'}</Button></form>}
        {!mayPlan && !task && <p className="mt-1 text-sm text-muted">An organizer can assign the booking.</p>}
      </li>
      <li><h3 className="font-semibold">3. Keep the confirmation with the plan</h3>{done ? <p className="mt-2 text-sm text-success-ink">{item.details?.decision_booking === 'not_required' ? 'Confirmed · no booking needed' : 'Confirmed · booking details saved'}</p> : item && mayPlan ? <form className="mt-2 space-y-3" onSubmit={(e) => { e.preventDefault(); void run(() => finishBooking(poll.trip_id, poll.id, option.id, item.id, code, false, me!)) }}>
        <Field label="Booking confirmation code"><Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={200} disabled={busy} placeholder={item.confirmation_code ?? 'Add code, or attach a ticket below'} /></Field>
        <Link className="ui-link" to={`${root}/tickets/new?item=${item.id}`}>Attach a ticket or confirmation</Link>
        {!!tickets.length && <ul className="space-y-1">{tickets.map(({ att, onPhone }) => <li key={att.id}><Link className="ui-link" to={`${root}/tickets/${att.id}`}>{att.title}{!onPhone && ' · not downloaded'}</Link></li>)}</ul>}
        <div className="flex flex-wrap gap-3"><Button disabled={busy} type="submit">Confirm booking</Button><Button disabled={busy} type="button" variant="secondary" onClick={() => void run(() => finishBooking(poll.trip_id, poll.id, option.id, item.id, '', true, me!))}>No booking needed</Button></div>
      </form> : <p className="mt-1 text-sm text-muted">{item ? 'Waiting for an organizer to confirm the details.' : 'Schedule it first, then add a confirmation or mark that no booking is needed.'}</p>}</li>
    </ol>
    <p className="mt-3 text-sm text-muted" role="status">{busy ? 'Saving…' : message}</p><ErrorNote error={error} />
  </section>
}
