import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import type { Member, Place } from '@/data/types'
import { Avatar } from '@/ui'
import { CATEGORY_STYLE } from '@/features/places/categories'

export function SharedPlaces({ tripId, places, members }: { tripId: string; places: Place[]; members: Member[] }) {
  const ideas = places.filter((place) => place.status === 'shortlist').sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).slice(0, 3)
  if (!ideas.length) return null
  return <section className="shared-places" aria-labelledby="shared-places-title">
    {/* The planning links just above already lead to all places, so this is only the newest few. */}
    <div className="shared-places-heading"><h2 id="shared-places-title">Latest ideas</h2></div>
    <ol>{ideas.map((place) => {
      const author = members.find((member) => member.id === place.created_by)
      return <li key={place.id}><Link to={`/t/${tripId}/more/places/${place.id}`} className="shared-place">
        <div className="min-w-0"><p className="notebook-label">{CATEGORY_STYLE[place.category].label}{place.area ? ` · ${place.area}` : ''}</p><h3>{place.name}</h3>{place.notes && <p className="shared-place-note">{place.notes}</p>}
          <p className="shared-place-byline">{author ? <><Avatar name={author.display_name} color={author.color} photo={author.avatar_url} size="sm" /><span>Saved by {author.display_name}</span></> : 'Saved for the group'}</p>
        </div><ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
      </Link></li>
    })}</ol>
  </section>
}
