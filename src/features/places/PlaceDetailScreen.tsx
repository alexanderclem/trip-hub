import { useConfirm } from '@/ui/ConfirmProvider'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ExternalLink, Globe, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useLegContext, useLinks, useMembers, usePlace, usePlaces } from '@/data/hooks'
import { save, softDelete } from '@/data/repo'
import { LINK_KINDS, type Link as TripLink, type LinkKind } from '@/data/types'
import { googleMapsUrl, tripadvisorUrl } from '@/lib/geo'
import { newId } from '@/lib/ids'
import { Button, Card, Disclosure, ErrorNote, Input, PageHeader, SectionTitle, Select } from '@/ui'
import { STATUS_LABEL } from './categories'
import { TravelTimesCard } from '@/features/routing/TravelTimesCard'
import { GroupRatingCard } from '@/features/ratings/GroupRatingCard'
import { AddToPollCard } from '@/features/polls/AddToPollCard'
import { CommentThread } from '@/features/comments/CommentThread'
import { useTripAccess } from '@/data/device'
import { can } from '@/data/access'
import { useItems } from '@/features/itinerary/data'
import { usePolls } from '@/features/polls/data'
import { useNow } from '@/lib/useNow'
import { PlaceIdentity } from './PlaceIdentity'
import { PlaceJourney } from './PlaceJourney'
import { rowLoader, useFirstRow } from '@/data/firstRow'

export function PlaceDetailScreen() {
  const confirm = useConfirm()
  const { tripId, placeId } = useParams() as { tripId: string; placeId: string }
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const place = useFirstRow(placeId, usePlace(placeId))
  const links = useLinks(placeId) ?? []
  const loadedMembers = useMembers(tripId)
  const members = loadedMembers ?? []
  const allPlaces = usePlaces(tripId)
  const legCtx = useLegContext(tripId)
  const items = useItems(tripId)
  const polls = usePolls(tripId)
  const now = useNow()
  const mayPlan = can(useTripAccess(tripId), 'plan')

  if (!place) return <PageHeader title="Place" back={`/t/${tripId}/more/places`} />
  if (place.deleted_at) {
    return (
      <div>
        <PageHeader title="Deleted" back={`/t/${tripId}/more/places`} />
        <p className="p-5 text-muted">This place was deleted.</p>
      </div>
    )
  }

  const at = place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null
  const editedBy = members.find((m) => m.id === place.updated_by)?.display_name

  return (
    <div className="place-notebook min-h-full pb-8">
      <PageHeader
        title={place.name}
        back={`/t/${tripId}/more/places`}
        action={mayPlan &&
          <Link to="edit" className="ui-icon-button text-action" aria-label="Edit">
            <Pencil aria-hidden="true" className="size-5" />
          </Link>
        }
      />
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
        <div className="place-notebook-intro"><p className="notebook-label mb-3">{STATUS_LABEL[place.status]}</p><PlaceIdentity place={place} members={members} morph /></div>
        <PlaceJourney place={place} members={members} items={items} polls={polls} membersReady={loadedMembers !== undefined} mayPlan={mayPlan} now={now} />
        {mayPlan && me && <AddToPollCard place={place} memberId={me} />}

        {me && <GroupRatingCard place={place} memberId={me} />}

        {at && allPlaces && legCtx && <TravelTimesCard place={place} places={allPlaces} ctx={legCtx} />}

        <CommentThread tripId={tripId} type="place" subjectId={place.id} me={me} />

        {/* Everything that leaves the app, in one place: directions, reviews, and the links the group saved. */}
        <Card>
          <SectionTitle>Links &amp; directions</SectionTitle>
          <div className="mt-1">
            <ExtLink href={googleMapsUrl(place.name, place.area, at)} label="Open in Google Maps" />
            <ExtLink href={tripadvisorUrl(place.name, place.area)} label="Search on TripAdvisor" />
            {place.website && <ExtLink href={place.website} label="Website" Icon={Globe} />}
            {place.phone && <ExtLink href={`tel:${place.phone}`} label={place.phone} Icon={Phone} />}
            {links.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <a href={l.url} target="_blank" rel="noreferrer" className="ui-link min-w-0 flex-1">
                  <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{l.label || l.url}</span>
                  <span className="shrink-0 text-xs font-normal text-muted">{l.kind}</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                <button type="button" onClick={() => softDelete('links', l.id, me)} className="ui-icon-button -mr-2 text-muted" aria-label="Remove link">
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            ))}
          </div>
          {!at && <p className="pt-1 text-sm text-warning-ink">No map pin yet. Edit to add a location.</p>}
          <Disclosure summary="Add a link" className="mt-1 border-t border-line pt-1"><AddLink tripId={tripId} placeId={placeId} me={me} /></Disclosure>
        </Card>

        <p className="text-center text-xs text-muted">
          {editedBy ? `Last edited by ${editedBy}` : null}
          {place.source === 'osm' && ' · Place data © OpenStreetMap contributors'}
        </p>

        {mayPlan && <Button
          variant="danger"
          className="mx-auto flex"
          onClick={async () => {
            if (!await confirm(`Delete "${place.name}" for everyone?`)) return
            await softDelete('places', place.id, me)
            navigate(`/t/${tripId}/more/places`, { replace: true })
          }}
        >
          <Trash2 aria-hidden="true" className="size-4" /> Delete place
        </Button>}
      </div>
    </div>
  )
}

function ExtLink({ href, label, Icon = ExternalLink }: { href: string; label: string; Icon?: typeof ExternalLink }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="ui-link flex">
      <Icon aria-hidden="true" className="size-4 shrink-0" /> <span className="min-w-0 break-words">{label}</span>{!href.startsWith('tel:') && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  )
}

function AddLink({ tripId, placeId, me }: { tripId: string; placeId: string; me: string | null }) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<LinkKind>('info')
  const [error, setError] = useState<string | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) return setError('Links must start with http:// or https://')
    const link: TripLink = { id: newId(), trip_id: tripId, place_id: placeId, item_id: null, expense_id: null, url: u, label: label.trim() || null, kind }
    await save('links', link, me)
    setUrl('')
    setLabel('')
    setError(null)
  }

  return (
    <form onSubmit={add} className="space-y-2">
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" type="url" aria-label="Link address" />
      <div className="flex gap-2">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" aria-label="Link label (optional)" className="min-w-0 flex-1" />
        <Select value={kind} onChange={(e) => setKind(e.target.value as LinkKind)} aria-label="Link type" className="w-28">
          {LINK_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
      </div>
      <ErrorNote error={error} />
      <Button type="submit" variant="secondary" disabled={!url.trim()} className="flex w-full items-center justify-center gap-1">
        <Plus aria-hidden="true" className="size-4" /> Add link
      </Button>
    </form>
  )
}

/** Reads this screen's row before the route commits, so it can morph in from its list. */
export const loader = rowLoader('places', 'placeId')
