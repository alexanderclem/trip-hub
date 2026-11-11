import { useLocation } from 'react-router'
import { Link } from '@astryxdesign/core/Link'
import type { Member } from '@/data/types'
import { Avatar } from '@/ui'

export function TravelerLink({ member, you = false, avatar = true }: { member: Member; you?: boolean; avatar?: boolean }) {
  const location = useLocation()
  const navigation = { state: { from: location.pathname } }
  return <Link href={`/t/${member.trip_id}/travelers/${member.id}`} {...navigation} className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-control px-1 text-action hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action">
    <span className="inline-flex min-w-0 items-center gap-2">
      {avatar && <span aria-hidden="true"><Avatar name={member.display_name} color={member.color} photo={member.avatar_url} size="sm" /></span>}
      <span className="min-w-0 break-words">{member.display_name}{you ? ' (you)' : ''}</span>
    </span>
  </Link>
}
