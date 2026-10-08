import { Link } from 'react-router'
import type { Member } from '@/data/types'
import { Avatar } from '@/ui'
import { ago } from '@/features/comments/data'
import { isNew, type ActivityEvent } from './feed'

/** Rows of "who did what, when", each a link to the thing itself. */
export function ActivityList({ tripId, events, members, me, since }: {
  tripId: string; events: ActivityEvent[]; members: Member[]; me: string | null; since: string | null
}) {
  const now = Date.now()
  return (
    <ul className="divide-y divide-stone-200">
      {events.map((e) => {
        const author = e.by ? members.find((m) => m.id === e.by) : undefined
        const name = e.by === null ? null : author ? (author.id === me ? 'You' : author.display_name) : 'Someone'
        const fresh = isNew(e, since, me)
        return (
          <li key={e.id}>
            <Link to={`/t/${tripId}/${e.to}`} className="flex min-h-11 items-start gap-3 rounded-lg py-3 hover:bg-brand-50">
              {name ? <Avatar name={name} color={author?.color ?? null} size="sm" /> : <span aria-hidden="true" className="size-7 shrink-0 rounded-full bg-brand-100" />}
              <span className="min-w-0 flex-1 text-sm break-words text-stone-800">
                {name && <span className="font-medium">{name} </span>}{e.text}
                <span className="block text-xs text-stone-500">{ago(e.at, now)}</span>
              </span>
              {fresh && <span className="mt-1 shrink-0 rounded-full bg-brand-700 px-2 py-0.5 text-xs font-medium text-white">New</span>}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
