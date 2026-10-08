import { useLiveQuery } from 'dexie-react-hooks'
import { DateTime } from 'luxon'
import { db } from '@/data/db'
import { save, softDelete } from '@/data/repo'
import type { Comment, CommentSubject } from '@/data/types'
import { newId } from '@/lib/ids'

export const COMMENT_MAX = 1000

/** Oldest first, so a thread reads top to bottom. */
export const inOrder = (comments: Comment[]): Comment[] =>
  comments.filter((c) => !c.deleted_at).sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id))

export function useComments(type: CommentSubject, subjectId: string | undefined) {
  return useLiveQuery(
    async () => (subjectId ? inOrder(await db.comments.where('[subject_type+subject_id]').equals([type, subjectId]).toArray()) : []),
    [type, subjectId],
  )
}

/** How many live comments each subject of one kind has, for list cards. */
export function useCommentCounts(tripId: string, type: CommentSubject): Map<string, number> | undefined {
  return useLiveQuery(async () => {
    const counts = new Map<string, number>()
    await db.comments.where('trip_id').equals(tripId).each((c) => {
      if (c.subject_type === type && !c.deleted_at) counts.set(c.subject_id, (counts.get(c.subject_id) ?? 0) + 1)
    })
    return counts
  }, [tripId, type])
}

export async function addComment(tripId: string, type: CommentSubject, subjectId: string, memberId: string, body: string): Promise<void> {
  const text = body.trim().slice(0, COMMENT_MAX)
  if (!text) return
  const row: Comment = { id: newId(), trip_id: tripId, subject_type: type, subject_id: subjectId, member_id: memberId, body: text }
  await save('comments', row, memberId)
}

export const removeComment = (comment: Comment, memberId: string) => softDelete('comments', comment.id, memberId)

/** "2 hours ago"; "just now" under a minute, including a phone whose clock runs a little behind. */
export function ago(at: string | undefined, now: number): string {
  if (!at) return 'just now'
  const then = DateTime.fromISO(at)
  if (!then.isValid || now - then.toMillis() < 60_000) return 'just now'
  return then.toRelative({ base: DateTime.fromMillis(now), locale: 'en' }) ?? 'just now'
}
