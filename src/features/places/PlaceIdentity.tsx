import type { Member, Place } from '@/data/types'
import { Avatar } from '@/ui'
import { CATEGORY_STYLE } from './categories'
import { Morph, morphName } from '@/ui/Morph'

/** The same saved idea stays recognizable as it moves into the plan. */
export function PlaceIdentity({ place, members, compact = false, morph = false }: { place: Place; members: Member[]; compact?: boolean; /** The place's own screen: its mark and name continue from the list. */ morph?: boolean }) {
  const { Icon, label } = CATEGORY_STYLE[place.category]
  const author = members.find((member) => member.id === place.created_by)
  return <div className={`place-identity ${compact ? 'place-identity-compact' : ''}`}>
    <Morph name={morph ? morphName('place', place.id, 'icon') : ''}><span className="place-identity-mark"><Icon aria-hidden="true" className="size-5" /></span></Morph>
    <div className="min-w-0">
      <p className="place-identity-caption">{label}{place.area ? ` · ${place.area}` : ''}</p>
      <Morph name={morph ? morphName('place', place.id, 'title') : ''} text><p className="place-identity-name">{place.name}</p></Morph>
      {author && <p className="place-identity-author"><Avatar name={author.display_name} color={author.color} photo={author.avatar_url} size="sm" /><span>Saved by {author.display_name}</span></p>}
      {!compact && place.notes && <p className="place-identity-note">{place.notes}</p>}
    </div>
  </div>
}
