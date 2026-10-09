import { useConfirm } from '@/ui/ConfirmProvider'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CalendarPlus, ExternalLink, Globe, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useLegContext, useLinks, useMembers, usePlace, usePlaces } from '@/data/hooks'
import { save, softDelete } from '@/data/repo'
import { LINK_KINDS, type Link as TripLink, type LinkKind } from '@/data/types'
import { googleMapsUrl, tripadvisorUrl } from '@/lib/geo'
import { newId } from '@/lib/ids'
import { Button, Card, Disclosure, ErrorNote, Input, LinkButton, PageHeader, SectionTitle, Select } from '@/ui'
import { CATEGORY_STYLE, STATUS_LABEL } from './categories'
import { TravelTimesCard } from '@/features/routing/TravelTimesCard'
import { GroupRatingCard } from '@/features/ratings/GroupRatingCard'
import { AddToPollCard } from '@/features/polls/AddToPollCard'
import { CommentThread } from '@/features/comments/CommentThread'

export function PlaceDetailScreen() {
  const confirm = useConfirm()
  const { tripId, placeId } = useParams() as { tripId: string; placeId: string }
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const place = usePlace(placeId)
  const links = useLinks(placeId) ?? []
  const members = useMembers(tripId) ?? []
  const allPlaces = usePlaces(tripId)
  const legCtx = useLegContext(tripId)

  if (!place) return <PageHeader title="Place" back={`/t/${tripId}/more/places`} />
  if (place.deleted_at) {
    return (
      <div>
        <PageHeader title="Deleted" back={`/t/${tripId}/more/places`} />
        <p className="p-5 text-stone-600">This place was deleted.</p>
      </div>
    )
  }

  const { Icon, color, label } = CATEGORY_STYLE[place.category]
  const at = place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null
  const editedBy = members.find((m) => m.id === place.updated_by)?.display_name

  return (
    <div className="min-h-full pb-8">
      <PageHeader
        title={place.name}
        back={`/t/${tripId}/more/places`}
        action={
          <Link to="edit" className="ui-icon-button text-brand-700" aria-label="Edit">
            <Pencil aria-hidden="true" className="size-5" />
          </Link>
        }
      />
      <div className="mx-auto max-w-md space-y-4 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full text-white" style={{ background: color }}>
            <Icon aria-hidden="true" className="size-6" />
          </span>
          <div>
            <div className="font-medium">{label}{place.area && ` · ${place.area}`}</div>
            <div className="text-sm text-stone-600">{STATUS_LABEL[place.status]}</div>
          </div>
        </div>

        {place.notes && <p className="whitespace-pre-wrap break-words px-1 text-stone-800">{place.notes}</p>}

        <LinkButton to={`/t/${tripId}/plan/new?place=${place.id}`} className="w-full">
          <CalendarPlus aria-hidden="true" className="size-4" /> Add to the plan
        </LinkButton>

        {me && <GroupRatingCard place={place} memberId={me} />}

        {at && allPlaces && legCtx && <TravelTimesCard place={place} places={allPlaces} ctx={legCtx} />}

        {me && <AddToPollCard place={place} memberId={me} />}

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
                  <span className="shrink-0 text-xs font-normal text-stone-600">{l.kind}</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                <button type="button" onClick={() => softDelete('links', l.id, me)} className="ui-icon-button -mr-2 text-stone-600" aria-label="Remove link">
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            ))}
          </div>
          {!at && <p className="pt-1 text-sm text-amber-800">No map pin yet. Edit to add a location.</p>}
          <Disclosure summary="Add a link" className="mt-1 border-t border-stone-200 pt-1"><AddLink tripId={tripId} placeId={placeId} me={me} /></Disclosure>
        </Card>

        <p className="text-center text-xs text-stone-600">
          {editedBy ? `Last edited by ${editedBy}` : null}
          {place.source === 'osm' && ' · Place data © OpenStreetMap contributors'}
        </p>

        <Button
          variant="danger"
          className="mx-auto flex"
          onClick={async () => {
            if (!await confirm(`Delete "${place.name}" for everyone?`)) return
            await softDelete('places', place.id, me)
            navigate(`/t/${tripId}/more/places`, { replace: true })
          }}
        >
          <Trash2 aria-hidden="true" className="size-4" /> Delete place
        </Button>
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
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" type="url" />
      <div className="flex gap-2">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="min-w-0 flex-1" />
        <Select value={kind} onChange={(e) => setKind(e.target.value as LinkKind)} className="w-28">
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
