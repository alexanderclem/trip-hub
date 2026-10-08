import { useState, type FormEvent } from 'react'
import { MessageCircle, Trash2 } from 'lucide-react'
import { useMembers } from '@/data/hooks'
import type { CommentSubject } from '@/data/types'
import { Avatar, Button, Card, ErrorNote, Textarea } from '@/ui'
import { useConfirm } from '@/ui/ConfirmProvider'
import { addComment, ago, COMMENT_MAX, removeComment, useComments } from './data'

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

  return (
    <Card>
      <section aria-labelledby={titleId}>
        <h2 id={titleId} className="flex items-center gap-2 font-semibold">
          <MessageCircle aria-hidden="true" className="size-4 text-brand-700" />
          Comments{comments?.length ? ` (${comments.length})` : ''}
        </h2>
        {comments?.length === 0 && <p className="mt-2 text-sm text-stone-600">Nothing yet. Say what you think.</p>}
        {!!comments?.length && (
          <ul className="mt-3 space-y-4">
            {comments.map((c) => {
              const author = members.find((m) => m.id === c.member_id)
              const name = author?.display_name ?? 'Someone'
              return (
                <li key={c.id} className="flex items-start gap-3">
                  <Avatar name={name} color={author?.color ?? null} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><span className="font-medium">{name}{c.member_id === me ? ' (you)' : ''}</span> <span className="text-xs text-stone-500">· {ago(c.created_at, now)}</span></p>
                    <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-stone-800">{c.body}</p>
                  </div>
                  {c.member_id === me && (
                    <button onClick={async () => { if (await confirm('Remove your comment? This can’t be undone.')) await removeComment(c, me) }} className="-my-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100" aria-label={`Remove your comment: ${c.body.slice(0, 40)}`}>
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
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
