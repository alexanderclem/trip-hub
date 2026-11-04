import type { Member, Place } from '@/data/types'
import { Avatar } from '@/ui'
import { CATEGORY_STYLE } from './categories'

/** The same saved idea stays recognizable as it moves into the plan. */
export function PlaceIdentity({ place, members, compact = false }: { place: Place; members: Member[]; compact?: boolean }) {
  const { Icon, label } = CATEGORY_STYLE[place.category]
  const author = members.find((member) => member.id === place.created_by)
  return <div className={`place-identity ${compact ? 'place-identity-compact' : ''}`}>
    <span className="place-identity-mark"><Icon aria-hidden="true" className="size-5" /></span>
    <div className="min-w-0">
      <p className="place-identity-caption">{label}{place.area ? ` · ${place.area}` : ''}</p>
      <p className="place-identity-name">{place.name}</p>
      {author && <p className="place-identity-author"><Avatar name={author.display_name} color={author.color} photo={author.avatar_url} size="sm" /><span>Saved by {author.display_name}</span></p>}
      {!compact && place.notes && <p className="place-identity-note">{place.notes}</p>}
    </div>
  </div>
}
