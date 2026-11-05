import { TravelerLink } from '@/features/trips/TravelerLink'
import { useState, type FormEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useMembers } from '@/data/hooks'
import type { Comment, CommentSubject, LocalColumns } from '@/data/types'
import { Avatar, Button, Card, ErrorNote, Textarea } from '@/ui'
import { useConfirm } from '@/ui/ConfirmProvider'
import { addComment, ago, COMMENT_MAX, delivery, editComment, removeComment, useComments, useRejectedComments, wasEdited } from './data'

/** What the group has said about one vote, place or plan item, with a box to add to it. */
export function CommentThread({ tripId, type, subjectId, me, prompt = 'Add a comment' }: {
  tripId: string; type: CommentSubject; subjectId: string; me: string | null; prompt?: string
}) {
  const comments = useComments(type, subjectId)
  const members = useMembers(tripId) ?? []
  const confirm = useConfirm()
  // The draft lives only here, so background sync refreshing the list never touches it.
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rejected = useRejectedComments()
  // One comment at a time can be edited; its text lives here until saved, like the draft.
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const now = Date.now()
  const titleId = `comments-${type}-${subjectId}`

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!me || !draft.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await addComment(tripId, type, subjectId, me, draft)
      setDraft('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your comment. Try again.') }
    finally { setBusy(false) }
  }

  async function saveEdit(e: FormEvent, comment: Comment) {
    e.preventDefault()
    if (!me || !editing || busy) return
    setBusy(true)
    setEditError(null)
    try {
      await editComment(comment, me, editing.text)
      setEditing(null)
    } catch (e) { setEditError(e instanceof Error ? e.message : 'Could not save your change. Try again.') }
    finally { setBusy(false) }
  }

  return (
    <Card>
      <section aria-labelledby={titleId}>
        <h2 id={titleId} className="ui-section-title">Comments{comments?.length ? ` (${comments.length})` : ''}</h2>
        {comments?.length === 0 && <p className="mt-2 text-sm text-muted">No comments yet.</p>}
        {!!comments?.length && (
          <ul className="mt-3 space-y-4">
            {comments.map((c) => {
              const author = members.find((m) => m.id === c.member_id)
              const name = author?.display_name ?? 'Someone'
              return (
                <li key={c.id} className="flex items-start gap-3">
                  <Avatar name={name} color={author?.color ?? null} photo={author?.avatar_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><span className="font-medium">{author ? <TravelerLink member={author} you={c.member_id === me} avatar={false} /> : name}</span> <span className="text-xs text-muted">· {ago(c.created_at, now)}{wasEdited(c) ? ' · edited' : ''}</span></p>
                    {editing?.id === c.id ? (
                      <form onSubmit={(e) => saveEdit(e, c)} className="mt-1 space-y-2">
                        <Textarea value={editing.text} onChange={(e) => setEditing({ id: c.id, text: e.target.value })} rows={2} maxLength={COMMENT_MAX} aria-label="Edit your comment" autoFocus />
                        <ErrorNote error={editError} />
                        <div className="flex gap-2">
                          <Button type="submit" variant="secondary" className="flex-1" disabled={busy || !editing.text.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
                          <Button type="button" variant="ghost" className="flex-1" onClick={() => { setEditing(null); setEditError(null) }}>Cancel</Button>
                        </div>
                      </form>
                    ) : (
                      <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-ink">{c.body}</p>
                    )}
                    {c.member_id === me && <DeliveryNote state={delivery(c as Comment & LocalColumns, rejected)} />}
                  </div>
                  {c.member_id === me && editing?.id !== c.id && (
                    <div className="-my-2 flex shrink-0">
                      <button onClick={() => { setEditing({ id: c.id, text: c.body }); setEditError(null) }} className="flex size-11 items-center justify-center rounded-control text-muted hover:bg-brand-50" aria-label={`Edit your comment: ${c.body.slice(0, 40)}`}>
                        <Pencil aria-hidden="true" className="size-4" />
                      </button>
                      <button onClick={async () => { if (await confirm('Remove your comment? This can’t be undone.')) await removeComment(c, me) }} className="flex size-11 items-center justify-center rounded-control text-muted hover:bg-brand-50" aria-label={`Remove your comment: ${c.body.slice(0, 40)}`}>
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {me && (
          <form onSubmit={submit} className="mt-3 space-y-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={COMMENT_MAX} placeholder={prompt} aria-label={prompt} />
            <ErrorNote error={error} />
            {draft.trim() && <Button type="submit" variant="secondary" className="w-full" disabled={busy}>{busy ? 'Posting…' : 'Post comment'}</Button>}
          </form>
        )}
      </section>
    </Card>
  )
}

/** Only the author sees this: whether the group can see their comment yet. */
function DeliveryNote({ state }: { state: ReturnType<typeof delivery> }) {
  if (state === 'shared') return null
  return state === 'pending'
    ? <p className="mt-1 text-xs text-muted">Saved on this phone, not shared with the group yet.</p>
    : <p className="mt-1 text-xs text-danger-ink">Couldn’t be shared. Edit it to try again, or see Settings → Sync.</p>
}
