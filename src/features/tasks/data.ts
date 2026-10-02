import { useLiveQuery } from 'dexie-react-hooks'
import { DateTime } from 'luxon'
import { db, type TripDb } from '@/data/db'
import { save, softDelete } from '@/data/repo'
import type { TripTask } from '@/data/types'
import { newId } from '@/lib/ids'

export function useTasks(tripId: string) {
  return useLiveQuery(async () => (await db.trip_tasks.where('trip_id').equals(tripId)
    .filter((t) => !t.deleted_at).toArray()).sort((a, b) =>
    Number(a.completed) - Number(b.completed) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.title.localeCompare(b.title)), [tripId])
}

export function useTask(id: string | undefined) {
  return useLiveQuery(async () => id ? (await db.trip_tasks.get(id)) ?? null : null, [id])
}

export type TaskFields = Pick<TripTask, 'title' | 'assignee_id' | 'due_date' | 'notes'>

export async function saveTask(tripId: string, id: string | undefined, fields: TaskFields, me: string | null, database: TripDb = db) {
  const title = fields.title.trim()
  if (!title || title.length > 200) throw new Error('Use a task name between 1 and 200 characters.')
  if (fields.due_date && (!/^\d{4}-\d{2}-\d{2}$/.test(fields.due_date) || !DateTime.fromISO(fields.due_date).isValid)) throw new Error('Choose a valid due date.')
  const existing = id ? await database.trip_tasks.get(id) : undefined
  if (id && (!existing || existing.deleted_at || existing.trip_id !== tripId)) throw new Error('This task was removed. Return to Tasks to add a new one.')
  if (fields.assignee_id) {
    const member = await database.members.get(fields.assignee_id)
    if (!member || member.trip_id !== tripId || member.deleted_at) throw new Error('Choose someone who is still in this trip.')
  }
  const row: TripTask = {
    ...existing, id: id ?? newId(), trip_id: tripId, completed: existing?.completed ?? false,
    ...fields, title, notes: fields.notes?.trim() || null,
  }
  await save('trip_tasks', row, me, database)
  return row.id
}

export async function setTaskCompleted(id: string, completed: boolean, me: string | null, database: TripDb = db) {
  const task = await database.trip_tasks.get(id)
  if (!task || task.deleted_at) throw new Error('This task has been removed.')
  await save('trip_tasks', { ...task, completed }, me, database)
}

export const deleteTask = (id: string, me: string | null) => softDelete('trip_tasks', id, me)
