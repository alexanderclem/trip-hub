import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { DateTime } from 'luxon'
import { ClipboardCheck, Plus } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useMembers, useTrip } from '@/data/hooks'
import type { TripTask } from '@/data/types'
import { ErrorNote, PageHeader } from '@/ui'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/ui/collection'
import { setTaskCompleted, useTasks } from './data'

export function TasksScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const me = useMyMemberId(tripId)
  const members = useMembers(tripId)
  const tasks = useTasks(tripId)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string[]>([])
  const today = DateTime.now().setZone(trip?.timezone ?? 'UTC').toISODate()!
  const visible = tasks?.filter((t) => filter === 'all' || (filter === 'mine' ? t.assignee_id === me : !t.assignee_id)) ?? []
  const open = visible.filter((t) => !t.completed)
  const completed = visible.filter((t) => t.completed)

  async function toggle(task: TripTask) {
    setError(null)
    setPending((ids) => [...ids, task.id])
    try { await setTaskCompleted(task.id, !task.completed, me) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Try again.') }
    finally { setPending((ids) => ids.filter((id) => id !== task.id)) }
  }

  function row(task: TripTask) {
    const overdue = !task.completed && task.due_date !== null && task.due_date < today
    const owner = task.assignee_id ? members?.find((m) => m.id === task.assignee_id)?.display_name ?? 'Former member' : 'Unassigned'
    return (
      <li key={task.id} className="flex items-start gap-1 border-b border-stone-100 py-2 last:border-0">
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl hover:bg-stone-50">
          <input type="checkbox" checked={task.completed} disabled={pending.includes(task.id)} onChange={() => void toggle(task)} aria-label={`Mark ${task.title} ${task.completed ? 'incomplete' : 'complete'}`} className="size-5 accent-brand-700" />
        </label>
        <Link to={`/t/${tripId}/more/tasks/${task.id}`} className="min-h-11 min-w-0 flex-1 rounded-xl px-2 py-2 hover:bg-stone-50">
          <p className={`break-words font-medium ${task.completed ? 'text-stone-500 line-through' : 'text-stone-900'}`}>{task.title}</p>
          <p className="mt-1 break-words text-sm text-stone-600">{owner}{task.assignee_id === me ? ' (you)' : ''}</p>
          {task.due_date && <p className={`mt-1 text-xs ${overdue ? 'font-medium text-red-700' : 'text-stone-500'}`}>{overdue ? 'Overdue · ' : task.due_date === today ? 'Due today · ' : 'Due '}{DateTime.fromISO(task.due_date).toFormat('d LLL yyyy')}</p>}
        </Link>
      </li>
    )
  }

  return (
    <div className="min-h-full pb-24">
      <PageHeader title="Tasks" back={`/t/${tripId}/more`} action={<Link to="new" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 font-medium text-brand-700 hover:bg-brand-50"><Plus aria-hidden="true" className="size-4" />Add task</Link>} />
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div role="group" aria-label="Filter tasks" className="flex flex-wrap gap-2">
          {[['all', 'Everyone'], ['mine', 'Assigned to me'], ['unassigned', 'Unassigned']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value!)} className={`min-h-11 rounded-xl border px-3 text-sm font-medium ${filter === value ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'}`}>{label}</button>)}
        </div>
        <ErrorNote error={error} />
        {tasks === undefined ? <p role="status" className="py-8 text-center text-stone-500">Loading tasks…</p> : visible.length === 0 ? (
          <Empty><ClipboardCheck aria-hidden="true" className="size-8 text-brand-700" /><EmptyHeader><EmptyTitle>{filter === 'all' ? 'No tasks yet' : 'No tasks here'}</EmptyTitle><EmptyDescription>{filter === 'all' ? 'Assign tasks to travelers and set due dates.' : 'Try another filter or add a task.'}</EmptyDescription></EmptyHeader><Link to="new" className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 font-medium text-white">Add a task</Link></Empty>
        ) : (
          <>
            <section aria-labelledby="open-tasks"><h2 id="open-tasks" className="mb-2 text-sm font-semibold text-stone-700">To do · {open.length}</h2>{open.length ? <ul className="rounded-2xl border border-stone-200 bg-white px-2">{open.map(row)}</ul> : <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">All caught up.</p>}</section>
            {completed.length > 0 && <section aria-labelledby="completed-tasks"><h2 id="completed-tasks" className="mb-2 text-sm font-semibold text-stone-700">Completed · {completed.length}</h2><ul className="rounded-2xl border border-stone-200 bg-white px-2">{completed.map(row)}</ul></section>}
          </>
        )}
      </div>
    </div>
  )
}
