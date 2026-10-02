import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TripDb } from '@/data/db'
import { save, softDelete } from '@/data/repo'
import { saveTask, setTaskCompleted } from './data'

let db: TripDb
beforeEach(async () => {
  db = new TripDb(`tasks-test-${crypto.randomUUID()}`)
  await db.members.put({ id: 'alex', trip_id: 'trip', display_name: 'Alex', color: null, avatar_emoji: null, home_timezone: null })
})
afterEach(async () => { await db.delete() })
const fields = { title: ' Book shuttle ', assignee_id: 'alex', due_date: '2027-03-10', notes: ' Eight people ' }

describe('offline tasks', () => {
  it('queues creation, edits and reversible completion, preserving fields and coalescing writes', async () => {
    const id = await saveTask('trip', undefined, fields, 'alex', db)
    expect(await db.trip_tasks.get(id)).toMatchObject({ title: 'Book shuttle', notes: 'Eight people', completed: false, _dirty: 1 })
    await setTaskCompleted(id, true, 'alex', db)
    await saveTask('trip', id, { ...fields, title: 'Confirm shuttle' }, 'alex', db)
    expect(await db.trip_tasks.get(id)).toMatchObject({ title: 'Confirm shuttle', completed: true })
    await setTaskCompleted(id, false, 'alex', db)
    expect(await db.trip_tasks.get(id)).toMatchObject({ completed: false })
    expect((await db.trip_tasks.get(id))?.deleted_at).toBeFalsy()
    expect(await db._outbox.count()).toBe(1)
    expect((await db._outbox.toArray())[0]?.payload).toMatchObject({ title: 'Confirm shuttle', completed: false, assignee_id: 'alex' })
  })
  it('rejects invalid titles, dates, and assignment outside this trip', async () => {
    await expect(saveTask('trip', undefined, { ...fields, title: ' ' }, 'alex', db)).rejects.toThrow('task name')
    await expect(saveTask('trip', undefined, { ...fields, due_date: '2027-02-30' }, 'alex', db)).rejects.toThrow('valid due date')
    await expect(saveTask('other-trip', undefined, fields, 'alex', db)).rejects.toThrow('still in this trip')
    expect(await db._outbox.count()).toBe(0)
  })
  it('cannot revive a deleted task or change a different trip’s task', async () => {
    const id = await saveTask('trip', undefined, fields, 'alex', db)
    await expect(saveTask('other-trip', id, fields, 'alex', db)).rejects.toThrow('removed')
    await softDelete('trip_tasks', id, 'alex', db)
    await expect(saveTask('trip', id, fields, 'alex', db)).rejects.toThrow('removed')
    await expect(setTaskCompleted(id, true, 'alex', db)).rejects.toThrow('removed')
  })
  it('preserves a completion change that arrives while the edit form is open', async () => {
    const id = await saveTask('trip', undefined, fields, 'alex', db)
    const row = (await db.trip_tasks.get(id))!
    await save('trip_tasks', { ...row, completed: true }, 'sam', db)
    await saveTask('trip', id, { ...fields, due_date: null }, 'alex', db)
    expect(await db.trip_tasks.get(id)).toMatchObject({ completed: true, due_date: null })
  })
})
