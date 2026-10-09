import { Link } from 'react-router'
import type { Member } from '@/data/types'
import { Avatar } from '@/ui'

export function TravelerLink({ member, you = false, avatar = true }: { member: Member; you?: boolean; avatar?: boolean }) {
  return <Link to={`/t/${member.trip_id}/travelers/${member.id}`} className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1 text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
    {avatar && <Avatar name={member.display_name} color={member.color} photo={member.avatar_url} size="sm" />}
    <span className="min-w-0 break-words">{member.display_name}{you ? ' (you)' : ''}</span>
  </Link>
}
