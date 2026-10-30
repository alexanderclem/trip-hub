import { TravelerLink } from '@/features/trips/TravelerLink'
import { useTripAccess } from '@/data/device'
import { can } from '@/data/access'
import { useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { DateTime } from 'luxon'
import { CheckCircle2, Plus } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useMembers, useTrip } from '@/data/hooks'
import type { TripTask } from '@/data/types'
import { ErrorNote, LinkButton, PageHeader } from '@/ui'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle, ListSkeleton } from '@/ui/collection'
import { setTaskCompleted, useTasks } from './data'
import { Stowie } from '@/features/stowie/Stowie'

export function TasksScreen() {
  const { tripId } = useParams() as { tripId: string }
  const mayPlan = can(useTripAccess(tripId), 'plan')
  const trip = useTrip(tripId)
  const me = useMyMemberId(tripId)
  const members = useMembers(tripId)
  const tasks = useTasks(tripId)
  const [params, setParams] = useSearchParams()
  const asked = params.get('filter')
  const filter = asked === 'mine' || asked === 'unassigned' ? asked : 'all'
  const setFilter = (value: string) => setParams((previous) => { const next = new URLSearchParams(previous); if (value === 'all') next.delete('filter'); else next.set('filter', value); return next }, { replace: true })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string[]>([])
  const locked = useRef(new Set<string>())
  const [feedback, setFeedback] = useState('')
  const today = DateTime.now().setZone(trip?.timezone ?? 'UTC').toISODate()!
  const visible = tasks?.filter((t) => filter === 'all' || (filter === 'mine' ? t.assignee_id === me : !t.assignee_id)) ?? []
  const open = visible.filter((t) => !t.completed)
  const completed = visible.filter((t) => t.completed)

  async function toggle(task: TripTask) {
    if (locked.current.has(task.id)) return
    locked.current.add(task.id)
    setError(null)
    setFeedback('')
    setPending((ids) => [...ids, task.id])
    try {
      await setTaskCompleted(task.id, !task.completed, me)
      setFeedback(task.completed ? 'Task reopened on this device.' : 'Task completed on this device.')
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Try again.') }
    finally { locked.current.delete(task.id); setPending((ids) => ids.filter((id) => id !== task.id)) }
  }

  function row(task: TripTask) {
    const overdue = !task.completed && task.due_date !== null && task.due_date < today
    const assignedMember = members?.find((m) => m.id === task.assignee_id)
    const owner = task.assignee_id ? assignedMember?.display_name ?? 'Former member' : 'Unassigned'
    return (
      <li key={task.id} className="flex items-start gap-1 border-b border-line py-2 last:border-0">
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control hover:bg-brand-50">
          <input type="checkbox" checked={task.completed} disabled={pending.includes(task.id)} onChange={() => void toggle(task)} aria-label={`Mark ${task.title} ${task.completed ? 'incomplete' : 'complete'}`} className="ui-check" />
        </label>
        <div className="min-w-0 flex-1"><Link to={`/t/${tripId}/more/tasks/${task.id}`} className="block min-h-11 min-w-0 rounded-control px-2 py-2 hover:bg-brand-50">
          <p className={`break-words font-medium ${task.completed ? 'text-muted line-through' : 'text-ink'}`}>{task.title}</p>
          {task.due_date && <p className={`mt-1 text-xs ${overdue ? 'font-medium text-danger-ink' : 'text-muted'}`}>{overdue ? 'Overdue · ' : task.due_date === today ? 'Due today · ' : 'Due '}{DateTime.fromISO(task.due_date).toFormat('d LLL yyyy')}</p>}
        </Link><div className="px-2 text-sm">{assignedMember ? <TravelerLink member={assignedMember} avatar={false} you={task.assignee_id === me} /> : owner}</div></div>
      </li>
    )
  }

  return (
    <div className="min-h-full pb-24">
      <PageHeader title="Tasks" back={`/t/${tripId}/more`} action={mayPlan && <Link to="new" className="inline-flex min-h-11 items-center gap-1 rounded-control px-3 font-medium text-action hover:bg-brand-50"><Plus aria-hidden="true" className="size-4" />Add task</Link>} />
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div role="group" aria-label="Filter tasks" className="flex flex-wrap gap-2">
          {[['all', 'Everyone'], ['mine', 'Assigned to me'], ['unassigned', 'Unassigned']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value!)} className={`min-h-11 rounded-control border px-3 text-sm font-medium ${filter === value ? 'border-action bg-action text-white' : 'border-line bg-surface text-ink hover:bg-brand-50'}`}>{label}</button>)}
        </div>
        <ErrorNote error={error} />
        <div role="status" className="save-feedback">{feedback && <p><CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />{feedback}</p>}</div>
        {tasks === undefined ? <ListSkeleton label="Loading tasks…" rows={4} className="py-4" /> : visible.length === 0 ? (
          <Empty><Stowie size={64} /><EmptyHeader><EmptyTitle>{filter === 'all' ? 'No tasks yet' : 'No tasks here'}</EmptyTitle><EmptyDescription>{filter === 'all' ? 'Assign tasks to travelers and set due dates.' : 'Try another filter or add a task.'}</EmptyDescription></EmptyHeader><LinkButton to="new">Add a task</LinkButton></Empty>
        ) : (
          <>
            <section aria-labelledby="open-tasks"><h2 id="open-tasks" className="mb-2 text-sm font-semibold text-ink">To do · {open.length}</h2>{open.length ? <ul className="rounded-surface border border-line bg-surface px-2">{open.map(row)}</ul> : <p className="rounded-surface bg-brand-50 p-4 text-sm text-ink">All caught up.</p>}</section>
            {completed.length > 0 && <section aria-labelledby="completed-tasks"><h2 id="completed-tasks" className="mb-2 text-sm font-semibold text-ink">Completed · {completed.length}</h2><ul className="rounded-surface border border-line bg-surface px-2">{completed.map(row)}</ul></section>}
          </>
        )}
      </div>
    </div>
  )
}
