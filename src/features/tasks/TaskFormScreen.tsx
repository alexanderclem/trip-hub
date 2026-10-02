import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMyMemberId } from '@/data/device'
import { useMembers } from '@/data/hooks'
import { Button, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/ui'
import { deleteTask, saveTask, useTask, type TaskFields } from './data'

export function TaskFormScreen() {
  const { tripId, taskId } = useParams() as { tripId: string; taskId?: string }
  const task = useTask(taskId)
  const back = `/t/${tripId}/more/tasks`
  return <div className="min-h-full pb-24"><PageHeader title={taskId ? 'Edit task' : 'Add task'} back={back} />
    {taskId && task === undefined ? <p role="status" className="p-4 text-stone-500">Loading task…</p>
      : (taskId && task === null) || task?.deleted_at || (task && task.trip_id !== tripId) ? <p className="p-4 text-stone-600">This task is no longer available.</p>
        : <TaskEditor key={taskId ?? 'new'} tripId={tripId} taskId={taskId} initial={task ?? { title: '', assignee_id: null, due_date: null, notes: null }} />}
  </div>
}

function TaskEditor({ tripId, taskId, initial }: { tripId: string; taskId?: string; initial: TaskFields }) {
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const members = useMembers(tripId) ?? []
  // Initial state is captured once; background sync must not replace an in-progress edit.
  const [fields, setFields] = useState<TaskFields>(() => ({ title: initial.title, assignee_id: initial.assignee_id, due_date: initial.due_date, notes: initial.notes }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const back = `/t/${tripId}/more/tasks`
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    try { await saveTask(tripId, taskId, fields, me); navigate(back) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Try again.'); setBusy(false) }
  }
  async function remove() {
    if (!taskId || !window.confirm('Remove this task for everyone?')) return
    setBusy(true); setError(null)
    try { await deleteTask(taskId, me); navigate(back) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not remove task. Try again.'); setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 p-4">
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <Field label="Task"><Input required maxLength={200} value={fields.title} onChange={(e) => setFields({ ...fields, title: e.target.value })} placeholder="Book the airport shuttle" /></Field>
        <Field label="Assigned to"><Select value={fields.assignee_id ?? ''} onChange={(e) => setFields({ ...fields, assignee_id: e.target.value || null })}><option value="">Unassigned</option>{fields.assignee_id && !members.some((m) => m.id === fields.assignee_id) && <option value={fields.assignee_id}>Former member — choose someone else</option>}{members.map((m) => <option key={m.id} value={m.id}>{m.display_name}{m.id === me ? ' (you)' : ''}</option>)}</Select></Field>
        <Field label="Due date" hint="Optional. Dates follow the trip’s local calendar."><Input type="date" value={fields.due_date ?? ''} onChange={(e) => setFields({ ...fields, due_date: e.target.value || null })} /></Field>
        <Field label="Notes"><Textarea value={fields.notes ?? ''} onChange={(e) => setFields({ ...fields, notes: e.target.value })} placeholder="Booking link, headcount, or anything the owner needs" /></Field>
      </fieldset>
      <ErrorNote error={error} />
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Saving…' : 'Save task'}</Button>
      {taskId && <Button type="button" variant="danger" disabled={busy} onClick={() => void remove()} className="w-full">Remove task</Button>}
    </form>
  )
}
